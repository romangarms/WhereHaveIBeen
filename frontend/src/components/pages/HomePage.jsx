/**
 * HomePage Component
 * Main page that integrates map, filters, stats, and settings
 */

import { useState, useEffect, useRef } from 'react';
import { Settings } from 'lucide-react';
import MapContainer from '../map/MapContainer';
import LoginForm from '../panels/LoginForm';
import FilterPanel from '../panels/FilterPanel';
import StatsPanel from '../panels/StatsPanel';
import SettingsPanel from '../panels/SettingsPanel';
import ProgressBar from '../ui/ProgressBar';
import Button from '../ui/Button';

import useAuth from '../../hooks/useAuth';
import useSettings from '../../hooks/useSettings';
import useProgress from '../../hooks/useProgress';

import { fetchLocations, fetchUsersDevices } from '../../services/api';
import { filterData, calculateOwntracksStats, toUTCISOString } from '../../services/dataProcessor';
import { calculateAndDrawRoute, renderCachedBuffer, clearMapLayers, calculateBufferStats } from '../../services/mapRenderer';
import {
  getCache,
  setCache,
  clearCache,
  validateCacheData,
  validateCacheSettings,
  getCacheSize
} from '../../services/cacheManager';
import { DEFAULT_START_DATE, DEFAULT_END_DATE } from '../../utils/constants';

