import Foundation

/// Same presets as the web app's time frame buttons, in the same order.
enum RangePreset: String, CaseIterable, Sendable, Codable {
    case all, month, week, hours48 = "48h", hours24 = "24h"

    var title: String {
        switch self {
        case .all: "All time"
        case .month: "Month"
        case .week: "Week"
        case .hours48: "48h"
        case .hours24: "24h"
        }
    }
}

enum DateRangeSelection: Sendable, Hashable, Codable {
    case preset(RangePreset)
    case custom(from: Date, to: Date)

    func resolve(now: Date, calendar: Calendar = .current) -> (from: Date?, to: Date?) {
        switch self {
        case .preset(.all): (nil, nil)
        case .preset(.month): (calendar.date(byAdding: .month, value: -1, to: now), nil)
        case .preset(.week): (calendar.date(byAdding: .day, value: -7, to: now), nil)
        case .preset(.hours48): (now.addingTimeInterval(-48 * 3600), nil)
        case .preset(.hours24): (now.addingTimeInterval(-24 * 3600), nil)
        case .custom(let from, let to): (from, to)
        }
    }

    /// Presets are relative to now, so the key names the preset rather than the
    /// resolved timestamps; otherwise every load would miss the cache.
    var cacheKey: String {
        switch self {
        case .preset(let preset): preset.rawValue
        case .custom(let from, let to):
            "custom-\(Int(from.timeIntervalSince1970))-\(Int(to.timeIntervalSince1970))"
        }
    }

    var title: String {
        switch self {
        case .preset(let preset): preset.title
        case .custom(let from, let to):
            "\(from.formatted(date: .abbreviated, time: .shortened)) – \(to.formatted(date: .abbreviated, time: .shortened))"
        }
    }
}

struct TrackRequest: Sendable, Hashable {
    var range: DateRangeSelection
    var device: String?
    var bufferM: Int
}

struct HeatmapRequest: Sendable, Hashable {
    var range: DateRangeSelection
    var device: String?
}

enum CacheKey {
    static let trackPrefix = "track|"
    static let heatmapPrefix = "heatmap|"
    static let everyone = "everyone"

    static func track(_ request: TrackRequest) -> String {
        "\(trackPrefix)\(request.range.cacheKey)|\(request.device ?? "all")|\(request.bufferM)"
    }

    static func heatmap(_ request: HeatmapRequest) -> String {
        "\(heatmapPrefix)\(request.range.cacheKey)|\(request.device ?? "all")"
    }
}

enum LoadEvent<Value: Codable & Sendable>: Sendable {
    case computing(retryAfter: TimeInterval, progress: ComputeProgress?)
    case ready(CacheEntry<Value>)
}

actor TrackStore {
    private let api: any APIClientProtocol
    private let credentials: any CredentialStore
    private let cache: DiskCache
    let pollTimeout: Duration

    init(api: any APIClientProtocol, credentials: any CredentialStore, cache: DiskCache, pollTimeout: Duration = .seconds(300)) {
        self.api = api
        self.credentials = credentials
        self.cache = cache
        self.pollTimeout = pollTimeout
    }

    func cachedTrack(_ request: TrackRequest) async -> CacheEntry<TrackResponse>? {
        await cache.read(CacheEntry<TrackResponse>.self, key: CacheKey.track(request))
    }

    func cachedHeatmap(_ request: HeatmapRequest) async -> CacheEntry<HeatmapResponse>? {
        await cache.read(CacheEntry<HeatmapResponse>.self, key: CacheKey.heatmap(request))
    }

    func cachedEveryone() async -> CacheEntry<AggregateFeature>? {
        await cache.read(CacheEntry<AggregateFeature>.self, key: CacheKey.everyone)
    }

    func loadTrack(_ request: TrackRequest, refresh: Bool) -> AsyncThrowingStream<LoadEvent<TrackResponse>, any Error> {
        let (from, to) = request.range.resolve(now: Date())
        let api = api
        return load(key: CacheKey.track(request)) { credentials, isPoll in
            let query = TrackQuery(from: from, to: to, device: request.device, bufferM: request.bufferM, refresh: refresh && !isPoll)
            return try await api.track(query, credentials: credentials)
        }
    }

    func loadHeatmap(_ request: HeatmapRequest, refresh: Bool) -> AsyncThrowingStream<LoadEvent<HeatmapResponse>, any Error> {
        let (from, to) = request.range.resolve(now: Date())
        let api = api
        return load(key: CacheKey.heatmap(request)) { credentials, isPoll in
            let query = HeatmapQuery(from: from, to: to, device: request.device, refresh: refresh && !isPoll)
            return try await api.heatmap(query, credentials: credentials)
        }
    }

    func loadEveryone(refresh: Bool) -> AsyncThrowingStream<LoadEvent<AggregateFeature>, any Error> {
        let api = api
        return load(key: CacheKey.everyone) { credentials, isPoll in
            try await api.aggregateRoads(refresh: refresh && !isPoll, credentials: credentials)
        }
    }

    func invalidateTracks() async {
        await cache.removeAll(prefix: CacheKey.trackPrefix)
    }

    func clearAll() async {
        await cache.clear()
    }

    func cacheSize() async -> Int64 {
        await cache.totalSize()
    }

    /// Polls while the server answers `computing`. Only the first request carries
    /// `refresh=1`; repeating it on every poll would restart the compute each time.
    private func load<Value: Codable & Sendable>(
        key: String,
        fetch: @escaping @Sendable (Credentials, _ isPoll: Bool) async throws -> FetchOutcome<Value>
    ) -> AsyncThrowingStream<LoadEvent<Value>, any Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    guard let credentials = try await credentials.load() else { throw APIError.noCredentials }
                    let clock = ContinuousClock()
                    let start = clock.now
                    var isPoll = false
                    while true {
                        switch try await fetch(credentials, isPoll) {
                        case .ready(let value):
                            let entry = CacheEntry(value: value, storedAt: Date())
                            try? await cache.write(entry, key: key)
                            continuation.yield(.ready(entry))
                            continuation.finish()
                            return
                        case .computing(let retryAfter, let progress):
                            continuation.yield(.computing(retryAfter: retryAfter, progress: progress))
                            if clock.now - start > pollTimeout { throw APIError.timedOut }
                            try await Task.sleep(for: .seconds(min(max(retryAfter, 1), 60)))
                            isPoll = true
                        }
                    }
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}
