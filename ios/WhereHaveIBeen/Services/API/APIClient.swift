import Foundation

enum APIError: Error, Sendable, Equatable, LocalizedError {
    case noCredentials
    case unauthorized
    case forbidden
    case badRequest(String)
    case unexpectedStatus(Int)
    case decoding(String)
    case network(String)
    case timedOut

    var errorDescription: String? {
        switch self {
        case .noCredentials: "Not signed in"
        case .unauthorized: "Wrong username or password"
        case .forbidden: "Account inactive"
        case .badRequest(let message): message
        case .unexpectedStatus(let code): "Server returned \(code)"
        case .decoding(let detail): "Could not read the server response (\(detail))"
        case .network(let detail): detail
        case .timedOut: "The server is still building your map. Try again in a minute."
        }
    }
}

enum FetchOutcome<Value: Sendable>: Sendable {
    case ready(Value)
    case computing(retryAfter: TimeInterval, progress: ComputeProgress? = nil)
}

protocol APIClientProtocol: Sendable {
    func devices(credentials: Credentials) async throws -> DevicesResponse
    func track(_ query: TrackQuery, credentials: Credentials) async throws -> FetchOutcome<TrackResponse>
    func heatmap(_ query: HeatmapQuery, credentials: Credentials) async throws -> FetchOutcome<HeatmapResponse>
    func aggregateRoads(refresh: Bool, credentials: Credentials) async throws -> FetchOutcome<AggregateFeature>
}

actor APIClient: APIClientProtocol {
    static let productionBaseURL = URL(string: "https://mini.romangarms.com")!
    /// The same cadence as the web app: a 202 poll is a lock check on the
    /// server, so it is tight; a 503 means the aggregate cache is warming.
    static let computingPollInterval: TimeInterval = 1
    static let warmingPollInterval: TimeInterval = 5

    private let baseURL: @Sendable () -> URL
    private let session: URLSession

    init(baseURL: @escaping @Sendable () -> URL, session: URLSession = APIClient.makeSession()) {
        self.baseURL = baseURL
        self.session = session
    }

    static func makeSession() -> URLSession {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 60
        configuration.waitsForConnectivity = false
        return URLSession(configuration: configuration)
    }

    func devices(credentials: Credentials) async throws -> DevicesResponse {
        switch try await fetch(.devices, credentials: credentials) as FetchOutcome<DevicesResponse> {
        case .ready(let value): return value
        case .computing: throw APIError.unexpectedStatus(202)
        }
    }

    func track(_ query: TrackQuery, credentials: Credentials) async throws -> FetchOutcome<TrackResponse> {
        try await fetch(.track(query), credentials: credentials)
    }

    func heatmap(_ query: HeatmapQuery, credentials: Credentials) async throws -> FetchOutcome<HeatmapResponse> {
        try await fetch(.heatmap(query), credentials: credentials)
    }

    func aggregateRoads(refresh: Bool, credentials: Credentials) async throws -> FetchOutcome<AggregateFeature> {
        try await fetch(.aggregateRoads(refresh: refresh), credentials: credentials)
    }

    private func fetch<Value: Decodable & Sendable>(
        _ endpoint: Endpoint, credentials: Credentials
    ) async throws -> FetchOutcome<Value> {
        var request = URLRequest(url: endpoint.url(baseURL: baseURL()))
        request.setValue(credentials.basicAuthorizationValue, forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.network(error.localizedDescription)
        }
        guard let http = response as? HTTPURLResponse else {
            throw APIError.network("Not an HTTP response")
        }
        return try Self.interpret(status: http.statusCode, data: data)
    }

    static func interpret<Value: Decodable>(status: Int, data: Data) throws -> FetchOutcome<Value> {
        switch status {
        case 200:
            do {
                return .ready(try APIJSON.decoder.decode(Value.self, from: data))
            } catch {
                throw APIError.decoding(String(describing: error))
            }
        case 202:
            let progress = (try? APIJSON.decoder.decode(ComputingBody.self, from: data))?.progress
            return .computing(retryAfter: computingPollInterval, progress: progress)
        case 503:
            return .computing(retryAfter: warmingPollInterval)
        case 400:
            let message = (try? APIJSON.decoder.decode(APIErrorBody.self, from: data))?.error ?? "Bad request"
            throw APIError.badRequest(message)
        case 401:
            throw APIError.unauthorized
        case 403:
            throw APIError.forbidden
        default:
            throw APIError.unexpectedStatus(status)
        }
    }
}