export default function HomePage() {
  const { isAuthenticated, login, loading: authLoading } = useAuth();
  const { settings, updateSettings } = useSettings();
  const {
    progress,
    status,
    message,
    reset: resetProgress,
    setSteps,
    updateMessage,
    completeStep,
    setError: setProgressError
  } = useProgress();

  const [map, setMap] = useState(null);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [filters, setFilters] = useState({
    user: '',
    device: '',
    startDate: DEFAULT_START_DATE,
    endDate: DEFAULT_END_DATE
  });
  const [stats, setStats] = useState({
    totalDistance: 0,
    totalArea: 0,
    highestAltitude: 0,
    highestVelocity: 0
  });
  const [cacheInfo, setCacheInfo] = useState(null);
  const firstLoadRef = useRef(true);

  // Fetch users and devices on mount if authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      loadUsersAndDevices();
    }
  }, [isAuthenticated, authLoading]);

  // Auto-load data on first load when map and filters are ready
  useEffect(() => {
    if (map && filters.user && filters.device && firstLoadRef.current) {
      loadData();
    }
  }, [map, filters.user, filters.device]);

  const loadUsersAndDevices = async () => {
    try {
      const data = await fetchUsersDevices();

      const userList = [...new Set(data.map(d => d.username).filter(Boolean))].map(u => ({
        value: u,
        label: u
      }));

      const deviceList = [...new Set(data.map(d => d.device).filter(Boolean))].map(d => ({
        value: d,
        label: d
      }));

      setUsers(userList);
      setDevices(deviceList);

      // Set initial filters
      if (userList.length > 0 && deviceList.length > 0) {
        setFilters(prev => ({
          ...prev,
          user: userList[0].value,
          device: deviceList[0].value
        }));
      }
    } catch (error) {
      console.error('Error fetching users/devices:', error);
    }
  };

  const loadData = async (filterOverrides = null) => {
    if (!map) return;

    resetProgress();
    setSteps(7);
    clearMapLayers(map);

    const currentFilters = filterOverrides || filters;
    const { user, device, startDate, endDate } = currentFilters;
    const isAllTime = startDate === DEFAULT_START_DATE && endDate === DEFAULT_END_DATE;

    try {
      // Check for cached data if all-time query
      let cacheData = null;
      if (isAllTime) {
        updateMessage('Checking cache...');
        cacheData = await getCache(user, device);

        if (cacheData && validateCacheData(cacheData)) {
          const cacheValid = validateCacheSettings(
            cacheData.settings,
            settings.bufferSize,
            settings.osrmUrl
          );

          if (cacheValid) {
            await loadFromCache(cacheData, currentFilters);
            return;
          } else {
            await clearCache(user, device);
            cacheData = null;
          }
        }
      }

      // Fresh data load
      await loadFreshData(currentFilters);
    } catch (error) {
      console.error('Error loading data:', error);
      setProgressError();
      updateMessage('Error loading data');
    }
  };

  const loadFromCache = async (cacheData, currentFilters) => {
    updateMessage('Loading from cache...');
    completeStep('loading from cache');

    // Render cached buffers
    if (cacheData.driving?.buffer) {
      renderCachedBuffer(cacheData.driving.buffer, 'blue', map);
    }
    if (cacheData.flying?.buffer) {
      renderCachedBuffer(cacheData.flying.buffer, 'red', map);
    }

    // Restore metrics
    if (cacheData.metrics) {
      setStats({
        totalDistance: cacheData.metrics.totalDistance || 0,
        totalArea: 0, // Will calculate from buffers
        highestAltitude: cacheData.metrics.highestAltitude || 0,
        highestVelocity: cacheData.metrics.highestVelocity || 0
      });
    }

    // Calculate area from buffers
    let totalArea = 0;
    if (cacheData.driving?.buffer) {
      const drivingStats = calculateBufferStats(cacheData.driving.buffer);
      totalArea += drivingStats.area;
    }
    if (cacheData.flying?.buffer) {
      const flyingStats = calculateBufferStats(cacheData.flying.buffer);
      totalArea += flyingStats.area;
    }

    setStats(prev => ({ ...prev, totalArea }));

    // Update cache info
    const size = await getCacheSize(currentFilters.user, currentFilters.device);
    setCacheInfo({ data: cacheData, size });

    updateMessage('Complete');
    completeStep('complete');
  };

  const loadFreshData = async (currentFilters) => {
    updateMessage('Fetching location data...');

    const params = {
      startdate: toUTCISOString(currentFilters.startDate),
      enddate: toUTCISOString(currentFilters.endDate),
      user: currentFilters.user,
      device: currentFilters.device
    };

    const data = await fetchLocations(params);
    completeStep('fetching locations');

    if (!data || !data.features || data.features.length === 0) {
      updateMessage('No data available');
      return;
    }

    // Auto-populate dates on first load
    if (firstLoadRef.current && data.features.length > 0) {
      const firstTimestamp = new Date(data.features[0].properties.isotst);
      const lastTimestamp = new Date(data.features[data.features.length - 1].properties.isotst);

      setFilters(prev => ({
        ...prev,
        startDate: firstTimestamp.toISOString().slice(0, 16),
        endDate: lastTimestamp.toISOString().slice(0, 16)
      }));

      firstLoadRef.current = false;
    }

    // Filter data
    updateMessage('Processing data...');
    const { drivingLatlngs, flyingLatlngs } = await filterData(data);
    completeStep('filtering data');

    // Calculate stats
    const owntracksStats = calculateOwntracksStats(data);
    setStats(prev => ({
      ...prev,
      highestAltitude: owntracksStats.highestAltitude,
      highestVelocity: owntracksStats.highestVelocity
    }));
    completeStep('calculating stats');

    // Calculate routes and buffers
    const totalSegments = drivingLatlngs.length + flyingLatlngs.length;
    setSteps(totalSegments * 3 + 5);

    let drivingBuffer = null;
    let flyingBuffer = null;
    let totalDistance = 0;

    updateMessage('Calculating routes...');

    if (drivingLatlngs.length > 0) {
      const result = await calculateAndDrawRoute(
        data,
        drivingLatlngs,
        'blue',
        map,
        {
          bufferSize: settings.bufferSize,
          osrmUrl: settings.osrmUrl,
          onProgress: () => completeStep('route segment')
        }
      );
      drivingBuffer = result.buffer;
      totalDistance += result.distance || 0;
    }

    if (flyingLatlngs.length > 0) {
      const result = await calculateAndDrawRoute(
        data,
        flyingLatlngs,
        'red',
        map,
        {
          bufferSize: settings.bufferSize,
          osrmUrl: settings.osrmUrl,
          onProgress: () => completeStep('route segment')
        }
      );
      flyingBuffer = result.buffer;
      totalDistance += result.distance || 0;
    }

    // Calculate area
    let totalArea = 0;
    if (drivingBuffer) {
      const drivingStats = calculateBufferStats(drivingBuffer);
      totalArea += drivingStats.area;
    }
    if (flyingBuffer) {
      const flyingStats = calculateBufferStats(flyingBuffer);
      totalArea += flyingStats.area;
    }

    setStats(prev => ({
      ...prev,
      totalDistance,
      totalArea
    }));

    // Save to cache if all-time query
    const isAllTime = currentFilters.startDate === DEFAULT_START_DATE && currentFilters.endDate === DEFAULT_END_DATE;
    if (isAllTime) {
      updateMessage('Saving cache...');
      const cacheData = {
        driving: { buffer: drivingBuffer, timestamp: new Date().toISOString(), startTimestamp: data.features[0]?.properties.isotst },
        flying: { buffer: flyingBuffer, timestamp: new Date().toISOString(), startTimestamp: data.features[0]?.properties.isotst },
        settings: { bufferSize: settings.bufferSize, osrmUrl: settings.osrmUrl },
        metrics: { totalDistance, highestAltitude: owntracksStats.highestAltitude, highestVelocity: owntracksStats.highestVelocity }
      };

      await setCache(currentFilters.user, currentFilters.device, cacheData);
      const size = await getCacheSize(currentFilters.user, currentFilters.device);
      setCacheInfo({ data: cacheData, size });
      completeStep('cache saved');
    }

    updateMessage('Complete');
  };

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters);
    if (map) {
      loadData(newFilters);
    }
  };

  const handleClearCache = async () => {
    if (confirm(`Clear cached data for ${filters.user}/${filters.device}?`)) {
      await clearCache(filters.user, filters.device);
      setCacheInfo(null);
      loadData();
    }
  };

  const handleSaveSettings = async (newSettings) => {
    const success = await updateSettings(newSettings);
    if (success) {
      // Invalidate cache when settings change
      await clearCache(filters.user, filters.device);
      setCacheInfo(null);
      loadData();
    }
    return success;
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Progress Bar */}
      <ProgressBar progress={progress} status={status} message={message} />

      {/* Login Form */}
      <LoginForm
        isVisible={!isAuthenticated && !authLoading}
        onLogin={login}
      />

      {/* Main Content */}
      {isAuthenticated && (
        <div className="relative">
          {/* Map Container */}
          <div className="relative">
            <MapContainer onMapReady={setMap} />

            {/* Settings Button Overlay */}
            <Button
              variant="primary"
              onClick={() => setSettingsPanelOpen(true)}
              className="absolute top-4 right-4 z-10 flex items-center gap-2"
            >
              <Settings className="w-5 h-5" />
              Settings
            </Button>
          </div>

          {/* Settings Panel */}
          <SettingsPanel
            isOpen={settingsPanelOpen}
            onClose={() => setSettingsPanelOpen(false)}
            settings={settings}
            onSaveSettings={handleSaveSettings}
            cacheInfo={cacheInfo}
            onClearCache={handleClearCache}
          />

          {/* Info Panels */}
          <div className="container mx-auto px-4 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FilterPanel
                users={users}
                devices={devices}
                onApplyFilters={handleApplyFilters}
              />

              <StatsPanel stats={stats} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
