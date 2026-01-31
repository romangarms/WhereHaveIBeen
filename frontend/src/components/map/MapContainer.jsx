/**
 * MapContainer Component
 * Manages Leaflet map instance and rendering
 */

import { useEffect, useRef } from 'react';
import { initializeMap, clearMapLayers } from '../../services/mapRenderer';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '../../utils/constants';

export default function MapContainer({
  onMapReady,
  className = ''
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    // Initialize map only once
    if (!mapInstanceRef.current && mapRef.current) {
      mapInstanceRef.current = initializeMap(
        'map',
        DEFAULT_MAP_CENTER,
        DEFAULT_MAP_ZOOM
      );

      if (onMapReady) {
        onMapReady(mapInstanceRef.current);
      }
    }

    // Cleanup on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [onMapReady]);

  return (
    <div className="relative">
      <div
        id="map"
        ref={mapRef}
        className={`h-[70vh] w-full z-0 ${className}`}
      />
    </div>
  );
}
