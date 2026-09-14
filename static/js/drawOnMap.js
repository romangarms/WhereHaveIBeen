// Rendering only: the corridors, flight lines and heat cells arrive finished
// from the server (see manageData.js). This file styles them and puts them on
// the Leaflet map.

let heatLayer = null;

// Flight buffers and lines are always built but only attached to the map while
// the Flights toggle is on.
let flightLayers = [];
let exploredLayers = [];
let zoomHookAttached = false;
let flightPaneCreated = false;

const EXPLORED_COLOR = '#3d6ba8';
const FLIGHT_COLOR = '#e6a23c';
const FLIGHT_LINE_COLOR = '#c98418';

// A 0.5 km buffer is sub-pixel below zoom ~9, so the polygon outline is
// thickened and the fill darkened as the map zooms out to keep it legible.
function zoomBoost() {
    const zoom = (typeof map !== 'undefined' && map) ? map.getZoom() : 12;
    return Math.max(0, 9 - zoom);
}

function exploredStyle() {
    const boost = zoomBoost();
    return {
        color: EXPLORED_COLOR, weight: 1 + boost * 0.9, opacity: Math.min(.75, .55 + boost * .04),
        fillColor: EXPLORED_COLOR, fillOpacity: Math.min(.5, .38 + boost * .025)
    };
}

// Flights sit in their own pane between the tiles (200) and the overlay pane
// (400) so the driven corridors always paint over them.
const FLIGHT_PANE = 'flights';

function ensureFlightPane() {
    if (flightPaneCreated) return;
    flightPaneCreated = true;
    map.createPane(FLIGHT_PANE).style.zIndex = 350;
}

// The flight buffer is fill-only: with an outline it turns into a solid band
// when zoomed out and hides the dashed path, which is what the legend promises.
function flightBufferStyle() {
    return { stroke: false, fillColor: FLIGHT_COLOR, fillOpacity: .15 };
}

function flightLineStyle() {
    const boost = zoomBoost();
    return { color: FLIGHT_LINE_COLOR, weight: 2.4 + boost * 0.5, opacity: .45, dashArray: '10 8' };
}

function restyleForZoom() {
    exploredLayers.forEach(layer => layer.setStyle(exploredStyle()));
    flightLayers.forEach(({ layer, style }) => layer.setStyle(style()));
}

function ensureZoomHook() {
    if (zoomHookAttached) return;
    zoomHookAttached = true;
    map.on('zoomend', restyleForZoom);
}

function flightsShown() {
    return typeof getFlightsShown === 'function' ? getFlightsShown() : true;
}

function addFlightLayer(geojson, style) {
    ensureZoomHook();
    ensureFlightPane();
    const layer = L.geoJSON(geojson, { style: style(), pane: FLIGHT_PANE });
    flightLayers.push({ layer, style });
    if (flightsShown()) layer.addTo(map);
}

/**
 * Draw the server's flight paths (a GeoJSON FeatureCollection of LineStrings).
 */
function renderFlightLines(featureCollection) {
    const features = featureCollection?.features || [];
    if (!features.length) return;
    addFlightLayer(featureCollection, flightLineStyle);
}

function setFlightLayersVisible(shown) {
    flightLayers.forEach(({ layer }) => shown ? layer.addTo(map) : layer.remove());
}

function addBaseLayer() {
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

// A flight buffer never drives the viewport: fitting to it would zoom the map
// out to an airport even while flights are hidden.
function renderCachedBuffer(buffer, color) {
    if (!buffer || !buffer.geometry) return;

    if (color === "red") {
        addFlightLayer(buffer, flightBufferStyle);
        return;
    }

    ensureZoomHook();
    let bufferLayer = L.geoJSON(buffer, { style: exploredStyle() }).addTo(map);
    exploredLayers.push(bufferLayer);

    try {
        const bounds = bufferLayer.getBounds();
        map.fitBounds(bounds);
    } catch (err) {
        console.log("No bounds found for buffer, err: " + err);
    }
}

// --- Heatmap tunables -------------------------------------------------------
// Data-driven scaling: the color ceiling is the Nth-percentile cell intensity (not
// the single busiest cell), so one extreme outlier can't wash everywhere else out.
const HEATMAP_SCALE_PERCENTILE = 0.99;
// Visual-only constants (pixels / appearance — intentionally independent of the data).
const HEATMAP_RADIUS_PX = 12;
const HEATMAP_BLUR_PX = 10;
const HEATMAP_MIN_OPACITY = 0.25;
const HEATMAP_MAX_ZOOM = 12;
const HEATMAP_GRADIENT = { 0.0: 'blue', 0.3: 'cyan', 0.5: 'lime', 0.7: 'yellow', 1.0: 'red' };
// ---------------------------------------------------------------------------

/**
 * Render the server's visit-frequency grid as a Leaflet.heat layer. Each cell
 * is [gx, gy, count] with centre (gx * cellDeg, gy * cellDeg) as (lon, lat);
 * it becomes a heat point weighted by a logarithmic function of its count.
 */
function renderHeatCells(cells, cellDeg) {
    let start = Date.now();

    // Logarithmic intensity scaling: a place visited 100+ times would otherwise
    // pin `max` so high that everywhere else collapses to a single faint shade.
    // log(count + 1) compresses that range so frequency differences spread across
    // the whole gradient (a once-driven road stays cool; a daily haunt goes hot).
    const heatData = [];
    const bounds = [];
    const intensities = [];
    for (const [gx, gy, count] of cells || []) {
        const lat = gy * cellDeg;
        const lng = gx * cellDeg;
        const intensity = Math.log(count + 1);
        heatData.push([lat, lng, intensity]);
        bounds.push([lat, lng]);
        intensities.push(intensity);
    }

    // Scale to a high percentile of cell intensities rather than the absolute max,
    // so a single freak outlier cell doesn't compress the rest of the map. Cells
    // above this ceiling simply saturate to the hottest color.
    intensities.sort((a, b) => a - b);
    const pIdx = Math.floor(HEATMAP_SCALE_PERCENTILE * (intensities.length - 1));
    const maxIntensity = intensities.length ? intensities[pIdx] : 1;

    heatLayer = L.heatLayer(heatData, {
        radius: HEATMAP_RADIUS_PX,
        blur: HEATMAP_BLUR_PX,
        minOpacity: HEATMAP_MIN_OPACITY,
        maxZoom: HEATMAP_MAX_ZOOM,
        max: maxIntensity || 1,
        gradient: HEATMAP_GRADIENT
    }).addTo(map);

    if (bounds.length) {
        try {
            map.fitBounds(bounds);
        } catch (err) {
            console.log("No bounds found for heatmap, err: " + err);
        }
    }

    let timeTaken = Date.now() - start;
    completeTask("rendering heatmap", timeTaken);
}

/**
 * Clears and redraws map with new data
 */
function resetMap() {
    console.log("Resetting map");

    try {
        resetProgressBar();
        eraseLayers();
        resetCoverageStats();
    }
    catch (err) {
        console.log("No map data to erase, err: " + err);
    }

    addBaseLayer();

    runTasks();
}

// Function to erase all layers from the map
function eraseLayers() {
    // Remove all layers (includes the heatmap layer, if present)
    map.eachLayer((layer) => {
        layer.remove();
    });
    flightLayers = [];
    exploredLayers = [];
    heatLayer = null;
}
