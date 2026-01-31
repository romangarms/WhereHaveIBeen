/**
 * Map Renderer Service for WhereHaveIBeen
 * Handles Leaflet map operations, routing, and buffer calculations
 */

import L from 'leaflet';
import 'leaflet-routing-machine';
import * as turf from '@turf/turf';
import { DRIVING_COLOR, FLYING_COLOR } from '../utils/constants';
import { formatDistance, formatArea, calculateWestCoastPercentage } from './dataProcessor';

// Track all OSRM routing controls so they can be properly removed
let routingControls = [];

/**
 * Calculate and draw route based on data size
 * @param {Object} data - GPS data from OwnTracks
 * @param {Array} latlngsList - List of driving or flying latlngs
 * @param {string} color - "blue", "green", or "red"
 * @param {Object} map - Leaflet map instance
 * @param {Object} options - Optional parameters for caching
 * @param {Function} options.onProgress - Progress callback
 * @param {Object} options.cachedBuffer - Previously cached buffer to merge with
 * @param {number} bufferSize - Buffer size in km
 * @param {string} osrmUrl - Custom OSRM URL (optional)
 * @returns {Promise<Object>} The final buffer GeoJSON
 */
export async function calculateAndDrawRoute(
  data,
  latlngsList,
  color,
  map,
  options = {}
) {
  const { onProgress, cachedBuffer, bufferSize = 0.5, osrmUrl = '' } = options;

  let lineStrings = [];

  for (const latlngs of latlngsList) {
    if (latlngs.length > 1) {
      let linestring;

      // Choose route calculation strategy based on data size
      if (data.features.length < 500) {
        try {
          linestring = await calculateComplexRoute(latlngs, map, osrmUrl);
        } catch (err) {
          // OSRM routing failed, fall back to simple route
          console.warn("Complex route calculation failed, falling back to simple route:", err.message);
          linestring = await calculateSimpleRoute(latlngs);
        }
      } else if (data.features.length < 3000) {
        linestring = await calculateSimpleRoute(latlngs);
      } else if (data.features.length < 5000) {
        linestring = await calculateNoRoute(latlngs, 0.01);
      } else {
        linestring = await calculateNoRoute(latlngs, 0.1);
      }

      if (onProgress) onProgress();
      lineStrings.push(linestring);
    }
  }

  const buffer = await createUnifiedBuffer(
    lineStrings,
    0.01,
    color,
    map,
    bufferSize,
    { cachedBuffer, onProgress }
  );

  return buffer;
}

/**
 * Calculate route without road snapping (point cloud mode)
 * @param {Array} latlngs - GPS coordinates
 * @param {number} minDistBetweenPoints - Minimum distance between points in km
 * @returns {Promise<Object>} Turf.js LineString
 */
