import Constants from 'expo-constants';

// Get environment variables from app.json extra field
const extra = Constants.expoConfig?.extra || {};

// Production URLs (from app.json)
const PROD_API_BASE_URL = extra.apiBaseUrl || 'https://splitbill-i6ou.onrender.com/api';
const PROD_API_HOST = extra.apiHost || 'https://splitbill-i6ou.onrender.com';

// Development URLs (always localhost)
const DEV_API_BASE_URL = 'http://localhost:3001/api';
const DEV_API_HOST = 'http://localhost:3001';

// Environment configuration
const ENV = {
  // API URL - Dev uses localhost, Prod uses Render
  API_BASE_URL: __DEV__ ? DEV_API_BASE_URL : PROD_API_BASE_URL,
  API_HOST: __DEV__ ? DEV_API_HOST : PROD_API_HOST,
};

// Log config in development
if (__DEV__) {
  console.log('🔧 App Config (DEV MODE):', ENV);
}

export default ENV;
