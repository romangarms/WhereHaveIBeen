/**
 * Data Processing Service for WhereHaveIBeen
 * Handles filtering, statistics calculation, and data transformations
 */

// Settings
const MIN_DISTANCE_FILTER = 0.5; // Skip points within .5 km of the previous point
const DRIVING_FLYING_THRESHOLD_KMH = 200; // If above threshold, assume flying, else driving
const DISTANCE_BETWEEN_POINTS_FLYING_THRESHOLD = 100; // If distance is greater than this, assume flying

/**
 * Convert datetime-local value to ISO 8601 UTC string
 * @param {string} value - datetime-local input value
 * @returns {string} ISO 8601 UTC string
 */
export function toUTCISOString(value) {
  return value ? new Date(value).toISOString() : '';
}

/**
 * Convert UTC Date to local time string suitable for datetime-local input
 * @param {Date} utcDate - UTC date
 * @returns {string} Local datetime string in "YYYY-MM-DDTHH:MM" format
 */
export function toLocalDatetimeInputValue(utcDate) {
  const localDate = new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
}

/**
 * Get the latest timestamp from GPS data features
 * @param {Object} data - GeoJSON data with features
 * @returns {string|null} ISO timestamp of the latest GPS point
 */
export function getLatestTimestamp(data) {
  if (!data || !data.features || data.features.length === 0) {
    return null;
  }

  // Features are typically ordered chronologically, so the last one is the latest
  const lastFeature = data.features[data.features.length - 1];
  return lastFeature.properties.isotst;
}

/**
 * Get the earliest timestamp from GPS data features
 * @param {Object} data - GeoJSON data with features
 * @returns {string|null} ISO timestamp of the earliest GPS point
 */
export function getEarliestTimestamp(data) {
  if (!data || !data.features || data.features.length === 0) {
    return null;
  }

  // Features are typically ordered chronologically, so the first one is the earliest
  const firstFeature = data.features[0];
  return firstFeature.properties.isotst;
}

/**
 * Haversine formula to calculate distance between two lat/lng points
 * @param {number} lat1 - First point latitude
 * @param {number} lon1 - First point longitude
 * @param {number} lat2 - Second point latitude
 * @param {number} lon2 - Second point longitude
 * @returns {number} Distance in kilometers
 */
export function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Filter and separate OwnTracks GPS data into driving and flying segments
 * Handles data points with inaccurate coordinates and separates based on velocity
 * @param {Object} data - GPS data from OwnTracks (GeoJSON FeatureCollection)
 * @returns {Promise<Object>} Object with drivingLatlngs and flyingLatlngs arrays
 */
export async function filterData(data) {
  let drivingLatlngs = []; // Array to hold driving coordinates
  let flyingLatlngs = []; // Array to hold flying coordinates

  let currentMode = null; // Tracks the current mode: 'driving' or 'flying'
  let currentSegment = []; // Holds the current segment of points

  if (!data || !data.features || data.features.length === 0) {
    return { drivingLatlngs, flyingLatlngs };
  }

  console.log('First feature:', data.features[0]);

  data.features.forEach(feature => {
    if (feature.geometry?.coordinates) {
      const [lng, lat] = feature.geometry.coordinates;

      // Markers with velocity of zero and high acceleration tend to be very inaccurate, skip them
      if (feature.properties.acc < 100) {
        if (currentSegment.length > 0) {
          const lastPoint = currentSegment[currentSegment.length - 1];
          const dist = getDistanceFromLatLonInKm(lastPoint[0], lastPoint[1], lat, lng);

          // Only add the point if it's farther than the minimum distance
          if (dist > MIN_DISTANCE_FILTER) {
            let isFlying = feature.properties.vel > DRIVING_FLYING_THRESHOLD_KMH;

            if (dist > DISTANCE_BETWEEN_POINTS_FLYING_THRESHOLD) {
              isFlying = true; // Force flying mode if distance is greater than 100 km
            }

            // Check if the mode has changed
            if (
              (isFlying && currentMode !== 'flying') ||
              (!isFlying && currentMode !== 'driving')
            ) {
              // Save the current segment to the appropriate array
              // Skip segments with only one point
              if (currentSegment.length > 1) {
                if (currentMode === 'flying') {
                  flyingLatlngs.push(currentSegment);
                } else if (currentMode === 'driving') {
                  drivingLatlngs.push(currentSegment);
                }

                // Start a new segment
                currentSegment = [];
                currentMode = isFlying ? 'flying' : 'driving';
              }
            }

            // Add the point to the current segment
            currentSegment.push([lat, lng]);
          }
        } else {
          // Always add the first point
          currentSegment.push([lat, lng]);
          currentMode = feature.properties.vel > DRIVING_FLYING_THRESHOLD_KMH ? 'flying' : 'driving';
        }
      }
    }
  });

  // Save the last segment to the appropriate array
  if (currentSegment.length > 0) {
    if (currentMode === 'flying') {
      flyingLatlngs.push(currentSegment);
    } else if (currentMode === 'driving') {
      drivingLatlngs.push(currentSegment);
    }
  }

  return { drivingLatlngs, flyingLatlngs };
}

