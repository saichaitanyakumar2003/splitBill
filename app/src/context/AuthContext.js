import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// API Base URL - update this when deploying backend
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3001/api' 
  : 'https://your-backend-url.onrender.com/api';

// Storage keys
const STORAGE_KEYS = {
  TOKEN: '@splitbill_token',
  USER: '@splitbill_user',
};

// Create Auth Context
const AuthContext = createContext(null);

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth polling interval (5 seconds)
const AUTH_POLL_INTERVAL = 5000;

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize auth state from storage
  useEffect(() => {
    initializeAuth();
  }, []);

  // Poll for session expiration every 5 seconds
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const checkSessionExpiration = () => {
      if (user?.session_expires_at) {
        const expiresAt = new Date(user.session_expires_at);
        if (new Date() > expiresAt) {
          // Session expired - clear auth and redirect to login
          console.log('Session expired during polling');
          clearAuth();
        }
      }
    };

    // Check immediately
    checkSessionExpiration();

    // Set up polling interval
    const intervalId = setInterval(checkSessionExpiration, AUTH_POLL_INTERVAL);

    // Cleanup on unmount or when auth changes
    return () => clearInterval(intervalId);
  }, [isAuthenticated, user]);

  /**
   * Initialize authentication state from stored token
   */
  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      
      // Get stored token and user
      const storedToken = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      
      if (storedToken && storedUser) {
        const userData = JSON.parse(storedUser);
        
        // Check if session is expired
        if (userData.session_expires_at) {
          const expiresAt = new Date(userData.session_expires_at);
          if (new Date() > expiresAt) {
            // Session expired - clear storage and show login
            await clearAuth();
            return;
          }
        }
        
        // Verify token with backend
        const isValid = await verifyToken(storedToken);
        
        if (isValid) {
          setToken(storedToken);
          setUser(userData);
          setIsAuthenticated(true);
        } else {
          // Token invalid - clear storage
          await clearAuth();
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      await clearAuth();
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Verify token with backend
   */
  const verifyToken = async (authToken) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Update user data from server
          await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.data));
          setUser(data.data);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Token verification error:', error);
      // Network error - return false to show login (safer approach)
      return false;
    }
  };

  /**
   * Login with email and password
   */
  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        await saveAuth(data.data.token, data.data.user);
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  /**
   * Register new user
   */
  const register = async (email, password, name, phone_number = null) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name, phone_number }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        await saveAuth(data.data.token, data.data.user);
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  /**
   * Login with Google OAuth
   * @param {string} idToken - Google ID token (optional if userInfo provided)
   * @param {string} mode - 'login' or 'signup'
   * @param {object} userInfo - User info from Google (optional if idToken provided)
   */
  const loginWithGoogle = async (idToken, mode = 'login', userInfo = null) => {
    try {
      const body = { mode };
      if (idToken) {
        body.idToken = idToken;
      }
      if (userInfo) {
        body.userInfo = userInfo;
      }

      const response = await fetch(`${API_BASE_URL}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      
      const data = await response.json();
      
      if (data.success) {
        await saveAuth(data.data.token, data.data.user);
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Google login error:', error);
      return { success: false, message: 'Google login failed. Please try again.' };
    }
  };

  /**
   * Login with Apple OAuth
   */
  const loginWithApple = async (identityToken, email, fullName) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/apple`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identityToken, email, fullName }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        await saveAuth(data.data.token, data.data.user);
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Apple login error:', error);
      return { success: false, message: 'Apple login failed. Please try again.' };
    }
  };

  /**
   * Save authentication data to storage
   */
  const saveAuth = async (authToken, userData) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, authToken);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
      setToken(authToken);
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error saving auth:', error);
    }
  };

  /**
   * Clear authentication data
   */
  const clearAuth = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error clearing auth:', error);
    }
  };

  /**
   * Logout user
   */
  const logout = async () => {
    try {
      // Call backend to invalidate session
      if (token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // Always clear local auth state
      await clearAuth();
    }
  };

  /**
   * Refresh session (extend expiration)
   */
  const refreshSession = async () => {
    try {
      if (!token) return false;
      
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Update token and session expiration
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, data.data.token);
        setToken(data.data.token);
        
        // Update user's session expiration
        const updatedUser = {
          ...user,
          session_expires_at: data.data.session_expires_at,
        };
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
        setUser(updatedUser);
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Session refresh error:', error);
      return false;
    }
  };

  /**
   * Update user profile (name, phone_number)
   */
  const updateProfile = async (updates) => {
    try {
      if (!token) {
        return { success: false, message: 'Not authenticated' };
      }

      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (data.success) {
        // Update local storage and state
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.data));
        setUser(data.data);
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Profile update error:', error);
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  /**
   * Change user password
   */
  const changePassword = async (currentPassword, newPassword) => {
    try {
      if (!token) {
        return { success: false, message: 'Not authenticated' };
      }

      const response = await fetch(`${API_BASE_URL}/auth/password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (data.success) {
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Password change error:', error);
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  /**
   * Skip login (guest mode)
   */
  const skipLogin = async () => {
    // Set a flag for guest mode but don't authenticate
    setIsAuthenticated(false);
    setIsLoading(false);
  };

  // Context value
  const value = {
    user,
    token,
    isLoading,
    isAuthenticated,
    login,
    register,
    loginWithGoogle,
    loginWithApple,
    logout,
    refreshSession,
    updateProfile,
    changePassword,
    skipLogin,
    initializeAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;