async function calculateNoRoute(latlngs, minDistBetweenPoints = 0.1) {
  await new Promise(resolve => setTimeout(resolve, 0)); // Allow UI to update

  let processedLatlngs = [];

  for (let i = 0; i < latlngs.length; i++) {
    const currentPoint = [latlngs[i][1], latlngs[i][0]]; // [lng, lat]
    let isFarEnough = true;

    // Check distance against all included points
    for (const includedPoint of processedLatlngs) {
      const distance = turf.distance(
        turf.point(includedPoint),
        turf.point(currentPoint),
        { units: 'kilometers' }
      );
      if (distance < minDistBetweenPoints) {
        isFarEnough = false;
        break;
      }
    }

    if (isFarEnough) {
      processedLatlngs.push(currentPoint);
    }

    // Every 100 iterations, yield control to browser
    if (i % 100 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return turf.lineString(processedLatlngs);
}

/**
 * Calculate simple route using Turf.js LineString
 * @param {Array} latlngs - GPS coordinates
 * @returns {Promise<Object>} Turf.js LineString
 */
async function calculateSimpleRoute(latlngs) {
  await new Promise(resolve => setTimeout(resolve, 0)); // Allow UI to update

  let processedLatlngs = [];
  for (let i = 0; i < latlngs.length; i++) {
    processedLatlngs.push([latlngs[i][1], latlngs[i][0]]); // [lng, lat]

    // Every 100 iterations, yield control to browser
    if (i % 100 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return turf.lineString(processedLatlngs);
}

/**
 * Calculate complex route using OSRM road snapping
 * @param {Array} latlngs - GPS coordinates
 * @param {Object} map - Leaflet map instance
 * @param {string} osrmUrl - Custom OSRM URL (optional)
 * @returns {Promise<Object>} Turf.js LineString
 */
async function calculateComplexRoute(latlngs, map, osrmUrl = '') {
  console.log("Calculating complex route with", latlngs.length, "points");

  // Construct the service URL
  const serviceUrl = `/proxy?osrmURL=${encodeURIComponent(osrmUrl)}&coords=`;

  return new Promise((resolve, reject) => {
    const control = L.Routing.control({
      waypoints: latlngs.map(latlng => L.latLng(latlng[0], latlng[1])),
      router: L.Routing.osrmv1({
        serviceUrl: serviceUrl,
        profile: 'car',
      }),
      routeWhileDragging: false,
      createMarker: () => null, // Disable default markers
    }).addTo(map);

    // Track this control so it can be removed later
    routingControls.push(control);
    control.hide(); // Hide the routing panel

    control.on('routesfound', (e) => {
      let routes = e.routes;
      let routeCoords = routes[0].coordinates.map(coord => [coord.lng, coord.lat]);
      let lineString = turf.lineString(routeCoords);
      resolve(lineString);
    });

    control.on('routingerror', (error) => {
      reject(new Error("Routing failed: " + error.message));
    });
  });
}

/**
 * Create unified buffer from multiple lineStrings
 * @param {Array} lineStrings - Array of Turf.js LineStrings
 * @param {number} tolerance - Simplification tolerance
 * @param {string} color - Buffer color ("blue", "green", "red")
 * @param {Object} map - Leaflet map instance
 * @param {number} bufferSize - Buffer size in km
 * @param {Object} options - Optional parameters
 * @returns {Promise<Object>} Unified buffer GeoJSON
 */
async function createUnifiedBuffer(lineStrings, tolerance, color, map, bufferSize, options = {}) {
  const { cachedBuffer, onProgress, skipRender } = options;
  let unifiedBuffer = cachedBuffer || null;
  let totalDistance = 0;

  for (const lineString of lineStrings) {
    // Calculate distance for stats
    const distance = turf.length(lineString, { units: 'kilometers' });
    totalDistance += distance;

    // Buffer each lineString and merge
    const buffer = await drawBuffer(lineString, tolerance, bufferSize);

    if (unifiedBuffer) {
      try {
        unifiedBuffer = turf.union(unifiedBuffer, buffer);
      } catch (err) {
        console.error("Error merging buffers:", err);
        unifiedBuffer = buffer;
      }
    } else {
      unifiedBuffer = buffer;
    }

    if (onProgress) onProgress();
  }

  // If no lineStrings but we have a cached buffer, use that
  if (!unifiedBuffer && cachedBuffer) {
    unifiedBuffer = cachedBuffer;
  }

  // If skipRender is true, just return the buffer without rendering
  if (skipRender || !unifiedBuffer) {
    return { buffer: unifiedBuffer, distance: totalDistance };
  }

  // Render buffer on map
  const bufferColor = getBufferColor(color);
  const bufferLayer = L.geoJSON(unifiedBuffer, {
    style: () => ({ color: bufferColor, weight: 2 })
  }).addTo(map);

  // Fit map to buffer bounds
  try {
    const bounds = bufferLayer.getBounds();
    map.fitBounds(bounds);
  } catch (err) {
    console.log("No bounds found:", err);
  }

  if (onProgress) onProgress();

  return { buffer: unifiedBuffer, distance: totalDistance };
}

/**
 * Render a cached buffer directly to the map
 * @param {Object} buffer - The cached buffer GeoJSON
 * @param {string} color - "blue", "green", or "red"
 * @param {Object} map - Leaflet map instance
 */
export function renderCachedBuffer(buffer, color, map) {
  if (!buffer) return;

  const bufferColor = getBufferColor(color);
  const bufferLayer = L.geoJSON(buffer, {
    style: () => ({ color: bufferColor, weight: 2 })
  }).addTo(map);

  try {
    const bounds = bufferLayer.getBounds();
    map.fitBounds(bounds);
  } catch (err) {
    console.log("No bounds found for cached buffer:", err);
  }
}

/**
 * Draw buffer around a lineString
 * @param {Object} lineString - Turf.js LineString
 * @param {number} tolerance - Simplification tolerance (-1 to skip)
 * @param {number} bufferSize - Buffer size in km
 * @returns {Promise<Object>} Buffered polygon GeoJSON
 */
async function drawBuffer(lineString, tolerance, bufferSize) {
  let simplifiedLineString = lineString;

  if (tolerance !== -1) {
    simplifiedLineString = turf.simplify(lineString, {
      tolerance: tolerance,
      highQuality: false
    });
  }

  // Add a short pause to ensure the UI updates before buffering
  await new Promise(resolve => setTimeout(resolve, 0));

  // Buffer the simplified route
  let buffered;
  await new Promise(resolve => setTimeout(() => {
    buffered = turf.buffer(simplifiedLineString, bufferSize, {
      units: 'kilometers',
      steps: 3
    });
    resolve();
  }, 0));

  return buffered;
}

/**
 * Get buffer color based on string
 * @param {string} color - "blue", "green", or "red"
 * @returns {string} RGBA color string
 */
function getBufferColor(color) {
  switch (color) {
    case 'blue':
      return DRIVING_COLOR;
    case 'red':
      return FLYING_COLOR;
    case 'green':
      return 'rgba(0, 255, 0, 0.4)';
    default:
      return DRIVING_COLOR;
  }
}

/**
 * Clear all layers from the map
 * @param {Object} map - Leaflet map instance
 */
export function clearMapLayers(map) {
  // Remove all routing controls first
  routingControls.forEach(control => {
    try {
      map.removeControl(control);
    } catch (e) {
      // Control may already be removed
    }
  });
  routingControls = [];

  // Remove all layers except the tile layer
  map.eachLayer((layer) => {
    // Keep the tile layer (base map)
    if (!(layer instanceof L.TileLayer)) {
      layer.remove();
    }
  });
}

/**
 * Calculate statistics from buffer
 * @param {Object} buffer - Buffer GeoJSON
 * @returns {Object} Statistics object with area info
 */
export function calculateBufferStats(buffer) {
  if (!buffer) {
    return { area: 0, percentage: 0 };
  }

  const areaM2 = turf.area(buffer);
  const areaKm2 = areaM2 / 1e6; // Convert m² to km²
  const percentage = calculateWestCoastPercentage(areaKm2);

  return {
    area: areaKm2,
    percentage,
    formatted: formatArea(areaKm2)
  };
}

/**
 * Initialize Leaflet map
 * @param {string} elementId - DOM element ID for map container
 * @param {Array} center - [lat, lng] center coordinates
 * @param {number} zoom - Initial zoom level
 * @returns {Object} Leaflet map instance
 */
export function initializeMap(elementId, center, zoom) {
  const map = L.map(elementId).setView(center, zoom);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  return map;
}

export default {
  calculateAndDrawRoute,
  renderCachedBuffer,
  clearMapLayers,
  calculateBufferStats,
  initializeMap,
};
