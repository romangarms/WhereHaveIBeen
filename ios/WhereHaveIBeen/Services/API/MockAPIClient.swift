import Foundation

/// Serves the committed fixtures. The password "wrong" is rejected so the sign-in
/// error path can be exercised, and a `refresh` request answers `computing` for a
/// few polls, reporting progress, so the progress strip can be seen.
actor MockAPIClient: APIClientProtocol {
    private static let computingSteps: [ComputeProgress?] = [
        nil,
        ComputeProgress(stage: "fetching", done: 1, total: 6),
        ComputeProgress(stage: "fetching", done: 3, total: 6),
        ComputeProgress(stage: "importing", done: 5, total: 6),
        ComputeProgress(stage: "building", done: 6, total: 6),
    ]
    private var pendingPolls: [String: Int] = [:]

    func devices(credentials: Credentials) async throws -> DevicesResponse {
        try await Task.sleep(for: .milliseconds(300))
        guard credentials.password != "wrong" else { throw APIError.unauthorized }
        return try Fixtures.decode(DevicesResponse.self, named: "devices")
    }

    func track(_ query: TrackQuery, credentials: Credentials) async throws -> FetchOutcome<TrackResponse> {
        try await simulate(key: "track", refresh: query.refresh)
    }

    func heatmap(_ query: HeatmapQuery, credentials: Credentials) async throws -> FetchOutcome<HeatmapResponse> {
        try await simulate(key: "heatmap", refresh: query.refresh)
    }

    func aggregateRoads(refresh: Bool, credentials: Credentials) async throws -> FetchOutcome<AggregateFeature> {
        try await simulate(key: "aggregate", refresh: refresh)
    }

    private func simulate<Value: Decodable & Sendable>(key: String, refresh: Bool) async throws -> FetchOutcome<Value> {
        try await Task.sleep(for: .milliseconds(400))
        if refresh {
            pendingPolls[key] = 0
        }
        if let step = pendingPolls[key] {
            if step < Self.computingSteps.count {
                pendingPolls[key] = step + 1
                return .computing(retryAfter: 1, progress: Self.computingSteps[step])
            }
            pendingPolls[key] = nil
        }
        return .ready(try Fixtures.decode(Value.self, named: key))
    }
}

enum Fixtures {
    private final class Anchor {}

    static func data(named name: String) throws -> Data {
        guard let url = Bundle(for: Anchor.self).url(forResource: name, withExtension: "json") else {
            throw APIError.decoding("Missing fixture \(name).json")
        }
        return try Data(contentsOf: url)
    }

    static func decode<Value: Decodable>(_ type: Value.Type, named name: String) throws -> Value {
        try APIJSON.decoder.decode(type, from: data(named: name))
    }
}
