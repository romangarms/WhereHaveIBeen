/**
 * useSettings Hook
 * Manages user settings (buffer size, OSRM URL)
 */

import { useState, useEffect } from 'react';
import { getSettings as apiGetSettings, saveSettings as apiSaveSettings } from '../services/api';
import { DEFAULT_BUFFER_SIZE } from '../utils/constants';

export default function useSettings() {
  const [settings, setSettings] = useState({
    bufferSize: DEFAULT_BUFFER_SIZE,
    osrmUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch settings on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        const data = await apiGetSettings();
        setSettings({
          bufferSize: data.circleSize || DEFAULT_BUFFER_SIZE,
          osrmUrl: data.osrmURL || '',
        });
      } catch (err) {
        console.error('Error fetching settings:', err);
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  const updateSettings = async (newSettings) => {
    setLoading(true);
    setError(null);

    try {
      // Convert to Flask API format
      const apiSettings = {
        circleSize: newSettings.bufferSize,
        osrmURL: newSettings.osrmUrl,
      };

      await apiSaveSettings(apiSettings);
      setSettings(newSettings);
      return true;
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    settings,
    loading,
    error,
    updateSettings,
  };
}
