/**
 * API Helper - Wraps fetch calls with auth token and network error detection
 */

import ENV from '../config/env';

// API Base URL - from centralized config
export const API_BASE_URL = ENV.API_BASE_URL;

let networkErrorCallback = null;
let authToken = null;

// Set the callback function to report network errors
export const setNetworkErrorCallback = (callback) => {
  networkErrorCallback = callback;
};

// Set the auth token (called from AuthContext)
export const setAuthToken = (token) => {
  authToken = token;
};

// Get the current auth token
export const getAuthToken = () => authToken;

// Check if an error is a network error
export const isNetworkError = (error) => {
  const errorMessage = error?.message || '';
  return (
    errorMessage.includes('fetch') ||
    errorMessage.includes('network') ||
    errorMessage.includes('Network') ||
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('NetworkError') ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('aborted') ||
    error?.name === 'AbortError' ||
    error?.name === 'TypeError' // fetch throws TypeError on network failure
  );
};

// Report a network error
export const reportNetworkError = (error) => {
  if (isNetworkError(error) && networkErrorCallback) {
    networkErrorCallback(error);
  }
};

// Basic fetch wrapper that reports network errors
export const apiFetch = async (url, options = {}) => {
  try {
    const response = await fetch(url, options);
    return response;
  } catch (error) {
    reportNetworkError(error);
    throw error;
  }
};

/**
 * Authenticated fetch - automatically adds JWT token to headers
 * Use this for all authenticated API calls
 * 
 * @param {string} endpoint - API endpoint (e.g., '/auth/profile' or full URL)
 * @param {object} options - fetch options (method, body, etc.)
 * @returns {Promise<Response>}
 */
export const authFetch = async (endpoint, options = {}) => {
  // Determine if endpoint is full URL or relative path
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  // Build headers with auth token
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  // Add Authorization header if token exists
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    return response;
  } catch (error) {
    reportNetworkError(error);
    throw error;
  }
};

/**
 * Authenticated GET request
 */
export const authGet = async (endpoint) => {
  return authFetch(endpoint, { method: 'GET' });
};

/**
 * Authenticated POST request
 */
export const authPost = async (endpoint, body) => {
  return authFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

/**
 * Authenticated PUT request
 */
export const authPut = async (endpoint, body) => {
  return authFetch(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
};

/**
 * Authenticated DELETE request
 */
export const authDelete = async (endpoint) => {
  return authFetch(endpoint, { method: 'DELETE' });
};
