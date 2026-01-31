/**
 * API Service for WhereHaveIBeen
 * Handles all communication with the Flask backend
 */

import axios from 'axios';

const api = axios.create({
  baseURL: '',
  timeout: 30000,
  withCredentials: true,
});

/**
 * Login to OwnTracks server
 * @param {string} username - OwnTracks username
 * @param {string} password - OwnTracks password
 * @param {string} serverurl - OwnTracks server URL
 */
export async function login(username, password, serverurl) {
  const formData = new FormData();
  formData.append('username', username);
  formData.append('password', password);
  formData.append('serverurl', serverurl);

  const response = await fetch('/login', {
    method: 'POST',
    body: formData,
  });

  return response;
}

/**
 * Sign out and clear session
 */
export async function signOut() {
  const response = await api.get('/sign_out');
  return response.data;
}

/**
 * Fetch location data from OwnTracks server
 * @param {Object} params - Query parameters
 * @param {string} params.startdate - Start date ISO string
 * @param {string} params.enddate - End date ISO string
 * @param {string} params.user - User name
 * @param {string} params.device - Device name
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
export async function fetchLocations(params) {
  const response = await api.get('/locations', { params });
  return response.data;
}

/**
 * Fetch list of users and devices
 * @returns {Promise<Array>} Array of user/device objects
 */
export async function fetchUsersDevices() {
  const response = await api.get('/usersdevices');
  return response.data;
}

/**
 * Save user settings
 * @param {Object} settings - Settings to save
 * @param {number} settings.circleSize - Buffer size in km
 * @param {string} settings.osrmURL - OSRM server URL
 * @returns {Promise<Object>} Success message
 */
export async function saveSettings(settings) {
  const response = await api.post('/save_settings', settings);
  return response.data;
}

/**
 * Get user settings
 * @returns {Promise<Object>} User settings
 */
export async function getSettings() {
  const response = await api.get('/get_settings');
  return response.data;
}

/**
 * Proxy OSRM request through Flask backend
 * @param {string} osrmURL - Custom OSRM URL (optional)
 * @param {string} coords - Coordinates string for OSRM
 * @returns {Promise<Object>} OSRM response
 */
export async function proxyOSRM(osrmURL, coords) {
  const response = await api.get('/proxy', {
    params: { osrmURL, coords }
  });
  return response.data;
}

/**
 * Check if user is logged in by attempting to get settings
 * @returns {Promise<boolean>} True if logged in
 */
export async function checkAuthentication() {
  try {
    await api.get('/get_settings');
    return true;
  } catch (error) {
    return false;
  }
}

export default api;
