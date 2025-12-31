import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

const API_BASE = Platform.OS === 'web' ? 'http://localhost:3001' : 'http://localhost:3001';
const HEALTH_CHECK_INTERVAL = 3000; // Poll every 3 seconds when connected
const HEALTH_CHECK_TIMEOUT = 5000;

const NetworkContext = createContext();

export const useNetwork = () => useContext(NetworkContext);

export function NetworkProvider({ children }) {
  const [isConnected, setIsConnected] = useState(true);
  const [isChecking, setIsChecking] = useState(true);
  const [lastError, setLastError] = useState(null);
  const intervalRef = useRef(null);

  const checkHealth = async () => {
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
      setLastError(error.message || 'Connection failed');
    } finally {
      setIsChecking(false);
    }
  };

  // Initial check on mount
  useEffect(() => {
    checkHealth();
  }, []);

  // Long poll only when connected to detect disconnection
  useEffect(() => {
    if (isConnected) {
      intervalRef.current = setInterval(checkHealth, HEALTH_CHECK_INTERVAL);
    } else {
      // Stop polling when disconnected - user must click retry
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isConnected]);

  return (
    <NetworkContext.Provider value={{ isConnected, isChecking, lastError, retryNow: checkHealth }}>
      {children}
    </NetworkContext.Provider>
  );
}
