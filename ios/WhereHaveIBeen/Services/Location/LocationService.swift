import CoreLocation

enum LocationError: Error {
    case denied
}

/// One-shot access to the phone's position. The first call prompts for when-in-use
/// access; the service session is kept so the prompt is not torn down mid-answer.
@MainActor
final class LocationService {
    private var session: CLServiceSession?

    func currentLocation() async throws -> CLLocation {
        if session == nil {
            session = CLServiceSession(authorization: .whenInUse)
        }
        for try await update in CLLocationUpdate.liveUpdates() {
            if update.authorizationDenied || update.authorizationDeniedGlobally || update.authorizationRestricted {
                throw LocationError.denied
            }
            if let location = update.location {
                return location
            }
        }
        throw CancellationError()
    }
}
