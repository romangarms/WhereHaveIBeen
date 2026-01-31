/**
 * StatsPanel Component
 * Displays travel statistics and metrics
 */

import { Info } from 'lucide-react';
import {
  formatDistance,
  formatArea,
  formatAltitude,
  formatVelocity,
  calculateWestCoastPercentage
} from '../../services/dataProcessor';

export default function StatsPanel({
  stats = {},
  className = ''
}) {
  const {
    totalDistance = 0,
    totalArea = 0,
    highestAltitude = 0,
    highestVelocity = 0
  } = stats;

  const distance = formatDistance(totalDistance);
  const area = formatArea(totalArea);
  const altitude = formatAltitude(highestAltitude);
  const velocity = formatVelocity(highestVelocity);
  const westCoastPct = calculateWestCoastPercentage(totalArea);

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 space-y-6 ${className}`}>
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Information</h1>
        <p className="text-sm text-neutral-600">
          This map shows the location history of the devices that are sending their
          location data to the Owntracks server.{' '}
          <a href="/about" className="text-primary-500 hover:underline">
            Learn more.
          </a>
        </p>
      </div>

      <div className="space-y-4">
        {/* Total Distance */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-lg font-semibold text-neutral-900">
              Total distance travelled
            </h4>
            <div className="group relative">
              <Info className="w-4 h-4 text-neutral-400 cursor-help" />
              <div className="hidden group-hover:block absolute left-0 top-6 bg-neutral-800 text-white text-xs rounded px-2 py-1 w-48 z-10">
                Note! This can be quite inaccurate over a large date range as there
                are some shortcuts in this calculation.
              </div>
            </div>
          </div>
          <p className="text-base text-neutral-700">
            {distance.km}km or {distance.mi}mi
          </p>
        </div>

        {/* Area Explored */}
        <div>
          <h4 className="text-lg font-semibold text-neutral-900 mb-1">
            Area explored is
          </h4>
          <p className="text-base text-neutral-700">
            {area.km2}km² or {area.mi2}mi²
          </p>
        </div>

        {/* West Coast Percentage */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-lg font-semibold text-neutral-900">
              Percentage of west coast covered
            </h4>
            <div className="group relative">
              <Info className="w-4 h-4 text-neutral-400 cursor-help" />
              <div className="hidden group-hover:block absolute left-0 top-6 bg-neutral-800 text-white text-xs rounded px-2 py-1 w-48 z-10">
                Calculated by dividing your area explored by 863,428km, the area of
                Washington, Oregon, and California.
              </div>
            </div>
          </div>
          <p className="text-base text-neutral-700">
            {westCoastPct.toFixed(6)}%
          </p>
        </div>

        {/* Highest Altitude */}
        <div>
          <h4 className="text-lg font-semibold text-neutral-900 mb-1">
            Highest Altitude
          </h4>
          <p className="text-base text-neutral-700">
            {altitude.m}m or {altitude.ft}ft
          </p>
        </div>

        {/* Highest Velocity */}
        <div>
          <h4 className="text-lg font-semibold text-neutral-900 mb-1">
            Highest Velocity
          </h4>
          <p className="text-base text-neutral-700">
            {velocity.kmh}kmh or {velocity.mph}mph
          </p>
        </div>
      </div>
    </div>
  );
}
