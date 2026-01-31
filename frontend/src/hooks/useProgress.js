/**
 * useProgress Hook
 * Manages progress bar state for async operations
 */

import { useState, useCallback } from 'react';

export default function useProgress() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('loading'); // 'loading', 'complete', 'error'
  const [message, setMessage] = useState('');
  const [totalSteps, setTotalSteps] = useState(5);
  const [completedSteps, setCompletedSteps] = useState(0);

  const reset = useCallback(() => {
    setProgress(0);
    setStatus('loading');
    setMessage('');
    setCompletedSteps(0);
  }, []);

  const setSteps = useCallback((steps) => {
    setTotalSteps(steps);
  }, []);

  const updateMessage = useCallback((msg) => {
    setMessage(msg);
  }, []);

  const completeStep = useCallback((taskName, timeTaken = 0) => {
    setCompletedSteps((prev) => {
      const newCompleted = prev + 1;
      const newProgress = Math.round((newCompleted / totalSteps) * 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        setStatus('complete');
      }

      console.log(`Task "${taskName}" completed in ${timeTaken}ms`);
      return newCompleted;
    });
  }, [totalSteps]);

  const setError = useCallback(() => {
    setStatus('error');
  }, []);

  return {
    progress,
    status,
    message,
    totalSteps,
    completedSteps,
    reset,
    setSteps,
    updateMessage,
    completeStep,
    setError,
  };
}