/**
 * Calculate OwnTracks statistics from GPS data
 * @param {Object} data - GeoJSON FeatureCollection
 * @returns {Object} Statistics object with highestAltitude and highestVelocity
 */
export function calculateOwntracksStats(data) {
  let highestAltitude = 0;
  let highestVelocity = 0;

  if (!data || !data.features) {
    return { highestAltitude, highestVelocity };
  }

  data.features.forEach(feature => {
    if (feature.properties.alt > highestAltitude) {
      highestAltitude = feature.properties.alt;
    }
    if (feature.properties.vel > highestVelocity) {
      highestVelocity = feature.properties.vel;
    }
  });

  return { highestAltitude, highestVelocity };
}

/**
 * Calculate OwnTracks statistics incrementally (compare against existing values)
 * Used when adding new data to cached data
 * @param {Object} data - GeoJSON FeatureCollection
 * @param {number} currentHighestAlt - Current highest altitude
 * @param {number} currentHighestVel - Current highest velocity
 * @returns {Object} Updated statistics object
 */
export function calculateOwntracksStatsIncremental(data, currentHighestAlt, currentHighestVel) {
  let highestAltitude = currentHighestAlt;
  let highestVelocity = currentHighestVel;

  if (!data || !data.features) {
    return { highestAltitude, highestVelocity };
  }

  data.features.forEach(feature => {
    if (feature.properties.alt > highestAltitude) {
      highestAltitude = feature.properties.alt;
    }
    if (feature.properties.vel > highestVelocity) {
      highestVelocity = feature.properties.vel;
    }
  });

  return { highestAltitude, highestVelocity };
}

/**
 * Format distance in both metric and imperial units
 * @param {number} km - Distance in kilometers
 * @returns {Object} Formatted distance in both units
 */
export function formatDistance(km) {
  return {
    km: Math.round(km * 100) / 100,
    mi: Math.round((km / 1.609) * 100) / 100
  };
}

/**
 * Format area in both metric and imperial units
 * @param {number} km2 - Area in square kilometers
 * @returns {Object} Formatted area in both units
 */
export function formatArea(km2) {
  return {
    km2: Math.round(km2 * 100) / 100,
    mi2: Math.round((km2 / 2.59) * 100) / 100
  };
}

/**
 * Calculate percentage of west coast covered
 * @param {number} km2 - Area in square kilometers
 * @returns {number} Percentage (0-100)
 */
export function calculateWestCoastPercentage(km2) {
  const WEST_COAST_AREA_KM2 = 863428; // WA, OR, CA combined
  return (km2 / WEST_COAST_AREA_KM2) * 100;
}

/**
 * Format altitude in both metric and imperial units
 * @param {number} meters - Altitude in meters
 * @returns {Object} Formatted altitude in both units
 */
export function formatAltitude(meters) {
  return {
    m: meters,
    ft: Math.round((meters * 3.281) * 100) / 100
  };
}

/**
 * Format velocity in both metric and imperial units
 * @param {number} kmh - Velocity in km/h
 * @returns {Object} Formatted velocity in both units
 */
export function formatVelocity(kmh) {
  return {
    kmh: kmh,
    mph: Math.round((kmh / 1.609) * 100) / 100
  };
}

/**
 * Calculate date range for quick time filters
 * @param {string} timeframe - 'month', 'week', '48hrs', '24hrs'
 * @returns {Object} Object with start and end date strings
 */
export function calculateDateRange(timeframe) {
  const now = new Date();
  let start;

  switch (timeframe) {
    case "month":
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(now.getMonth() - 1);
      start = toLocalDatetimeInputValue(oneMonthAgo);
      break;
    case "week":
      const oneWeekAgo = new Date(now);
      oneWeekAgo.setDate(now.getDate() - 7);
      start = toLocalDatetimeInputValue(oneWeekAgo);
      break;
    case "48hrs":
      start = toLocalDatetimeInputValue(new Date(now.getTime() - 48 * 60 * 60 * 1000));
      break;
    case "24hrs":
      start = toLocalDatetimeInputValue(new Date(now.getTime() - 24 * 60 * 60 * 1000));
      break;
    default:
      start = '2015-01-01T00:00';
  }

  const end = toLocalDatetimeInputValue(now);

  return { start, end };
}

export default {
  toUTCISOString,
  toLocalDatetimeInputValue,
  getLatestTimestamp,
  getEarliestTimestamp,
  getDistanceFromLatLonInKm,
  filterData,
  calculateOwntracksStats,
  calculateOwntracksStatsIncremental,
  formatDistance,
  formatArea,
  calculateWestCoastPercentage,
  formatAltitude,
  formatVelocity,
  calculateDateRange
};
