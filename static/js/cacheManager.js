/**
 * Cache Manager for WhereHaveIBeen
 * Handles IndexedDB operations for storing and retrieving buffer polygons
 */

const DB_NAME = 'WhereHaveIBeenCache';
const DB_VERSION = 1;
const STORE_NAME = 'bufferCache';

let db = null;

/**
 * Initialize the IndexedDB database
 * @returns {Promise<IDBDatabase>} The database instance
 */
async function initDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            console.log('IndexedDB initialized successfully');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            // Create object store if it doesn't exist
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'key' });
                console.log('Object store created');
            }
        };
    });
}

/**
 * Generate a cache key for a user/device combination
 * @param {string} user - The username
 * @param {string} device - The device name
 * @returns {string} The cache key
 */
function getCacheKey(user, device) {
    return `${user}_${device}`;
}

/**
 * Get cached buffer data for a user/device combination
 * @param {string} user - The username
 * @param {string} device - The device name
 * @returns {Promise<Object|null>} The cached data or null if not found
 */
async function getCache(user, device) {
    try {
        await initDB();
        const key = getCacheKey(user, device);

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onerror = () => {
                console.error('Error getting cache:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    console.log('Cache found for', key);
                    resolve(result.data);
                } else {
                    console.log('No cache found for', key);
                    resolve(null);
                }
            };
        });
    } catch (error) {
        console.error('getCache error:', error);
        return null;
    }
}

/**
 * Store buffer data in the cache
 * @param {string} user - The username
 * @param {string} device - The device name
 * @param {Object} data - The data to cache
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function setCache(user, device, data) {
    try {
        await initDB();
        const key = getCacheKey(user, device);

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const record = {
                key: key,
                data: data,
                savedAt: new Date().toISOString()
            };

            const request = store.put(record);

            request.onerror = (event) => {
                // Check if it's a quota error
                if (event.target.error.name === 'QuotaExceededError') {
                    console.warn('Storage quota exceeded, attempting to clear old caches');
                    handleQuotaExceeded(user, device, data).then(resolve).catch(reject);
                } else {
                    console.error('Error setting cache:', request.error);
                    reject(request.error);
                }
            };

            request.onsuccess = () => {
                console.log('Cache saved for', key);
                resolve(true);
            };
        });
    } catch (error) {
        console.error('setCache error:', error);
        return false;
    }
}

/**
 * Handle storage quota exceeded by clearing other caches
 * @param {string} user - Current user
 * @param {string} device - Current device
 * @param {Object} data - Data to save
 * @returns {Promise<boolean>} True if successful after clearing
 */
async function handleQuotaExceeded(user, device, data) {
    try {
        const currentKey = getCacheKey(user, device);

        // Get all keys and clear those that aren't the current one
        const allKeys = await getAllCacheKeys();
        for (const key of allKeys) {
            if (key !== currentKey) {
                await clearCacheByKey(key);
            }
        }

        // Retry saving
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const record = {
                key: currentKey,
                data: data,
                savedAt: new Date().toISOString()
            };

            const request = store.put(record);

            request.onerror = () => {
                console.error('Still failed after clearing caches:', request.error);
                resolve(false); // Graceful degradation
            };

            request.onsuccess = () => {
                console.log('Cache saved after clearing old entries');
                resolve(true);
            };
        });
    } catch (error) {
        console.error('handleQuotaExceeded error:', error);
        return false;
    }
}

/**
 * Get all cache keys in the store
 * @returns {Promise<string[]>} Array of cache keys
 */
async function getAllCacheKeys() {
    try {
        await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAllKeys();

            request.onerror = () => {
                reject(request.error);
            };

            request.onsuccess = () => {
                resolve(request.result);
            };
        });
    } catch (error) {
        console.error('getAllCacheKeys error:', error);
        return [];
    }
}

/**
 * Clear cache by key
 * @param {string} key - The cache key to clear
 * @returns {Promise<boolean>} True if successful
 */
async function clearCacheByKey(key) {
    try {
        await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(key);

            request.onerror = () => {
                reject(request.error);
            };

            request.onsuccess = () => {
                console.log('Cache cleared for', key);
                resolve(true);
            };
        });
    } catch (error) {
        console.error('clearCacheByKey error:', error);
        return false;
    }
}

