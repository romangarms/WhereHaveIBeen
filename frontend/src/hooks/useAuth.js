/**
 * useAuth Hook
 * Manages authentication state and login/logout operations
 */

import { useState, useEffect } from 'react';
import { login as apiLogin, signOut as apiSignOut, checkAuthentication } from '../services/api';

export default function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check authentication status on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const authenticated = await checkAuthentication();
        setIsAuthenticated(authenticated);
      } catch (err) {
        console.error('Authentication check error:', err);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  const login = async (username, password, serverurl) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiLogin(username, password, serverurl);

      if (response.ok) {
        setIsAuthenticated(true);
        return true;
      } else {
        setError('Invalid credentials or server error');
        return false;
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to login. Please check your credentials and server URL.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await apiSignOut();
      setIsAuthenticated(false);
      // Reload page to clear all state
      window.location.href = '/';
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  return {
    isAuthenticated,
    loading,
    error,
    login,
    logout,
  };
}
