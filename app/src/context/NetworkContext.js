import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { setNetworkErrorCallback, isNetworkError } from '../utils/apiHelper';
import ENV from '../config/env';

const API_BASE = ENV.API_HOST;
const HEALTH_CHECK_TIMEOUT = 5000;

const NetworkContext = createContext();

export const useNetwork = () => useContext(NetworkContext);

export function NetworkProvider({ children }) {
  const [isConnected, setIsConnected] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [lastError, setLastError] = useState(null);

  // Call this when an API call fails due to network issues
  const reportNetworkError = useCallback((error) => {
    if (isNetworkError(error)) {
      setIsConnected(false);
      setLastError('Failed to fetch due to network issue or server down');
    }
  }, []);

  // Register the callback globally so AuthContext and other modules can use it
  useEffect(() => {
    setNetworkErrorCallback(reportNetworkError);
    return () => setNetworkErrorCallback(null);
  }, [reportNetworkError]);

  // Manual retry - checks health endpoint
  const retryNow = useCallback(async () => {
    setIsChecking(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

      const response = await fetch(`${API_BASE}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setIsConnected(true);
        setLastError(null);
      } else {
        throw new Error(`Server returned ${response.status}`);
      }
    } catch (error) {
      setIsConnected(false);
      setLastError('Failed to fetch due to network issue or server down');
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Reset network state (call this when user successfully makes an API call)
  const resetNetworkState = useCallback(() => {
    setIsConnected(true);
    setLastError(null);
  }, []);

  return (
    <NetworkContext.Provider value={{ 
      isConnected, 
      isChecking, 
      lastError, 
      retryNow,
      reportNetworkError,
      resetNetworkState
    }}>
      {children}
    </NetworkContext.Provider>
  );
}
