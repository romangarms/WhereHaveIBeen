import Foundation
import MapKit

final class CoverageOverlay: MKMultiPolygon {}
final class FlightBufferOverlay: MKMultiPolygon {}
final class FlightLineOverlay: MKPolyline {}

/// Converts API geometry straight into MapKit shapes. An all-time corridor can hold
/// hundreds of thousands of coordinates, so this runs off the main actor.
enum GeoJSONShapes {
    static func polygons(from geometry: GeoJSONGeometry?) -> [MKPolygon] {
        switch geometry {
        case .polygon(let rings): polygon(rings).map { [$0] } ?? []
        case .multiPolygon(let polygons): polygons.compactMap(polygon)
        default: []
        }
    }

    static func coverage(from geometry: GeoJSONGeometry?) -> CoverageOverlay? {
        let polygons = polygons(from: geometry)
        return polygons.isEmpty ? nil : CoverageOverlay(polygons)
    }

    static func flightBuffer(from geometry: GeoJSONGeometry?) -> FlightBufferOverlay? {
        let polygons = polygons(from: geometry)
        return polygons.isEmpty ? nil : FlightBufferOverlay(polygons)
    }

    static func flightLine(from geometry: GeoJSONGeometry?) -> FlightLineOverlay? {
        let positions: [[Double]]
        switch geometry {
        case .lineString(let line): positions = line
        case .multiLineString(let lines): positions = lines.first ?? []
        default: return nil
        }
        let coordinates = coordinates(positions)
        guard coordinates.count >= 2 else { return nil }
        return FlightLineOverlay(coordinates: coordinates, count: coordinates.count)
    }

    private static func polygon(_ rings: [[[Double]]]) -> MKPolygon? {
        guard let exterior = rings.first.map(coordinates), exterior.count >= 3 else { return nil }
        let holes = rings.dropFirst().map(coordinates).filter { $0.count >= 3 }
            .map { MKPolygon(coordinates: $0, count: $0.count) }
        return MKPolygon(coordinates: exterior, count: exterior.count, interiorPolygons: holes.isEmpty ? nil : holes)
    }

    private static func coordinates(_ positions: [[Double]]) -> [CLLocationCoordinate2D] {
        positions.compactMap { position in
            guard position.count >= 2 else { return nil }
            return CLLocationCoordinate2D(latitude: position[1], longitude: position[0])
        }
    }
}

/// The MapKit shapes for one track response. Built once per distinct response
/// and reused when the server later confirms nothing changed, so the map keeps
/// its rendered tiles instead of blanking and redrawing everything.
struct TrackShapes: @unchecked Sendable {
    let source: TrackResponse
    let coverage: CoverageOverlay?
    let flightBuffer: FlightBufferOverlay?
    let flightLines: [FlightLineOverlay]

    init(_ response: TrackResponse) {
        source = response
        coverage = GeoJSONShapes.coverage(from: response.driving.geometry)
        flightBuffer = GeoJSONShapes.flightBuffer(from: response.flightsBuffer.geometry)
        flightLines = response.flights.features.compactMap { GeoJSONShapes.flightLine(from: $0.geometry) }
    }
}

struct CoverageBox: @unchecked Sendable {
    let overlay: CoverageOverlay?
    init(_ overlay: CoverageOverlay?) { self.overlay = overlay }
}
