import CoreLocation
import Foundation
import Observation

enum MapMode: String, CaseIterable, Sendable, Codable {
    case routes, heatmap

    var title: String {
        switch self {
        case .routes: "Routes"
        case .heatmap: "Heatmap"
        }
    }

    var symbol: String {
        switch self {
        case .routes: "location.north.line"
        case .heatmap: "square.grid.2x2"
        }
    }
}

enum MapScope: Sendable {
    case mine, everyone
}

struct MapConfiguration: Sendable, Equatable, Codable {
    static let defaultBufferM = 500
    static let bufferRangeM = 100...5000

    var mode: MapMode = .routes
    var range: DateRangeSelection = .preset(.all)
    var device: String?
    var flightsShown = false
    var bufferM = defaultBufferM

    var trackRequest: TrackRequest {
        TrackRequest(range: range, device: device, bufferM: bufferM)
    }

    var heatmapRequest: HeatmapRequest {
        HeatmapRequest(range: range, device: device)
    }
}

enum LoadPhase: Equatable {
    case idle
    case loading
    case computing
    case failed(String)
}

@MainActor
@Observable
final class MapScreenModel {
    let scope: MapScope
    private let store: TrackStore
    private let defaults: UserDefaults
    private static let configurationKey = "mapConfiguration"

    var configuration: MapConfiguration {
        didSet { persistConfiguration() }
    }

    private(set) var track: CacheEntry<TrackResponse>?
    private(set) var heatmap: CacheEntry<HeatmapResponse>?
    private(set) var everyone: CacheEntry<AggregateFeature>?
    private(set) var phase: LoadPhase = .idle
    private(set) var showingSavedData = false
    private(set) var overlays: MapOverlaySet = .empty
    private(set) var fitGeneration = 0
    private(set) var focus: MapFocus?

    private var everyoneCoverage: CoverageOverlay?
    private var everyoneCoverageTask: Task<Void, Never>?
    private var trackShapes: TrackShapes?
    private var trackShapesTask: Task<Void, Never>?
    private var heatOverlay: HeatmapOverlay?
    private var heatGridTask: Task<Void, Never>?
    private var loadTask: Task<Void, Never>?
    private var fittedKeys: Set<String> = []
    private var loadedKey: String?

    init(scope: MapScope, store: TrackStore, defaults: UserDefaults = .standard) {
        self.scope = scope
        self.store = store
        self.defaults = defaults
        if scope == .mine,
           let data = defaults.data(forKey: Self.configurationKey),
           let saved = try? JSONDecoder().decode(MapConfiguration.self, from: data) {
            configuration = saved
        } else {
            configuration = MapConfiguration()
        }
    }

    // MARK: Derived state

    var stats: StatBlock? {
        switch scope {
        case .mine:
            guard let stats = track?.value.stats else { return nil }
            return StatFormatter.combined(stats, flightsIncluded: configuration.flightsShown)
        case .everyone:
            return everyone?.value.properties.statBlock
        }
    }

    var statVariant: StatVariant {
        switch scope {
        case .mine: .mine(flightsIncluded: configuration.flightsShown)
        case .everyone: .everyone
        }
    }

    var statTiles: [StatTile] {
        stats.map { StatFormatter.tiles(for: $0, variant: statVariant) } ?? []
    }

    var computedAt: Date? {
        switch scope {
        case .mine:
            switch configuration.mode {
            case .routes: track.map { Date(timeIntervalSince1970: TimeInterval($0.value.computedAt)) }
            case .heatmap: heatmap.map { Date(timeIntervalSince1970: TimeInterval($0.value.computedAt)) }
            }
        case .everyone:
            everyone?.storedAt
        }
    }

    var hasData: Bool {
        switch scope {
        case .mine: configuration.mode == .routes ? track != nil : heatmap != nil
        case .everyone: everyone != nil
        }
    }

    var flightCount: Int {
        track?.value.flights.features.count ?? 0
    }

    /// Identifies what the map is showing for fit-once tracking. Buffer and the
    /// flights toggle restyle the same view, so they are left out.
    var viewKey: String {
        switch scope {
        case .mine: "\(configuration.mode.rawValue)|\(configuration.range.cacheKey)|\(configuration.device ?? "all")"
        case .everyone: "everyone"
        }
    }

    // MARK: Actions

    /// The flights toggle is a view flag read by the map directly, so only changes
    /// that alter what the server is asked for trigger a load.
    func configurationChanged(from previous: MapConfiguration) {
        if previous.bufferM != configuration.bufferM {
            let store = store
            Task { await store.invalidateTracks() }
        }
        guard previous.mode != configuration.mode || previous.trackRequest != configuration.trackRequest else { return }
        reload(refresh: false)
    }

    func reload(refresh: Bool = false) {
        loadTask?.cancel()
        let key = viewKey
        loadTask = Task { [weak self] in
            guard let self else { return }
            await self.performLoad(key: key, refresh: refresh)
        }
    }

    func focus(on coordinate: CLLocationCoordinate2D) {
        focus = MapFocus(latitude: coordinate.latitude, longitude: coordinate.longitude,
                         generation: (focus?.generation ?? 0) + 1)
    }

