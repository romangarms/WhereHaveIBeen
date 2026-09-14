import Foundation
import MapKit

/// Everything on the map for one data state. Replaced as a unit so the map never
/// shows a half-updated mix of old and new overlays. Flight overlays are always
/// part of the set; whether they are visible is the map's concern.
@MainActor
struct MapOverlaySet {
    let id = UUID()
    var coverage: CoverageOverlay?
    var flightBuffer: FlightBufferOverlay?
    var flightLines: [FlightLineOverlay] = []
    var heatmap: HeatmapOverlay?

    static let empty = MapOverlaySet()

    var all: [MKOverlay] {
        var overlays: [MKOverlay] = []
        if let coverage { overlays.append(coverage) }
        if let flightBuffer { overlays.append(flightBuffer) }
        overlays.append(contentsOf: flightLines)
        if let heatmap { overlays.append(heatmap) }
        return overlays
    }

    var isEmpty: Bool { all.isEmpty }

    /// Flight buffers never drive the viewport: fitting to a cross-country flight
    /// would zoom out until the coverage corridor vanished.
    var fitRegions: [FitRegion] {
        var regions: [FitRegion] = []
        if let coverage { regions += FitRegion.regions(for: coverage) }
        if let heatmap { regions += FitRegion.regions(for: heatmap.grid) }
        if regions.isEmpty, let flightBuffer { regions = FitRegion.regions(for: flightBuffer) }
        return regions
    }
}

/// One piece of the data with a weight saying how much it matters when the whole
/// set cannot fit on screen at once.
struct FitRegion {
    var rect: MKMapRect
    var weight: Double

    static func regions(for multiPolygon: MKMultiPolygon) -> [FitRegion] {
        multiPolygon.polygons.compactMap { polygon in
            let rect = polygon.boundingMapRect
            guard !rect.isNull, !rect.isEmpty else { return nil }
            return FitRegion(rect: rect, weight: rect.width * rect.height)
        }
    }

    static func regions(for grid: HeatGrid) -> [FitRegion] {
        guard let level = grid.levels.last else { return [] }
        let span = level.cellSpan
        return level.buckets.values.flatMap { cells in
            cells.map { cell in
                FitRegion(
                    rect: MKMapRect(x: cell.x - span / 2, y: cell.y - span / 2, width: span, height: span),
                    weight: cell.intensity)
            }
        }
    }

    /// The bounding rect of everything when it fits within `limit`; otherwise the
    /// heaviest group of regions that does. Regions are grouped greedily in weight
    /// order, so a screen that cannot show Hawaii, the West coast and Europe at once
    /// still lands on the West coast rather than the empty ocean between them.
    static func bestRect(_ regions: [FitRegion], within limit: MKMapSize) -> MKMapRect? {
        let sorted = regions.sorted { $0.weight > $1.weight }
        guard !sorted.isEmpty else { return nil }
        let everything = sorted.reduce(MKMapRect.null) { $0.union($1.rect) }
        if fits(everything, within: limit) { return everything }

        var clusters: [(rect: MKMapRect, weight: Double)] = []
        for region in sorted {
            if let index = clusters.firstIndex(where: { fits($0.rect.union(region.rect), within: limit) }) {
                clusters[index].rect = clusters[index].rect.union(region.rect)
                clusters[index].weight += region.weight
            } else {
                clusters.append((region.rect, region.weight))
            }
        }
        return clusters.max { $0.weight < $1.weight }?.rect
    }

    private static func fits(_ rect: MKMapRect, within limit: MKMapSize) -> Bool {
        rect.width <= limit.width && rect.height <= limit.height
    }
}
