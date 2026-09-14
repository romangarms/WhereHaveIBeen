import MapKit
import Testing
@testable import WhereHaveIBeen

struct HeatTests {
    @Test func intensityIsLogarithmic() {
        #expect(HeatPalette.intensity(count: 0) == 0)
        #expect(abs(HeatPalette.intensity(count: 99) - log(100)) < 1e-9)
    }

    @Test func ceilingIsHighPercentileNotMax() {
        var values = Array(repeating: 1.0, count: 99)
        values.append(1000)
        #expect(HeatPalette.ceiling(values) == 1.0)
        #expect(HeatPalette.ceiling([]) == 1)
    }

    @Test func paletteHitsStopsAndInterpolatesBetween() {
        let blue = HeatPalette.color(at: 0)
        #expect(blue.red == 0 && blue.green == 0 && blue.blue == 1)
        let cyan = HeatPalette.color(at: 0.3)
        #expect(cyan.red == 0 && cyan.green == 1 && cyan.blue == 1)
        let lime = HeatPalette.color(at: 0.5)
        #expect(lime.red == 0 && lime.green == 1 && lime.blue == 0)
        let yellow = HeatPalette.color(at: 0.7)
        #expect(yellow.red == 1 && yellow.green == 1 && yellow.blue == 0)
        let red = HeatPalette.color(at: 1)
        #expect(red.red == 1 && red.green == 0 && red.blue == 0)
        let between = HeatPalette.color(at: 0.6)
        #expect(abs(between.red - 0.5) < 1e-9 && between.green == 1 && between.blue == 0)
        #expect(HeatPalette.color(at: 5).red == 1)
    }

    @Test func dotRadiusShrinksWhenZoomedOut() {
        #expect(HeatStyle.radiusPoints(zoomLevel: 14) == 12)
        #expect(HeatStyle.radiusPoints(zoomLevel: 2) == 4)
        let mid = HeatStyle.radiusPoints(zoomLevel: 8)
        #expect(mid > 4 && mid < 12)
    }

    @Test func gridBucketsCellsAndCoarsensPerLevel() {
        let cells = [[-203834, 79000, 12], [-203833, 79000, 3], [-203834, 79001, 1]]
        let grid = HeatGrid(cells: cells, cellDeg: 0.0006)
        #expect(grid.levels.count == HeatGrid.levelCount)
        #expect(grid.levels[0].cellCount == 3)
        #expect(grid.levels[1].cellCount == 1)
        #expect(!grid.isEmpty)
        #expect(grid.levels[0].cells(in: .world).count == 3)
        #expect(grid.levels[0].cells(in: grid.boundingRect).count == 3)
        let coarse = grid.levels[1].cells(in: .world)
        #expect(coarse.count == 1)
        #expect(abs(coarse[0].intensity - log(17)) < 1e-9)
    }

    @Test func levelSelectionRespectsMinimumScreenSpan() {
        let grid = HeatGrid(cells: [[0, 0, 1]], cellDeg: 0.0006)
        let base = grid.levels[0].cellSpan
        let fine = grid.level(for: MKZoomScale(10 / base), minScreenSpan: 6)
        #expect(fine.cellSpan == base)
        let coarse = grid.level(for: MKZoomScale(1 / base), minScreenSpan: 6)
        #expect(coarse.cellSpan == base * 8)
    }

    @Test func emptyGridHasNoBounds() {
        let grid = HeatGrid(cells: [], cellDeg: 0.0006)
        #expect(grid.isEmpty)
        #expect(grid.boundingRect.isNull)
    }

    @Test func coverageStyleThickensWhenZoomedOut() {
        let close = CoverageStyle.at(zoomLevel: 12)
        #expect(close == CoverageStyle(strokeWidth: 1, strokeAlpha: 0.55, fillAlpha: 0.38))
        let far = CoverageStyle.at(zoomLevel: 5)
        #expect(abs(far.strokeWidth - 4.6) < 1e-9)
        #expect(abs(far.strokeAlpha - 0.71) < 1e-9)
        #expect(abs(far.fillAlpha - 0.48) < 1e-9)
        #expect(CoverageStyle.at(zoomLevel: 0).fillAlpha == 0.5)
        #expect(MapZoom.level(for: 1) == 20)
        #expect(MapZoom.level(for: 1.0 / 256) == 12)
    }
}

struct RendererTests {
    @Test func renderersConstructFromOverlays() throws {
        let square: [[[Double]]] = [[[-122.4, 47.6], [-122.3, 47.6], [-122.3, 47.7], [-122.4, 47.7], [-122.4, 47.6]]]
        let coverage = try #require(GeoJSONShapes.coverage(from: .polygon(square)))
        let buffer = try #require(GeoJSONShapes.flightBuffer(from: .polygon(square)))
        let line = try #require(GeoJSONShapes.flightLine(from: .lineString([[-122.3, 47.4], [-118.4, 33.9]])))
        #expect(CoverageRenderer(overlay: coverage).overlay === coverage)
        #expect(FlightBufferRenderer(overlay: buffer).fillColor != nil)
        #expect(FlightLineRenderer(overlay: line).lineWidth == 2.4)
    }

