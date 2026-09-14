import MapKit
import SwiftUI

/// A request to centre the map on one place. `generation` makes repeated requests
/// for the same coordinate distinguishable.
struct MapFocus: Equatable {
    static let spanMeters: CLLocationDistance = 10_000

    var latitude: Double
    var longitude: Double
    var generation: Int

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    /// A square `spanMeters` across centred on the coordinate, in map units.
    var rect: MKMapRect {
        let centre = MKMapPoint(coordinate)
        let half = MKMapPointsPerMeterAtLatitude(latitude) * Self.spanMeters / 2
        return MKMapRect(x: centre.x - half, y: centre.y - half, width: half * 2, height: half * 2)
    }
}

struct MapContainer: UIViewRepresentable {
    var overlays: MapOverlaySet
    var fitGeneration: Int
    var focus: MapFocus? = nil
    var flightsVisible = false
    var bottomInset: CGFloat

    func makeUIView(context: Context) -> FittingMapView {
        let map = FittingMapView()
        map.delegate = context.coordinator
        map.preferredConfiguration = MKStandardMapConfiguration(elevationStyle: .flat, emphasisStyle: .muted)
        map.showsCompass = false
        map.showsScale = false
        map.showsUserLocation = true
        return map
    }

    func updateUIView(_ map: FittingMapView, context: Context) {
        let coordinator = context.coordinator
        // Flight overlays stay on the map and are shown or hidden through their
        // renderer's alpha, so the toggle never adds or removes overlays.
        if coordinator.flightsVisible != flightsVisible {
            coordinator.flightsVisible = flightsVisible
            for overlay in map.overlays where Coordinator.isFlight(overlay) {
                map.renderer(for: overlay)?.alpha = flightsVisible ? 1 : 0
            }
        }
        if coordinator.overlaySetID != overlays.id {
            // Overlays shared between the old and new set stay put: removing and
            // re-adding one throws away its rendered tiles and blanks the map.
            let wanted = overlays.all
            let current = map.overlays
            let wantedIDs = Set(wanted.map(ObjectIdentifier.init))
            let currentIDs = Set(current.map(ObjectIdentifier.init))
            // Flights live on their own level: MapKit re-renders every overlay on a
            // level whenever one of them changes, and the corridor is expensive.
            let added = wanted.filter { !currentIDs.contains(ObjectIdentifier($0)) }
            map.addOverlays(added.filter { !Coordinator.isFlight($0) }, level: .aboveRoads)
            map.addOverlays(added.filter(Coordinator.isFlight), level: .aboveLabels)
            map.removeOverlays(current.filter { !wantedIDs.contains(ObjectIdentifier($0)) })
            coordinator.overlaySetID = overlays.id
        }
        if coordinator.fitGeneration != fitGeneration {
            coordinator.fitGeneration = fitGeneration
            let regions = overlays.fitRegions
            if !regions.isEmpty {
                map.fit(regions, padding: padding)
            }
        }
        if let focus, coordinator.focusGeneration != focus.generation {
            coordinator.focusGeneration = focus.generation
            map.focus(on: focus, padding: padding)
        }
    }

    private var padding: UIEdgeInsets {
        UIEdgeInsets(top: 140, left: 32, bottom: bottomInset + 32, right: 32)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator: NSObject, MKMapViewDelegate {
        var overlaySetID: UUID?
        var fitGeneration = 0
        var focusGeneration = 0
        var flightsVisible = false

        static func isFlight(_ overlay: MKOverlay) -> Bool {
            overlay is FlightBufferOverlay || overlay is FlightLineOverlay
        }

        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            let renderer: MKOverlayRenderer = switch overlay {
            case let heat as HeatmapOverlay: HeatmapRenderer(overlay: heat)
            case is FlightBufferOverlay: FlightBufferRenderer(overlay: overlay)
            case is MKMultiPolygon: CoverageRenderer(overlay: overlay)
            case is MKPolyline: FlightLineRenderer(overlay: overlay)
            default: MKOverlayRenderer(overlay: overlay)
            }
            if Self.isFlight(overlay) {
                renderer.alpha = flightsVisible ? 1 : 0
            }
            return renderer
        }
    }
}

/// SwiftUI can update the representable before the map has been laid out. Fitting
/// against a zero or pre-layout size zooms to the wrong region, so the fit is held
/// until the map has its real bounds.
///
/// MapKit also refuses to zoom out past the point where the map fills the view, so
/// on a portrait phone a data set spanning half the globe gets clamped to an
/// ocean-centred view. When that happens the fit falls back to the heaviest group
/// of regions that can be shown at the minimum zoom.
final class FittingMapView: MKMapView {
    private var pendingFit: (regions: [FitRegion], padding: UIEdgeInsets)?

    func fit(_ regions: [FitRegion], padding: UIEdgeInsets) {
        pendingFit = (regions, padding)
        applyPendingFitIfPossible()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        applyPendingFitIfPossible()
    }

    func focus(on focus: MapFocus, padding: UIEdgeInsets) {
        pendingFit = nil
        setVisibleMapRect(focus.rect, edgePadding: padding, animated: true)
    }

    private func applyPendingFitIfPossible() {
        guard let pendingFit, window != nil else { return }
        let padding = pendingFit.padding
        let usable = bounds.inset(by: padding)
        guard usable.width > 0, usable.height > 0 else { return }
        self.pendingFit = nil

        let everything = pendingFit.regions.reduce(MKMapRect.null) { $0.union($1.rect) }
        guard !everything.isNull else { return }
        setVisibleMapRect(everything, edgePadding: padding, animated: false)

        let shown = usableMapRect(padding: padding)
        let tolerance = shown.insetBy(dx: -shown.width * 0.01, dy: -shown.height * 0.01)
        guard !tolerance.contains(everything) else { return }
        if let fallback = FitRegion.bestRect(pendingFit.regions, within: shown.size) {
            setVisibleMapRect(fallback, edgePadding: padding, animated: false)
        }
    }

    /// The part of the visible map rect inside the padding, in map units.
    private func usableMapRect(padding: UIEdgeInsets) -> MKMapRect {
        let visible = visibleMapRect
        let scale = visible.width / bounds.width
        return MKMapRect(
            x: visible.minX + padding.left * scale,
            y: visible.minY + padding.top * scale,
            width: visible.width - (padding.left + padding.right) * scale,
            height: visible.height - (padding.top + padding.bottom) * scale)
    }
}
