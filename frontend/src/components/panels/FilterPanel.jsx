/**
 * FilterPanel Component
 * Handles user/device selection and date filtering
 */

import { useState, useEffect } from 'react';
import Button from '../ui/Button';
import Select from '../ui/Select';
import Input from '../ui/Input';
import { calculateDateRange, toLocalDatetimeInputValue } from '../../services/dataProcessor';
import { DEFAULT_START_DATE, DEFAULT_END_DATE } from '../../utils/constants';

export default function FilterPanel({
  users = [],
  devices = [],
  onApplyFilters,
  className = ''
}) {
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('');
  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [endDate, setEndDate] = useState(DEFAULT_END_DATE);

  // Set defaults when users/devices load
  useEffect(() => {
    if (users.length > 0 && !selectedUser) {
      setSelectedUser(users[0].value);
    }
  }, [users, selectedUser]);

  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) {
      setSelectedDevice(devices[0].value);
    }
  }, [devices, selectedDevice]);

  const handleQuickFilter = (timeframe) => {
    if (timeframe === 'all') {
      setStartDate(DEFAULT_START_DATE);
      setEndDate(DEFAULT_END_DATE);
    } else {
      const range = calculateDateRange(timeframe);
      setStartDate(range.start);
      setEndDate(range.end);
    }
  };

  const handleApply = () => {
    onApplyFilters({
      user: selectedUser,
      device: selectedDevice,
      startDate,
      endDate
    });
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 space-y-6 ${className}`}>
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Filters</h1>
        <p className="text-sm text-neutral-600">
          Is your data showing incorrectly on the map? Try adjusting these settings.
          Make sure the user and device are correct, and try changing time frame.
        </p>
      </div>

      {/* User and Device Selection */}
      <div className="space-y-4">
        <div>
          <h4 className="text-lg font-semibold text-neutral-900 mb-2">
            Choose a user and device
          </h4>
          <p className="text-sm text-neutral-600 mb-3">
            Choose which device to track. This is your OwnTracks user and device.
          </p>

          <div className="space-y-3">
            <Select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              options={users}
              placeholder="Choose a user"
            />

            <Select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              options={devices}
              placeholder="Choose a device"
            />
          </div>
        </div>
      </div>

      {/* Date Range */}
      <div className="space-y-4">
        <div>
          <h4 className="text-lg font-semibold text-neutral-900 mb-2">Time frame</h4>
          <p className="text-sm text-neutral-600 mb-3">
            Filter the map to only show GPS data between these two dates.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Start Date
              </label>
              <Input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                End Date
              </label>
              <Input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Quick Filter Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="primary"
              onClick={() => handleQuickFilter('month')}
              className="text-xs"
            >
              Last Month
            </Button>
            <Button
              variant="primary"
              onClick={() => handleQuickFilter('week')}
              className="text-xs"
            >
              Last Week
            </Button>
            <Button
              variant="primary"
              onClick={() => handleQuickFilter('48hrs')}
              className="text-xs"
            >
              Last 48 Hours
            </Button>
            <Button
              variant="primary"
              onClick={() => handleQuickFilter('24hrs')}
              className="text-xs"
            >
              Last 24 Hours
            </Button>
          </div>

          <Button
            variant="success"
            onClick={() => handleQuickFilter('all')}
            className="w-full mt-2"
          >
            All Time
          </Button>
        </div>
      </div>

      {/* Apply Button */}
      <div>
        <h4 className="text-lg font-semibold text-neutral-900 mb-2">Apply Filters</h4>
        <Button
          variant="primary"
          onClick={handleApply}
          className="w-full"
        >
          Apply
        </Button>
      </div>
    </div>
  );
}
