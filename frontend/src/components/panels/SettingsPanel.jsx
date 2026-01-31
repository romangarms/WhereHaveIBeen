/**
 * SettingsPanel Component
 * Slide-in panel for app settings
 */

import { useState, useEffect } from 'react';
import { X, Settings as SettingsIcon, Info } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { MIN_BUFFER_SIZE, MAX_BUFFER_SIZE, DEFAULT_BUFFER_SIZE } from '../../utils/constants';
import { formatBytes, formatCacheDate, getCacheDateRange } from '../../services/cacheManager';

export default function SettingsPanel({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  cacheInfo,
  onClearCache,
  className = ''
}) {
  const [bufferSize, setBufferSize] = useState(DEFAULT_BUFFER_SIZE);
  const [osrmUrl, setOsrmUrl] = useState('');

  useEffect(() => {
    if (settings) {
      setBufferSize(settings.bufferSize || DEFAULT_BUFFER_SIZE);
      setOsrmUrl(settings.osrmUrl || '');
    }
  }, [settings]);

  const handleApply = async () => {
    const success = await onSaveSettings({
      bufferSize: parseFloat(bufferSize),
      osrmUrl
    });

    if (success) {
      onClose();
    }
  };

  const cacheDateRange = cacheInfo?.data ? getCacheDateRange(cacheInfo.data) : null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      {/* Settings Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 overflow-y-auto ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h1 className="text-2xl font-bold text-neutral-900">Settings</h1>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Map Settings */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-neutral-900">Map Settings</h4>
            <p className="text-sm text-neutral-600">
              Adjust settings about the way the routes and blue area buffer are drawn
              on the map.
            </p>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <h5 className="text-base font-medium text-neutral-900">Buffer Size</h5>
                <div className="group relative">
                  <Info className="w-4 h-4 text-neutral-400 cursor-help" />
                  <div className="hidden group-hover:block absolute left-0 top-6 bg-neutral-800 text-white text-xs rounded px-2 py-1 w-64 z-10">
                    Change how large of a buffer is drawn around your route in
                    kilometers. Note that larger values take longer to draw. Changing
                    this will invalidate your cache.
                  </div>
                </div>
              </div>
              <p className="text-sm text-neutral-600 mb-2">Default: 0.5km</p>
              <Input
                type="number"
                value={bufferSize}
                onChange={(e) => setBufferSize(e.target.value)}
                step="0.1"
                min={MIN_BUFFER_SIZE}
                max={MAX_BUFFER_SIZE}
              />
            </div>
          </div>

          {/* Routing Settings */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-neutral-900">Routing Settings</h4>
            <p className="text-sm text-neutral-600">
              Change the URL of the routing engine if you host your own or want to use
              the public OSRM one.
            </p>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <h5 className="text-base font-medium text-neutral-900">
                  Custom OSRM Router
                </h5>
                <div className="group relative">
                  <Info className="w-4 h-4 text-neutral-400 cursor-help" />
                  <div className="hidden group-hover:block absolute left-0 top-6 bg-neutral-800 text-white text-xs rounded px-2 py-1 w-64 z-10">
                    Change the URL used for the OSRM router. Changing this will
                    invalidate your cache.
                  </div>
                </div>
              </div>
              <p className="text-sm text-neutral-600 mb-2">Default: leave blank</p>
              <Input
                type="url"
                value={osrmUrl}
                onChange={(e) => setOsrmUrl(e.target.value)}
                placeholder="https://your-osrm-server.com"
              />
            </div>
          </div>

          {/* Cache Info */}
          {cacheInfo && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-semibold text-neutral-900">Cache</h4>
                <div className="group relative">
                  <Info className="w-4 h-4 text-neutral-400 cursor-help" />
                  <div className="hidden group-hover:block absolute left-0 top-6 bg-neutral-800 text-white text-xs rounded px-2 py-1 w-64 z-10">
                    Cached buffer polygons speed up loading on return visits. Only new
                    GPS data since your last visit needs to be processed.
                  </div>
                </div>
              </div>

              <div className="text-sm text-neutral-600">
                <p>
                  <strong>Cached:</strong>{' '}
                  {cacheDateRange
                    ? `${formatCacheDate(cacheDateRange.startDate)} - ${formatCacheDate(
                        cacheDateRange.endDate
                      )}`
                    : 'No cached data'}
                </p>
                <p>
                  <strong>Storage:</strong> {formatBytes(cacheInfo.size || 0)}
                </p>
              </div>

              <Button variant="warning" onClick={onClearCache} className="w-full">
                Clear Cache
              </Button>
            </div>
          )}

          {/* Apply Button */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-neutral-900">
              Save and Apply Settings
            </h4>
            <Button variant="primary" onClick={handleApply} className="w-full">
              Apply
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
