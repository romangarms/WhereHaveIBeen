import Foundation

/// Snake-case keys on the wire (`computed_at`, `buffer_m`, ...) map onto camel-case
/// properties through the key strategy, so DTOs carry no CodingKeys of their own.
enum APIJSON {
    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return decoder
    }()

    static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        return encoder
    }()
}

struct DevicesResponse: Codable, Sendable, Equatable {
    var username: String
    var devices: [String]
}

struct APIRange: Codable, Sendable, Equatable {
    var from: String?
    var to: String?
}

struct StatBlock: Codable, Sendable, Equatable {
    var distanceKm: Double
    var areaKm2: Double
    var maxAltM: Double
    var maxVelKmh: Double

    static let zero = StatBlock(distanceKm: 0, areaKm2: 0, maxAltM: 0, maxVelKmh: 0)
}

struct TrackStats: Codable, Sendable, Equatable {
    var driving: StatBlock
    var flying: StatBlock
}

struct FlightProperties: Codable, Sendable, Equatable {
    var startTst: Int
    var endTst: Int
    var distanceKm: Double
}

struct TrackResponse: Codable, Sendable, Equatable {
    var range: APIRange
    var computedAt: Int
    var latestTst: Int?
    var bufferM: Int
    var driving: GeoJSONFeature<EmptyProperties>
    var flights: GeoJSONFeatureCollection<FlightProperties>
    var flightsBuffer: GeoJSONFeature<EmptyProperties>
    var stats: TrackStats
}

struct HeatmapResponse: Codable, Sendable, Equatable {
    var range: APIRange
    var computedAt: Int
    var latestTst: Int?
    var cellDeg: Double
    /// Each entry is `[gx, gy, count]`; the cell centre is `(gx * cellDeg, gy * cellDeg)`.
    var cells: [[Int]]
}

struct AggregateProperties: Codable, Sendable, Equatable {
    var maxVel: Double
    var maxAlt: Double
    var distanceKm: Double
    var areaKm2: Double

    var statBlock: StatBlock {
        StatBlock(distanceKm: distanceKm, areaKm2: areaKm2, maxAltM: maxAlt, maxVelKmh: maxVel)
    }
}

typealias AggregateFeature = GeoJSONFeature<AggregateProperties>

struct APIErrorBody: Codable, Sendable {
    var error: String
}

/// What the server reports in a `202` body while it computes.
struct ComputeProgress: Codable, Sendable, Equatable {
    var stage: String
    var done: Int
    var total: Int

    var fraction: Double {
        total > 0 ? min(0.99, Double(done) / Double(total)) : 0
    }

    var percent: Int {
        Int((fraction * 100).rounded())
    }

    var stageText: String {
        switch stage {
        case "building": "building corridors"
        case "importing": "adding imported history"
        default: "fetching GPS history"
        }
    }
}

struct ComputingBody: Codable, Sendable {
    var progress: ComputeProgress?
}
