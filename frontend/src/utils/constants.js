/**
 * Constants used throughout the WhereHaveIBeen application
 */

// Default date range for filters
export const DEFAULT_START_DATE = '2015-01-01T00:00';
export const DEFAULT_END_DATE = '2099-12-31T23:59';

// Map settings
export const DEFAULT_MAP_CENTER = [37.7749, -122.4194]; // San Francisco
export const DEFAULT_MAP_ZOOM = 13;

// Buffer settings
export const DEFAULT_BUFFER_SIZE = 0.5; // km
export const MIN_BUFFER_SIZE = 0.1; // km
export const MAX_BUFFER_SIZE = 10; // km

// Routing thresholds
export const COMPLEX_ROUTE_THRESHOLD = 500; // points
export const SIMPLE_ROUTE_THRESHOLD = 3000; // points
export const POINT_CLOUD_THRESHOLD_1 = 5000; // points
export const POINT_CLOUD_TOLERANCE_1 = 0.01;
export const POINT_CLOUD_TOLERANCE_2 = 0.1;

// Buffer colors
export const DRIVING_COLOR = 'rgba(0, 0, 255, 0.4)'; // Blue with 40% opacity
export const FLYING_COLOR = 'rgba(255, 0, 0, 0.4)'; // Red with 40% opacity

// West coast area (WA, OR, CA combined)
export const WEST_COAST_AREA_KM2 = 863428;

// Progress bar colors
export const PROGRESS_COLORS = {
  loading: '#4870AF', // Blue
  complete: '#04AA6D', // Green
  error: '#FF0000', // Red
};

export default {
  DEFAULT_START_DATE,
  DEFAULT_END_DATE,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DEFAULT_BUFFER_SIZE,
  MIN_BUFFER_SIZE,
  MAX_BUFFER_SIZE,
  COMPLEX_ROUTE_THRESHOLD,
  SIMPLE_ROUTE_THRESHOLD,
  POINT_CLOUD_THRESHOLD_1,
  POINT_CLOUD_TOLERANCE_1,
  POINT_CLOUD_TOLERANCE_2,
  DRIVING_COLOR,
  FLYING_COLOR,
  WEST_COAST_AREA_KM2,
  PROGRESS_COLORS,
};
