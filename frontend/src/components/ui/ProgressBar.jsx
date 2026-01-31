/**
 * Progress Bar component for displaying task progress
 */

import { PROGRESS_COLORS } from '../../utils/constants';

export default function ProgressBar({ progress = 0, status = 'loading', message = '' }) {
  const getBackgroundColor = () => {
    switch (status) {
      case 'complete':
        return PROGRESS_COLORS.complete;
      case 'error':
        return PROGRESS_COLORS.error;
      default:
        return PROGRESS_COLORS.loading;
    }
  };

  return (
    <div className="w-full h-[4vh] bg-neutral-200 relative overflow-hidden">
      <div
        className="h-full transition-all duration-300 ease-in-out flex items-center"
        style={{
          width: `${progress}%`,
          backgroundColor: getBackgroundColor(),
        }}
      >
        {progress >= 100 && message && (
          <span className="text-white text-sm font-medium px-4 whitespace-nowrap ml-4">
            {message}
          </span>
        )}
      </div>
      {progress < 100 && message && (
        <span className="absolute inset-0 flex items-center justify-center text-neutral-700 text-sm font-medium">
          {message}
        </span>
      )}
    </div>
  );
}
