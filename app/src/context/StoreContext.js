import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authGet, authPost, reportNetworkError } from '../utils/apiHelper';

const STORAGE_KEYS = {
  FAVORITES: '@splitbill_favorites',
  GROUPS: '@splitbill_groups',
};

const StoreContext = createContext(null);

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};

export const StoreProvider = ({ children }) => {
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [groups, setGroups] = useState([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  const loadFavorites = useCallback(async (token, friendEmails, forceRefresh = false) => {
    if (favoritesLoaded && !forceRefresh && favorites.length > 0) {
      return favorites;
    }

    if (!friendEmails || friendEmails.length === 0) {
      setFavorites([]);
      setFavoritesLoaded(true);
      return [];
    }

    setIsLoadingFavorites(true);
    
    try {
      if (!forceRefresh) {
        const cached = await AsyncStorage.getItem(STORAGE_KEYS.FAVORITES);
        if (cached) {
          const cachedFavorites = JSON.parse(cached);
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

      const response = await authPost('/auth/friends/details', { emails: friendEmails });
      const data = await response.json();
      
      if (data.success && data.data) {
        setFavorites(data.data);
        setFavoritesLoaded(true);
        await AsyncStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(data.data));
        return data.data;
      } else {
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
  }, [favoritesLoaded]);

  const updateFavorites = useCallback(async (newFavorites) => {
    setFavorites(newFavorites);
    await AsyncStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(newFavorites));
  }, []);

  const addFavoriteToCache = useCallback(async (userToAdd) => {
    let updated;
    setFavorites(prev => {
      updated = [...prev, userToAdd];
      return updated;
    });
    await AsyncStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(updated));
    return updated;
  }, []);

  const removeFavoriteFromCache = useCallback(async (mailId) => {
    let updated;
    setFavorites(prev => {
      updated = prev.filter(f => f.mailId !== mailId);
      return updated;
    });
    await AsyncStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(updated));
    return updated;
  }, []);

  const loadGroups = useCallback(async (token, forceRefresh = false) => {
    if (groupsLoaded && !forceRefresh && groups.length > 0) {
      return groups;
    }

    setIsLoadingGroups(true);
    
    try {
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

      const response = await authGet('/groups');
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
  }, [groupsLoaded]);

  const clearStore = useCallback(async () => {
    setFavorites([]);
    setFavoritesLoaded(false);
    setGroups([]);
    setGroupsLoaded(false);
    await AsyncStorage.multiRemove([STORAGE_KEYS.FAVORITES, STORAGE_KEYS.GROUPS]);
  }, []);

  const invalidateFavorites = useCallback(() => {
    setFavoritesLoaded(false);
  }, []);

  const invalidateGroups = useCallback(() => {
    setGroupsLoaded(false);
  }, []);

  const value = {
    favorites,
    favoritesLoaded,
    isLoadingFavorites,
    loadFavorites,
    updateFavorites,
    addFavoriteToCache,
    removeFavoriteFromCache,
    invalidateFavorites,
    
    groups,
    groupsLoaded,
    isLoadingGroups,
    loadGroups,
    invalidateGroups,
    
    clearStore,
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
};

export default StoreContext;
