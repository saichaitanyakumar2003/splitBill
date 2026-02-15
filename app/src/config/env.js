import Constants from 'expo-constants';

// Get environment variables from app.json extra field
const extra = Constants.expoConfig?.extra || {};

// Production API endpoints (multiple servers for load distribution)
const PROD_API_ENDPOINTS = [
  { baseUrl: extra.apiBaseUrl || 'https://splitbill-i6ou.onrender.com/api', host: extra.apiHost || 'https://splitbill-i6ou.onrender.com' },
  { baseUrl: 'https://splitbill-37og.onrender.com/api', host: 'https://splitbill-37og.onrender.com' },
];

// Development URLs (always localhost)
const DEV_API_BASE_URL = 'http://localhost:3001/api';
const DEV_API_HOST = 'http://localhost:3001';

/**
 * Returns a randomly selected API endpoint (baseUrl + host). Use this for each request
 * so traffic is distributed across backend servers. In dev, returns single localhost endpoint.
 */
export const getRandomApiEndpoint = () => {
  if (__DEV__) {
    return { baseUrl: DEV_API_BASE_URL, host: DEV_API_HOST };
  }
  const i = Math.floor(Math.random() * PROD_API_ENDPOINTS.length);
  return PROD_API_ENDPOINTS[i];
};

// Legacy single-URL config (first prod endpoint or dev)
const PROD_API_BASE_URL = PROD_API_ENDPOINTS[0].baseUrl;
const PROD_API_HOST = PROD_API_ENDPOINTS[0].host;

// Environment configuration
const ENV = {
  API_BASE_URL: __DEV__ ? DEV_API_BASE_URL : PROD_API_BASE_URL,
  API_HOST: __DEV__ ? DEV_API_HOST : PROD_API_HOST,
};

// Log config in development
if (__DEV__) {
  console.log('🔧 App Config (DEV MODE):', ENV);
}

export default ENV;
