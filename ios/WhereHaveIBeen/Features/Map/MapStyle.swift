import MapKit
import UIKit

extension UIColor {
    static let explored = UIColor(red: 0x3D / 255, green: 0x6B / 255, blue: 0xA8 / 255, alpha: 1)
    static let flightBuffer = UIColor(red: 0xE6 / 255, green: 0xA2 / 255, blue: 0x3C / 255, alpha: 1)
    static let flightLine = UIColor(red: 0xC9 / 255, green: 0x84 / 255, blue: 0x18 / 255, alpha: 1)
}

enum MapZoom {
    /// MapKit's zoom scale is screen points per map point; the world is 256 pt wide
    /// at zoom level 0 and 2^28 map points wide, so level 20 is scale 1.
    static func level(for zoomScale: MKZoomScale) -> Double {
        20 + log2(Double(zoomScale))
    }
}

/// A 500 m corridor is sub-pixel below zoom 9, so the outline thickens and the
/// fill darkens as the map zooms out, mirroring the web app.
struct CoverageStyle: Equatable {
    var strokeWidth: CGFloat
    var strokeAlpha: CGFloat
    var fillAlpha: CGFloat

    static func at(zoomLevel: Double) -> CoverageStyle {
        let boost = max(0, 9 - zoomLevel)
        return CoverageStyle(
            strokeWidth: 1 + boost * 0.9,
            strokeAlpha: min(0.75, 0.55 + boost * 0.04),
            fillAlpha: min(0.5, 0.38 + boost * 0.025))
    }

    static func flightLineWidth(zoomLevel: Double) -> CGFloat {
        2.4 + max(0, 9 - zoomLevel) * 0.5
    }
}

/// Draws the corridor from an outline decimated to the current zoom and clipped
/// to each tile. The stock multi-polygon renderer strokes every vertex of every
/// polygon into every tile; zoomed out, the stroke is far wider than the vertex
/// spacing, so the round joins overlap and CoreGraphics' anti-aliasing spends
/// seconds per tile resolving the intersections.
final class CoverageRenderer: MKOverlayRenderer {
    private struct Piece {
        let rings: [[CGPoint]]
        /// The rings again, thinned to half the pen width so the round joins
        /// of neighbouring vertices stop overlapping; the pen hides the difference.
        let outlines: [[CGPoint]]
        let bounds: CGRect
    }

    /// Every ring of every polygon in the renderer's own coordinate space; the
    /// first ring of each polygon is its exterior.
    private var polygons: [[[CGPoint]]] = []
    private var cache: [Int: [Piece]] = [:]
    private let lock = NSLock()

    override init(overlay: any MKOverlay) {
        let multi = overlay as? MKMultiPolygon
        super.init(overlay: overlay)
        polygons = (multi?.polygons ?? []).map { polygon in
            ([polygon] + (polygon.interiorPolygons ?? [])).map { ring in
                (0..<ring.pointCount).map { point(for: ring.points()[$0]) }
            }
        }
    }

    override func draw(_ mapRect: MKMapRect, zoomScale: MKZoomScale, in context: CGContext) {
        let zoomLevel = MapZoom.level(for: zoomScale)
        let style = CoverageStyle.at(zoomLevel: zoomLevel)
        let strokeWidth = style.strokeWidth / zoomScale
        let tile = rect(for: mapRect).insetBy(dx: -strokeWidth, dy: -strokeWidth)
        let visible = pieces(zoomLevel: zoomLevel).filter { $0.bounds.intersects(tile) }
        guard !visible.isEmpty else { return }

        context.setFillColor(UIColor.explored.withAlphaComponent(style.fillAlpha).cgColor)
        context.setStrokeColor(UIColor.explored.withAlphaComponent(style.strokeAlpha).cgColor)
        context.setLineWidth(strokeWidth)
        context.setLineJoin(.round)
        context.setLineCap(.round)
        for piece in visible {
            let fill = CGMutablePath()
            let stroke = CGMutablePath()
            let whole = tile.contains(piece.bounds)
            for ring in piece.rings where ring.count >= 3 {
                let clipped = whole ? ring : PolygonClip.clip(ring, to: tile)
                guard clipped.count >= 3 else { continue }
                fill.addLines(between: clipped)
                fill.closeSubpath()
            }
            for outline in piece.outlines {
                if outline.count < 3 {
                    stroke.addLines(between: outline.count == 1 ? [outline[0], outline[0]] : outline)
                    continue
                }
                for run in whole ? [PolygonClip.Run(points: outline, closed: true)] : PolygonClip.edgeRuns(outline, near: tile) {
                    stroke.addLines(between: run.points)
                    if run.closed { stroke.closeSubpath() }
                }
            }
            if !fill.isEmpty {
                context.addPath(fill)
                context.fillPath(using: .evenOdd)
            }
            if !stroke.isEmpty {
                // Zoomed out, the corridor is thinner than the pen, so the stroke
                // overlaps itself along its whole length. Anti-aliasing resolves
                // every overlap and costs more than the rest of the tile; the
                // aliased edge is a third of a point on a 3x screen.
                context.setShouldAntialias(false)
                context.addPath(stroke)
                context.strokePath()
                context.setShouldAntialias(true)
            }
        }
    }

