import Foundation
import Synchronization
import Testing
@testable import WhereHaveIBeen

final class StubURLProtocol: URLProtocol {
    static let handler = Mutex<(@Sendable (URLRequest) -> (status: Int, headers: [String: String], body: Data))?>(nil)

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler.withLock({ $0 }) else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        let result = handler(request)
        let response = HTTPURLResponse(url: request.url!, statusCode: result.status, httpVersion: nil, headerFields: result.headers)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: result.body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

struct APIClientTests {
    private let credentials = Credentials(username: "roman", password: "secret")

    private func makeClient() -> APIClient {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        return APIClient(baseURL: { APIClient.productionBaseURL }, session: URLSession(configuration: configuration))
    }

    @Test func devicesFixtureDecodes() throws {
        let devices = try Fixtures.decode(DevicesResponse.self, named: "devices")
        #expect(devices == DevicesResponse(username: "roman", devices: ["phone", "ipad"]))
    }

    @Test func trackFixtureDecodes() throws {
        let track = try Fixtures.decode(TrackResponse.self, named: "track")
        #expect(track.bufferM == 500)
        #expect(track.computedAt == 1_789_000_000)
        #expect(track.latestTst == 1_788_999_000)
        #expect(track.range.from == nil)
        #expect(track.flights.features.count == 1)
        #expect(track.flights.features[0].properties.distanceKm == 1543.2)
        #expect(track.stats.driving.distanceKm == 48709.3)
        #expect(track.stats.flying.maxVelKmh == 912.5)
        guard case .multiPolygon(let polygons)? = track.driving.geometry else {
            Issue.record("expected a MultiPolygon")
            return
        }
        #expect(polygons.count == 5)
        #expect(polygons[0].count == 2)
    }

    @Test func heatmapFixtureDecodes() throws {
        let heatmap = try Fixtures.decode(HeatmapResponse.self, named: "heatmap")
        #expect(heatmap.cellDeg == 0.0006)
        #expect(heatmap.cells.count > 100)
        #expect(heatmap.cells.allSatisfy { $0.count == 3 })
    }

    @Test func aggregateFixtureDecodes() throws {
        let aggregate = try Fixtures.decode(AggregateFeature.self, named: "aggregate")
        #expect(aggregate.properties.areaKm2 == 82470.2)
        #expect(aggregate.properties.statBlock.maxVelKmh == 987)
        #expect(aggregate.geometry != nil)
    }

    @Test func nullGeometryDecodesAsNil() throws {
        let data = Data(#"{"type":"Feature","properties":{},"geometry":null}"#.utf8)
        let feature = try APIJSON.decoder.decode(GeoJSONFeature<EmptyProperties>.self, from: data)
        #expect(feature.geometry == nil)
    }

    @Test func statusCodesMapToErrorsAndStates() throws {
        typealias Outcome = FetchOutcome<DevicesResponse>
        let body = Data(#"{"username":"roman","devices":["phone"]}"#.utf8)
        guard case .ready(let devices) = try APIClient.interpret(status: 200, data: body) as Outcome else {
            Issue.record("expected ready")
            return
        }
        #expect(devices.devices == ["phone"])

        guard case .computing(let retry, _) = try APIClient.interpret(status: 202, data: Data()) as Outcome else {
            Issue.record("expected computing")
            return
        }
        #expect(retry == APIClient.computingPollInterval)

        guard case .computing(let warming, _) = try APIClient.interpret(status: 503, data: Data()) as Outcome else {
            Issue.record("expected computing")
            return
        }
        #expect(warming == APIClient.warmingPollInterval)

        let computing = Data(#"{"status":"computing","progress":{"stage":"building","done":3,"total":4}}"#.utf8)
        guard case .computing(_, let progress) = try APIClient.interpret(status: 202, data: computing) as Outcome else {
            Issue.record("expected computing")
            return
        }
        #expect(progress == ComputeProgress(stage: "building", done: 3, total: 4))
        #expect(progress?.fraction == 0.75)
        #expect(progress?.stageText == "building corridors")
        #expect(ComputeProgress(stage: "importing", done: 2, total: 3).stageText == "adding imported history")
        #expect(ComputeProgress(stage: "fetching", done: 2, total: 3).percent == 67)

        #expect(throws: APIError.unauthorized) {
            try APIClient.interpret(status: 401, data: Data()) as Outcome
        }
        #expect(throws: APIError.forbidden) {
            try APIClient.interpret(status: 403, data: Data()) as Outcome
        }
        #expect(throws: APIError.badRequest("unknown device")) {
            try APIClient.interpret(status: 400, data: Data(#"{"error":"unknown device"}"#.utf8)) as Outcome
        }
        #expect(throws: APIError.unexpectedStatus(500)) {
            try APIClient.interpret(status: 500, data: Data()) as Outcome
        }
        #expect(throws: APIError.self) {
            try APIClient.interpret(status: 200, data: Data("nope".utf8)) as Outcome
        }
    }

    @Test func requestCarriesBasicAuthAndQuery() async throws {
        let client = makeClient()
        let body = try Fixtures.data(named: "devices")
        StubURLProtocol.handler.withLock { handler in
            handler = { request in
                let authorized = request.value(forHTTPHeaderField: "Authorization") == "Basic cm9tYW46c2VjcmV0"
                let path = request.url?.path() == "/api/me/devices"
                return authorized && path ? (200, ["Content-Type": "application/json"], body) : (401, [:], Data())
            }
        }
        let devices = try await client.devices(credentials: credentials)
        #expect(devices.username == "roman")

        await #expect(throws: APIError.unauthorized) {
            _ = try await client.devices(credentials: Credentials(username: "roman", password: "nope"))
        }
    }

    @Test func networkFailureIsTyped() async {
        let client = makeClient()
        StubURLProtocol.handler.withLock { $0 = nil }
        do {
            _ = try await client.devices(credentials: credentials)
            Issue.record("expected a network error")
        } catch let error as APIError {
            guard case .network = error else {
                Issue.record("expected .network, got \(error)")
                return
            }
        } catch {
            Issue.record("unexpected error \(error)")
        }
    }
}