    @Test func coverageDecimationKeepsShapeAndCollapsesTinyLoops() {
        let square = [CGPoint(x: 0, y: 0), CGPoint(x: 100, y: 0), CGPoint(x: 100, y: 100), CGPoint(x: 0, y: 100)]
        #expect(CoverageRenderer.decimate(square, tolerance: 10) == square)
        let dense = (0...1000).map { CGPoint(x: Double($0) / 10, y: 0) } + [CGPoint(x: 100, y: 100), CGPoint(x: 0, y: 100)]
        let thinned = CoverageRenderer.decimate(dense, tolerance: 10)
        #expect(thinned.count == 13)
        #expect(thinned.first == .zero)
        let tiny = [CGPoint(x: 0, y: 0), CGPoint(x: 1, y: 0), CGPoint(x: 1, y: 1), CGPoint(x: 0, y: 1)]
        #expect(CoverageRenderer.decimate(tiny, tolerance: 10) == [CGPoint(x: 0, y: 0), CGPoint(x: 1, y: 1)])
        #expect(CoverageRenderer.decimate([], tolerance: 10).isEmpty)
    }

    @Test func polygonClipKeepsOnlyTheInsideOfTheRect() {
        let square = [CGPoint(x: 0, y: 0), CGPoint(x: 100, y: 0), CGPoint(x: 100, y: 100), CGPoint(x: 0, y: 100)]
        let clipped = PolygonClip.clip(square, to: CGRect(x: 50, y: -10, width: 100, height: 60))
        #expect(PolygonClip.bounds(of: clipped) == CGRect(x: 50, y: 0, width: 50, height: 50))
        #expect(PolygonClip.clip(square, to: CGRect(x: 200, y: 200, width: 10, height: 10)).isEmpty)
        #expect(PolygonClip.clip(square, to: CGRect(x: -10, y: -10, width: 200, height: 200)) == square)
    }

    @Test func edgeRunsSkipEdgesAwayFromTheRect() {
        let square = [CGPoint(x: 0, y: 0), CGPoint(x: 100, y: 0), CGPoint(x: 100, y: 100), CGPoint(x: 0, y: 100)]
        #expect(PolygonClip.edgeRuns(square, near: CGRect(x: -10, y: -10, width: 200, height: 200)) == [PolygonClip.Run(points: square, closed: true)])
        let left = PolygonClip.edgeRuns(square, near: CGRect(x: -10, y: 20, width: 20, height: 20))
        #expect(left == [PolygonClip.Run(points: [CGPoint(x: 0, y: 100), CGPoint(x: 0, y: 0)], closed: false)])
        let corner = PolygonClip.edgeRuns(square, near: CGRect(x: -10, y: -10, width: 20, height: 20))
        #expect(corner == [PolygonClip.Run(points: [CGPoint(x: 0, y: 100), CGPoint(x: 0, y: 0), CGPoint(x: 100, y: 0)], closed: false)])
        #expect(PolygonClip.edgeRuns(square, near: CGRect(x: 200, y: 200, width: 10, height: 10)).isEmpty)
    }

    @Test func heatmapRendererPaintsDots() throws {
        let heatmap = try Fixtures.decode(HeatmapResponse.self, named: "heatmap")
        let grid = HeatGrid(cells: heatmap.cells, cellDeg: heatmap.cellDeg)
        let overlay = HeatmapOverlay(grid: grid)
        let renderer = HeatmapRenderer(overlay: overlay)
        let rect = overlay.boundingMapRect
        #expect(renderer.canDraw(rect, zoomScale: 1))

        let size = 256
        let zoomScale = MKZoomScale(Double(size) / max(rect.width, rect.height))
        let context = try #require(CGContext(
            data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: size * 4,
            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        // MapKit hands renderers a context whose origin is the overlay's bounding
        // rect, scaled by the zoom scale; reproduce that here.
        context.scaleBy(x: CGFloat(zoomScale), y: CGFloat(zoomScale))
        let origin = renderer.rect(for: rect).origin
        context.translateBy(x: -origin.x, y: -origin.y)
        renderer.draw(rect, zoomScale: zoomScale, in: context)

        let pixels = try #require(context.data).assumingMemoryBound(to: UInt8.self)
        var painted = 0
        for index in stride(from: 3, to: size * size * 4, by: 4) where pixels[index] > 0 {
            painted += 1
        }
        #expect(painted > 200)
    }

    @Test func coarseLevelsStayCentredOnTheirCells() {
        let grid = HeatGrid(cells: [[1000, 2000, 1], [1001, 2001, 1]], cellDeg: 0.001)
        let fine = grid.levels[0].cells(in: .world)
        let coarse = grid.levels[1].cells(in: .world)
        #expect(coarse.count == 1)
        let meanX = fine.map(\.x).reduce(0, +) / Double(fine.count)
        #expect(abs(coarse[0].x - meanX) < 1)
    }
}