    private func pieces(zoomLevel: Double) -> [Piece] {
        let bucket = Int(min(max(zoomLevel.rounded(.down), 0), 20))
        lock.lock()
        defer { lock.unlock() }
        if let cached = cache[bucket] { return cached }
        let pointSize = pow(2, 20 - Double(bucket))
        let penWidth = CoverageStyle.at(zoomLevel: Double(bucket)).strokeWidth
        let built = polygons.compactMap { rings -> Piece? in
            let decimated = rings.map { Self.decimate($0, tolerance: pointSize * 0.5) }.filter { !$0.isEmpty }
            guard !decimated.isEmpty else { return nil }
            let outlines = decimated.map { Self.decimate($0, tolerance: pointSize * max(0.5, penWidth * 0.5)) }
            let bounds = decimated.reduce(CGRect.null) { $0.union(PolygonClip.bounds(of: $1)) }
            return Piece(rings: decimated, outlines: outlines, bounds: bounds)
        }
        cache[bucket] = built
        return built
    }

    /// Drops vertices closer than `tolerance` to the last kept one. A ring that
    /// collapses below a triangle becomes a line from its first point to its
    /// farthest, so with round caps a small loop still strokes as a dot.
    static func decimate(_ ring: [CGPoint], tolerance: CGFloat) -> [CGPoint] {
        guard let first = ring.first else { return [] }
        var kept = [first]
        for point in ring.dropFirst()
        where abs(point.x - kept[kept.count - 1].x) >= tolerance || abs(point.y - kept[kept.count - 1].y) >= tolerance {
            kept.append(point)
        }
        if kept.count >= 3 { return kept }
        let farthest = ring.max { lhs, rhs in
            hypot(lhs.x - first.x, lhs.y - first.y) < hypot(rhs.x - first.x, rhs.y - first.y)
        } ?? first
        return farthest == first ? [first] : [first, farthest]
    }
}

enum PolygonClip {
    struct Run: Equatable {
        var points: [CGPoint]
        var closed: Bool
    }

    static func bounds(of points: [CGPoint]) -> CGRect {
        points.reduce(CGRect.null) { $0.union(CGRect(origin: $1, size: .zero)) }
    }

    /// Sutherland–Hodgman against a rectangle. The result covers exactly the part
    /// of the polygon inside `rect`, with new edges along the rectangle's sides.
    static func clip(_ polygon: [CGPoint], to rect: CGRect) -> [CGPoint] {
        var output = polygon
        for side in 0..<4 {
            let input = output
            output = []
            guard let last = input.last else { break }
            var previous = last
            for current in input {
                let currentInside = inside(current, rect, side)
                if currentInside {
                    if !inside(previous, rect, side) { output.append(intersection(previous, current, rect, side)) }
                    output.append(current)
                } else if inside(previous, rect, side) {
                    output.append(intersection(previous, current, rect, side))
                }
                previous = current
            }
        }
        return output
    }

    /// The stretches of a ring's outline whose edges touch `rect`, so a stroke
    /// never draws the artificial sides that clipping introduces. A ring that
    /// lies entirely near the rect comes back as one closed run.
    static func edgeRuns(_ ring: [CGPoint], near rect: CGRect) -> [Run] {
        let count = ring.count
        guard count >= 2 else { return ring.isEmpty ? [] : [Run(points: ring, closed: false)] }
        var kept = [Bool](repeating: false, count: count)
        for index in 0..<count {
            let next = ring[(index + 1) % count]
            kept[index] = CGRect(origin: ring[index], size: .zero).union(CGRect(origin: next, size: .zero)).intersects(rect)
        }
        guard kept.contains(false) else { return [Run(points: ring, closed: true)] }
        guard let start = (0..<count).first(where: { !kept[$0] && kept[($0 + 1) % count] }) else { return [] }
        var runs: [Run] = []
        var current: [CGPoint] = []
        for offset in 1...count {
            let index = (start + offset) % count
            if kept[index] {
                if current.isEmpty { current.append(ring[index]) }
                current.append(ring[(index + 1) % count])
            } else if !current.isEmpty {
                runs.append(Run(points: current, closed: false))
                current = []
            }
        }
        if !current.isEmpty { runs.append(Run(points: current, closed: false)) }
        return runs
    }

    private static func inside(_ point: CGPoint, _ rect: CGRect, _ side: Int) -> Bool {
        switch side {
        case 0: point.x >= rect.minX
        case 1: point.x <= rect.maxX
        case 2: point.y >= rect.minY
        default: point.y <= rect.maxY
        }
    }

    private static func intersection(_ a: CGPoint, _ b: CGPoint, _ rect: CGRect, _ side: Int) -> CGPoint {
        switch side {
        case 0, 1:
            let x = side == 0 ? rect.minX : rect.maxX
            let t = (x - a.x) / (b.x - a.x)
            return CGPoint(x: x, y: a.y + (b.y - a.y) * t)
        default:
            let y = side == 2 ? rect.minY : rect.maxY
            let t = (y - a.y) / (b.y - a.y)
            return CGPoint(x: a.x + (b.x - a.x) * t, y: y)
        }
    }
}

final class FlightBufferRenderer: MKMultiPolygonRenderer {
    override init(overlay: any MKOverlay) {
        super.init(overlay: overlay)
        fillColor = .flightBuffer.withAlphaComponent(0.22)
        strokeColor = nil
    }
}

final class FlightLineRenderer: MKPolylineRenderer {
    override init(overlay: any MKOverlay) {
        super.init(overlay: overlay)
        strokeColor = .flightLine.withAlphaComponent(0.8)
        lineWidth = 2.4
        lineDashPattern = [10, 8]
        lineCap = .round
    }

    override func applyStrokeProperties(to context: CGContext, atZoomScale zoomScale: MKZoomScale) {
        super.applyStrokeProperties(to: context, atZoomScale: zoomScale)
        let width = CoverageStyle.flightLineWidth(zoomLevel: MapZoom.level(for: zoomScale))
        context.setLineWidth(width / zoomScale)
        context.setLineDash(phase: 0, lengths: [10 / zoomScale, 8 / zoomScale])
    }
}
