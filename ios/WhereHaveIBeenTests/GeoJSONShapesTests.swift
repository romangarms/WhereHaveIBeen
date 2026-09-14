import MapKit
import Testing
@testable import WhereHaveIBeen

struct GeoJSONShapesTests {
    private let square: [[[Double]]] = [[[-122.4, 47.6], [-122.3, 47.6], [-122.3, 47.7], [-122.4, 47.7], [-122.4, 47.6]]]

    @Test func polygonBecomesOneElementMultiPolygon() throws {
        let overlay = try #require(GeoJSONShapes.coverage(from: .polygon(square)))
        #expect(overlay.polygons.count == 1)
        #expect(overlay.polygons[0].pointCount == 5)
        let first = overlay.polygons[0].coordinate
        #expect(abs(first.latitude - 47.65) < 0.01)
    }

    @Test func polygonWithHoleKeepsInteriorRing() throws {
        var rings = square
        rings.append([[-122.38, 47.62], [-122.32, 47.62], [-122.32, 47.68], [-122.38, 47.68], [-122.38, 47.62]])
        let overlay = try #require(GeoJSONShapes.coverage(from: .polygon(rings)))
        #expect(overlay.polygons[0].interiorPolygons?.count == 1)
    }

    @Test func multiPolygonKeepsEveryPolygon() throws {
        let second: [[[Double]]] = [[[-122.0, 47.0], [-121.9, 47.0], [-121.9, 47.1], [-122.0, 47.0]]]
        let overlay = try #require(GeoJSONShapes.coverage(from: .multiPolygon([square, second])))
        #expect(overlay.polygons.count == 2)
    }

    @Test func nullGeometryProducesNoOverlay() {
        #expect(GeoJSONShapes.coverage(from: nil) == nil)
        #expect(GeoJSONShapes.flightBuffer(from: nil) == nil)
        #expect(GeoJSONShapes.flightLine(from: nil) == nil)
    }

    @Test func lineStringBecomesPolyline() throws {
        let line = try #require(GeoJSONShapes.flightLine(from: .lineString([[-122.3, 47.4], [-118.4, 33.9]])))
        #expect(line.pointCount == 2)
        let end = line.points()[1].coordinate
        #expect(abs(end.longitude - -118.4) < 0.0001)
        #expect(abs(end.latitude - 33.9) < 0.0001)
    }

    @Test func multiLineStringUsesFirstLine() throws {
        let line = try #require(GeoJSONShapes.flightLine(from: .multiLineString([[[-122.3, 47.4], [-118.4, 33.9]], [[0, 0], [1, 1]]])))
        #expect(line.pointCount == 2)
        #expect(abs(line.points()[0].coordinate.latitude - 47.4) < 0.0001)
    }

    @Test func degenerateRingsAreDropped() {
        #expect(GeoJSONShapes.coverage(from: .polygon([[[-122.4, 47.6], [-122.3, 47.6]]])) == nil)
        #expect(GeoJSONShapes.flightLine(from: .lineString([[-122.3, 47.4]])) == nil)
        let overlay = GeoJSONShapes.coverage(from: .multiPolygon([square, [[]]]))
        #expect(overlay?.polygons.count == 1)
    }

    @Test func trackShapesRememberTheirSource() throws {
        let track = try Fixtures.decode(TrackResponse.self, named: "track")
        let shapes = TrackShapes(track)
        #expect(shapes.source == track)
        #expect(shapes.coverage != nil)
        #expect(shapes.flightLines.count == track.flights.features.count)
    }

    @Test func geometryRoundTripsThroughCodable() throws {
        let geometry = GeoJSONGeometry.multiPolygon([square])
        let data = try APIJSON.encoder.encode(geometry)
        let decoded = try APIJSON.decoder.decode(GeoJSONGeometry.self, from: data)
        #expect(decoded == geometry)
    }

    @Test func unsupportedGeometryTypeFailsToDecode() {
        let data = Data(#"{"type":"GeometryCollection","geometries":[]}"#.utf8)
        #expect(throws: DecodingError.self) {
            try APIJSON.decoder.decode(GeoJSONGeometry.self, from: data)
        }
    }
}
