import MapKit
import Testing
@testable import WhereHaveIBeen

struct FitRegionTests {
    private func region(lonRange: ClosedRange<Double>, latRange: ClosedRange<Double>) -> FitRegion {
        let topLeft = MKMapPoint(CLLocationCoordinate2D(latitude: latRange.upperBound, longitude: lonRange.lowerBound))
        let bottomRight = MKMapPoint(CLLocationCoordinate2D(latitude: latRange.lowerBound, longitude: lonRange.upperBound))
        let rect = MKMapRect(
            x: topLeft.x, y: topLeft.y,
            width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y)
        return FitRegion(rect: rect, weight: rect.width * rect.height)
    }

    private let westCoast = (lon: -124.2...(-119.7), lat: 36.1...49.5)
    private let europe = (lon: 6.7...11.4, lat: 44.5...50.4)
    private let oahu = (lon: -158.3...(-157.6), lat: 21.2...21.7)
    private let kauai = (lon: -159.7...(-159.3), lat: 21.9...22.2)

    private func degreesWide(_ degrees: Double) -> MKMapSize {
        MKMapSize(width: MKMapSize.world.width * degrees / 360, height: MKMapSize.world.height)
    }

    @Test func everythingFitsWhenTheScreenIsWideEnough() throws {
        let regions = [westCoast, europe, oahu].map { region(lonRange: $0.lon, latRange: $0.lat) }
        let rect = try #require(FitRegion.bestRect(regions, within: degreesWide(200)))
        #expect(abs(MKMapPoint(x: rect.minX, y: rect.minY).coordinate.longitude - (-158.3)) < 0.01)
        #expect(abs(MKMapPoint(x: rect.maxX, y: rect.maxY).coordinate.longitude - 11.4) < 0.01)
    }

    @Test func fallsBackToHeaviestClusterWhenClamped() throws {
        let regions = [oahu, westCoast, europe, kauai].map { region(lonRange: $0.lon, latRange: $0.lat) }
        let rect = try #require(FitRegion.bestRect(regions, within: degreesWide(120)))
        let west = MKMapPoint(x: rect.minX, y: rect.minY).coordinate.longitude
        let east = MKMapPoint(x: rect.maxX, y: rect.maxY).coordinate.longitude
        #expect(abs(west - (-159.7)) < 0.01, "Hawaii and the West coast fit together")
        #expect(abs(east - (-119.7)) < 0.01, "Europe is left out")
    }

    @Test func clusterWeightBeatsSingleLargestRegion() throws {
        var pieces = (0..<10).map { i in
            region(lonRange: (6.0 + Double(i) * 2)...(8.0 + Double(i) * 2), latRange: 44.0...50.0)
        }
        let big = region(lonRange: -124.0...(-118.0), latRange: 36.0...48.0)
        pieces.append(big)
        let rect = try #require(FitRegion.bestRect(pieces, within: degreesWide(60)))
        #expect(MKMapPoint(x: rect.minX, y: rect.minY).coordinate.longitude > 0, "ten small pieces outweigh one big one")
    }

    @Test func emptyInputHasNoRect() {
        #expect(FitRegion.bestRect([], within: degreesWide(360)) == nil)
    }

    @Test func focusRectIsCentredAndSpansTheConfiguredDistance() {
        let focus = MapFocus(latitude: 47.62, longitude: -122.33, generation: 1)
        let rect = focus.rect
        let centre = MKMapPoint(x: rect.midX, y: rect.midY).coordinate
        #expect(abs(centre.latitude - 47.62) < 1e-6)
        #expect(abs(centre.longitude - (-122.33)) < 1e-6)
        let west = MKMapPoint(x: rect.minX, y: rect.midY)
        let east = MKMapPoint(x: rect.maxX, y: rect.midY)
        #expect(abs(west.distance(to: east) - MapFocus.spanMeters) < 50)
    }
}