    func reset() {
        loadTask?.cancel()
        trackShapesTask?.cancel()
        everyoneCoverageTask?.cancel()
        heatGridTask?.cancel()
        track = nil
        heatmap = nil
        everyone = nil
        everyoneCoverage = nil
        trackShapes = nil
        heatOverlay = nil
        overlays = .empty
        focus = nil
        fittedKeys = []
        loadedKey = nil
        phase = .idle
        showingSavedData = false
    }

    // MARK: Loading

    private func performLoad(key: String, refresh: Bool) async {
        phase = .loading
        showingSavedData = false
        do {
            switch scope {
            case .mine:
                switch configuration.mode {
                case .routes:
                    let request = configuration.trackRequest
                    if !refresh, let cached = await store.cachedTrack(request) {
                        apply(track: cached, key: key)
                    }
                    for try await event in await store.loadTrack(request, refresh: refresh) {
                        try Task.checkCancellation()
                        switch event {
                        case .computing: phase = .computing
                        case .ready(let entry): apply(track: entry, key: key)
                        }
                    }
                case .heatmap:
                    let request = configuration.heatmapRequest
                    if !refresh, let cached = await store.cachedHeatmap(request) {
                        apply(heatmap: cached, key: key)
                    }
                    for try await event in await store.loadHeatmap(request, refresh: refresh) {
                        try Task.checkCancellation()
                        switch event {
                        case .computing: phase = .computing
                        case .ready(let entry): apply(heatmap: entry, key: key)
                        }
                    }
                }
            case .everyone:
                if !refresh, let cached = await store.cachedEveryone() {
                    apply(everyone: cached, key: key)
                }
                for try await event in await store.loadEveryone(refresh: refresh) {
                    try Task.checkCancellation()
                    switch event {
                    case .computing: phase = .computing
                    case .ready(let entry): apply(everyone: entry, key: key)
                    }
                }
            }
            phase = .idle
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled else { return }
            if hasData, loadedKey == key, case APIError.network = error {
                showingSavedData = true
                phase = .idle
            } else {
                phase = .failed((error as? APIError)?.errorDescription ?? error.localizedDescription)
            }
        }
    }

    private func apply(track entry: CacheEntry<TrackResponse>, key: String) {
        track = entry
        loadedKey = key
        trackShapesTask?.cancel()
        let response = entry.value
        let current = trackShapes?.source
        trackShapesTask = Task { [weak self] in
            let shapes = await Task.detached(priority: .userInitiated) { () -> TrackShapes? in
                current == response ? nil : TrackShapes(response)
            }.value
            guard !Task.isCancelled, let self else { return }
            if let shapes { self.trackShapes = shapes }
            self.rebuildOverlays()
            self.fitIfNeeded(key: key)
        }
    }

    private func apply(heatmap entry: CacheEntry<HeatmapResponse>, key: String) {
        heatmap = entry
        loadedKey = key
        heatGridTask?.cancel()
        let cells = entry.value.cells
        let cellDeg = entry.value.cellDeg
        heatGridTask = Task { [weak self] in
            let grid = await Task.detached(priority: .userInitiated) { HeatGrid(cells: cells, cellDeg: cellDeg) }.value
            guard !Task.isCancelled, let self else { return }
            self.heatOverlay = HeatmapOverlay(grid: grid)
            self.rebuildOverlays()
            self.fitIfNeeded(key: key)
        }
    }

    private func apply(everyone entry: CacheEntry<AggregateFeature>, key: String) {
        let unchanged = everyone?.value == entry.value && everyoneCoverage != nil
        everyone = entry
        loadedKey = key
        guard !unchanged else { return }
        everyoneCoverageTask?.cancel()
        let geometry = entry.value.geometry
        everyoneCoverageTask = Task { [weak self] in
            let coverage = await Task.detached(priority: .userInitiated) {
                CoverageBox(GeoJSONShapes.coverage(from: geometry))
            }.value
            guard !Task.isCancelled, let self else { return }
            self.everyoneCoverage = coverage.overlay
            self.rebuildOverlays()
            self.fitIfNeeded(key: key)
        }
    }

    private func rebuildOverlays() {
        var set = MapOverlaySet()
        switch scope {
        case .mine:
            switch configuration.mode {
            case .routes:
                set.coverage = trackShapes?.coverage
                set.flightBuffer = trackShapes?.flightBuffer
                set.flightLines = trackShapes?.flightLines ?? []
            case .heatmap:
                set.heatmap = heatOverlay
            }
        case .everyone:
            set.coverage = everyoneCoverage
        }
        overlays = set
    }

    private func fitIfNeeded(key: String) {
        guard !fittedKeys.contains(key), !overlays.fitRegions.isEmpty else { return }
        fittedKeys.insert(key)
        fitGeneration += 1
    }

    private func persistConfiguration() {
        guard scope == .mine, let data = try? JSONEncoder().encode(configuration) else { return }
        defaults.set(data, forKey: Self.configurationKey)
    }
}
