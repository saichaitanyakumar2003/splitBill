import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API Base URL
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3001/api' 
  : 'https://your-backend-url.onrender.com/api';

// Storage keys for persistence
const STORAGE_KEYS = {
  FAVORITES: '@splitbill_favorites',
  GROUPS: '@splitbill_groups',
};

// Create Store Context
const StoreContext = createContext(null);

// Custom hook to use store context
export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};

// Store Provider Component
export const StoreProvider = ({ children }) => {
  // Cached data
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [groups, setGroups] = useState([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  
  // Loading states
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  /**
   * Load favorites from cache or API
   */
  const loadFavorites = useCallback(async (token, friendEmails, forceRefresh = false) => {
    // Return cached data if already loaded and not forcing refresh
    if (favoritesLoaded && !forceRefresh && favorites.length > 0) {
      return favorites;
    }

    // If no friend emails, return empty
    if (!friendEmails || friendEmails.length === 0) {
      setFavorites([]);
      setFavoritesLoaded(true);
      return [];
    }

    setIsLoadingFavorites(true);
    
    try {
      // Try to get from local storage first (for faster initial load)
      if (!forceRefresh) {
        const cached = await AsyncStorage.getItem(STORAGE_KEYS.FAVORITES);
        if (cached) {
          const cachedFavorites = JSON.parse(cached);
          // Check if cached emails match current friend emails
          const cachedEmails = cachedFavorites.map(f => f.mailId).sort();
          const currentEmails = [...friendEmails].sort();
          if (JSON.stringify(cachedEmails) === JSON.stringify(currentEmails)) {
            setFavorites(cachedFavorites);
            setFavoritesLoaded(true);
            setIsLoadingFavorites(false);
            return cachedFavorites;
          }
        }
      }

      // Fetch from API
      const response = await fetch(`${API_BASE_URL}/auth/friends/details`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emails: friendEmails }),
      });
      
      const data = await response.json();
      
      if (data.success && data.data) {
        setFavorites(data.data);
        setFavoritesLoaded(true);
        // Cache to local storage
        await AsyncStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(data.data));
        return data.data;
      } else {
        // Fallback to email prefix
        const fallbackList = friendEmails.map(mailId => ({
          mailId,
          name: mailId.split('@')[0]
        }));
        setFavorites(fallbackList);
        setFavoritesLoaded(true);
        return fallbackList;
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
      // Fallback to email prefix
      const fallbackList = friendEmails.map(mailId => ({
        mailId,
        name: mailId.split('@')[0]
      }));
      setFavorites(fallbackList);
      setFavoritesLoaded(true);
      return fallbackList;
    } finally {
      setIsLoadingFavorites(false);
    }
  }, [favorites, favoritesLoaded]);

  /**
   * Update favorites after adding/removing
   */
  const updateFavorites = useCallback(async (newFavorites) => {
    setFavorites(newFavorites);
    await AsyncStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(newFavorites));
  }, []);

  /**
   * Add a favorite to the cache
   */
  const addFavoriteToCache = useCallback(async (userToAdd) => {
    const updated = [...favorites, userToAdd];
    setFavorites(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(updated));
    return updated;
  }, [favorites]);

  /**
   * Remove a favorite from the cache
   */
  const removeFavoriteFromCache = useCallback(async (mailId) => {
    const updated = favorites.filter(f => f.mailId !== mailId);
    setFavorites(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(updated));
    return updated;
  }, [favorites]);

  /**
   * Load groups from cache or API
   */
  const loadGroups = useCallback(async (token, forceRefresh = false) => {
    // Return cached data if already loaded and not forcing refresh
    if (groupsLoaded && !forceRefresh && groups.length > 0) {
      return groups;
    }

    setIsLoadingGroups(true);
    
    try {
      // Try to get from local storage first
      if (!forceRefresh) {
        const cached = await AsyncStorage.getItem(STORAGE_KEYS.GROUPS);
        if (cached) {
          const cachedGroups = JSON.parse(cached);
          setGroups(cachedGroups);
          setGroupsLoaded(true);
          setIsLoadingGroups(false);
          return cachedGroups;
        }
      }

      // Fetch from API
      const response = await fetch(`${API_BASE_URL}/groups`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success && data.data) {
        setGroups(data.data);
        setGroupsLoaded(true);
        await AsyncStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(data.data));
        return data.data;
      } else {
        setGroups([]);
        setGroupsLoaded(true);
        return [];
      }
    } catch (error) {
      console.error('Error loading groups:', error);
      setGroups([]);
      setGroupsLoaded(true);
      return [];
    } finally {
      setIsLoadingGroups(false);
    }
  }, [groups, groupsLoaded]);

  /**
   * Clear all cached data (on logout)
   */
  const clearStore = useCallback(async () => {
    setFavorites([]);
    setFavoritesLoaded(false);
    setGroups([]);
    setGroupsLoaded(false);
    await AsyncStorage.multiRemove([STORAGE_KEYS.FAVORITES, STORAGE_KEYS.GROUPS]);
  }, []);

  /**
   * Invalidate favorites cache (force next load to fetch from API)
   */
  const invalidateFavorites = useCallback(() => {
    setFavoritesLoaded(false);
  }, []);

  /**
   * Invalidate groups cache
   */
  const invalidateGroups = useCallback(() => {
    setGroupsLoaded(false);
  }, []);

  // Context value
  const value = {
    // Favorites
    favorites,
    favoritesLoaded,
    isLoadingFavorites,
    loadFavorites,
    updateFavorites,
    addFavoriteToCache,
    removeFavoriteFromCache,
    invalidateFavorites,
    
    // Groups
    groups,
    groupsLoaded,
    isLoadingGroups,
    loadGroups,
    invalidateGroups,
    
    // Clear all
    clearStore,
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
};

export default StoreContext;