/**
 * Clear cached data for a user/device combination
 * @param {string} user - The username
 * @param {string} device - The device name
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function clearCache(user, device) {
    const key = getCacheKey(user, device);
    return clearCacheByKey(key);
}

/**
 * Calculate the approximate size of cached data for a user/device
 * @param {string} user - The username
 * @param {string} device - The device name
 * @returns {Promise<number>} Size in bytes
 */
async function getCacheSize(user, device) {
    try {
        await initDB();
        const key = getCacheKey(user, device);

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onerror = () => {
                reject(request.error);
            };

            request.onsuccess = () => {
                if (request.result) {
                    // Estimate size by JSON stringifying
                    const size = new Blob([JSON.stringify(request.result)]).size;
                    resolve(size);
                } else {
                    resolve(0);
                }
            };
        });
    } catch (error) {
        console.error('getCacheSize error:', error);
        return 0;
    }
}

/**
 * Format bytes to human readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted string (e.g., "2.5 MB")
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Validate that cached settings match current settings
 * @param {Object} cachedSettings - Settings stored with cache
 * @param {number} currentBufferSize - Current buffer size setting
 * @param {string} currentOsrmUrl - Current OSRM URL setting
 * @returns {boolean} True if settings match
 */
function validateCacheSettings(cachedSettings, currentBufferSize, currentOsrmUrl) {
    if (!cachedSettings) return false;

    // Check if buffer size matches
    if (cachedSettings.bufferSize !== currentBufferSize) {
        console.log('Cache invalid: buffer size changed from', cachedSettings.bufferSize, 'to', currentBufferSize);
        return false;
    }

    // Check if OSRM URL matches
    if (cachedSettings.osrmUrl !== currentOsrmUrl) {
        console.log('Cache invalid: OSRM URL changed');
        return false;
    }

    return true;
}

/**
 * Validate that cache data structure is valid and not corrupted
 * @param {Object} cacheData - The cached data to validate
 * @returns {boolean} True if cache data is valid
 */
function validateCacheData(cacheData) {
    if (!cacheData) return false;

    // Check for required structure
    if (typeof cacheData !== 'object') {
        console.log('Cache invalid: not an object');
        return false;
    }

    // Check that at least one buffer exists with valid structure
    const hasDrivingBuffer = cacheData.driving &&
        cacheData.driving.buffer &&
        typeof cacheData.driving.buffer === 'object';

    const hasFlyingBuffer = cacheData.flying &&
        cacheData.flying.buffer &&
        typeof cacheData.flying.buffer === 'object';

    if (!hasDrivingBuffer && !hasFlyingBuffer) {
        console.log('Cache invalid: no valid buffers found');
        return false;
    }

    // Check that at least one timestamp exists
    const hasTimestamp = (cacheData.driving && cacheData.driving.timestamp) ||
        (cacheData.flying && cacheData.flying.timestamp);

    if (!hasTimestamp) {
        console.log('Cache invalid: no timestamp found');
        return false;
    }

    // Check settings exist
    if (!cacheData.settings) {
        console.log('Cache invalid: no settings found');
        return false;
    }

    return true;
}

/**
 * Get the date range of cached data
 * @param {Object} cacheData - The cached data object
 * @returns {Object|null} Object with startDate and endDate, or null
 */
function getCacheDateRange(cacheData) {
    if (!cacheData) return null;

    let earliestDate = null;
    let latestDate = null;

    // Check driving buffer timestamp
    if (cacheData.driving && cacheData.driving.startTimestamp) {
        earliestDate = new Date(cacheData.driving.startTimestamp);
    }
    if (cacheData.driving && cacheData.driving.timestamp) {
        latestDate = new Date(cacheData.driving.timestamp);
    }

    // Check flying buffer timestamp - update if earlier/later
    if (cacheData.flying && cacheData.flying.startTimestamp) {
        const flyingStart = new Date(cacheData.flying.startTimestamp);
        if (!earliestDate || flyingStart < earliestDate) {
            earliestDate = flyingStart;
        }
    }
    if (cacheData.flying && cacheData.flying.timestamp) {
        const flyingEnd = new Date(cacheData.flying.timestamp);
        if (!latestDate || flyingEnd > latestDate) {
            latestDate = flyingEnd;
        }
    }

    if (!earliestDate || !latestDate) return null;

    return {
        startDate: earliestDate,
        endDate: latestDate
    };
}

/**
 * Format a date for display
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
function formatCacheDate(date) {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
