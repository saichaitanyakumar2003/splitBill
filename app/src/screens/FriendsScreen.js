import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authGet, authPost, authDelete, reportNetworkError } from '../utils/apiHelper';

// Max favorites limit
const MAX_FAVORITES = 20;

export default function FriendsScreen({ route }) {
  const navigation = useNavigation();
  const { user, token, initializeAuth } = useAuth();
  const { 
    favorites: cachedFavorites, 
    isLoadingFavorites,
    loadFavorites: loadFavoritesFromStore,
    updateFavorites: updateFavoritesInStore,
    removeFavoriteFromCache,
  } = useStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [localFavorites, setLocalFavorites] = useState([]);
  const [originalFavorites, setOriginalFavorites] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Track pending additions only (removals are immediate)
  const [pendingAdditions, setPendingAdditions] = useState([]);
  
  // Check if there are unsaved changes
  const hasChanges = pendingAdditions.length > 0;
  
  // Load favorites from store (cached or API)
  useEffect(() => {
    const initFavorites = async () => {
      if (user?.friends) {
        const favs = await loadFavoritesFromStore(token, user.friends);
        setLocalFavorites(favs);
        setOriginalFavorites(favs);
        setIsInitialized(true);
      } else {
        setLocalFavorites([]);
        setOriginalFavorites([]);
        setIsInitialized(true);
      }
    };
    
    initFavorites();
  }, [user?.friends, token, loadFavoritesFromStore]);

  // Alias for local state
  const favorites = localFavorites;
  const setFavorites = setLocalFavorites;

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    if (Platform.OS === 'web') return;
    setRefreshing(true);
    try {
      // Re-initialize auth to get fresh user data
      await initializeAuth();
      if (user?.friends) {
        const favs = await loadFavoritesFromStore(token, user.friends, true); // force refresh
        setLocalFavorites(favs);
        setOriginalFavorites(favs);
      }
    } catch (err) {
      console.log('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [user?.friends, token, loadFavoritesFromStore, initializeAuth]);

  const handleBack = () => {
    if (hasChanges) {
      // Could show confirmation dialog here
    }
    // On mobile, just go back. On web, handle side panel
    if (Platform.OS !== 'web') {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Home');
      }
    } else {
      const openSidePanel = route?.params?.fromSidePanel;
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home', params: openSidePanel ? { openSidePanel } : undefined }],
      });
    }
  };

  // Search users from API
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      setError(null);
      
      try {
        const response = await authGet(`/auth/search?q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await response.json();
        
        if (data.success) {
          setSearchResults(data.data);
        } else {
          setError(data.message);
        }
      } catch (e) {
        setError('Search failed');
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, token]);

  // Check if user is already in favorites (including pending additions)
  const isInFavorites = (mailId) => {
    return favorites.some(f => f.mailId === mailId);
  };

  const handleAddFavorite = (userToAdd) => {
    if (favorites.length >= MAX_FAVORITES) {
      setError(`Maximum ${MAX_FAVORITES} favorites allowed`);
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Add to local state
    setFavorites([...favorites, userToAdd]);
    setPendingAdditions([...pendingAdditions, userToAdd.mailId]);
    
    // Remove from search results
    setSearchResults(searchResults.filter(u => u.mailId !== userToAdd.mailId));
  };

  // Helper to add user back to search results if matches current query
  const addBackToSearchResults = (removedUser) => {
    if (searchQuery.trim().length >= 2) {
      const query = searchQuery.toLowerCase().trim();
      const matchesName = removedUser.name?.toLowerCase().includes(query);
      const matchesEmail = removedUser.mailId?.toLowerCase().includes(query);
      if (matchesName || matchesEmail) {
        // Add back to search results if not already there
        setSearchResults(prev => {
          if (!prev.some(u => u.mailId === removedUser.mailId)) {
            return [...prev, removedUser];
          }
          return prev;
        });
      }
    }
  };

  const handleRemoveFavorite = async (mailId) => {
    // Find the user being removed for potential re-add to search
    const removedUser = favorites.find(f => f.mailId === mailId);
    
    // If it was a pending addition, just remove from local state (not saved yet)
    if (pendingAdditions.includes(mailId)) {
      setFavorites(favorites.filter(f => f.mailId !== mailId));
      setPendingAdditions(pendingAdditions.filter(m => m !== mailId));
      // Add back to search results if matches query
      if (removedUser) addBackToSearchResults(removedUser);
      return;
    }
    
    // Otherwise delete immediately from DB
    try {
      const response = await authPost('/auth/friends/remove', { friendEmail: mailId });
      const data = await response.json();
      
      if (data.success) {
        const updatedFavorites = favorites.filter(f => f.mailId !== mailId);
        setFavorites(updatedFavorites);
        setOriginalFavorites(originalFavorites.filter(f => f.mailId !== mailId));
        
        // Add back to search results if matches query
        if (removedUser) addBackToSearchResults(removedUser);
        
        // Update store cache
        await removeFavoriteFromCache(mailId);
        
        // Update local storage and refresh context
        const meResponse = await authGet('/auth/me');
        const meData = await meResponse.json();
        if (meData.success) {
          await AsyncStorage.setItem('@splitbill_user', JSON.stringify(meData.data));
        }
      } else {
        setError(data.message || 'Failed to remove');
      }
    } catch (e) {
      setError('Failed to remove');
    }
  };

  const handleCancel = () => {
    // Reset to original state (only pending additions)
    setFavorites(originalFavorites);
    setPendingAdditions([]);
    setSearchQuery('');
    setError(null);
    setSuccessMsg(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    
    try {
      // Process all additions
      for (const mailId of pendingAdditions) {
        await authPost('/auth/friends/add', { friendEmail: mailId });
      }

      // Fetch updated user data from backend and refresh context
      const meResponse = await authGet('/auth/me');
      const meData = await meResponse.json();
      if (meData.success) {
        await AsyncStorage.setItem('@splitbill_user', JSON.stringify(meData.data));
      }

      // Update store cache with the complete list
      await updateFavoritesInStore(favorites);

      // Update original state (keep search results visible)
      setOriginalFavorites(favorites);
      setPendingAdditions([]);
      setSuccessMsg('Saved!');
      setTimeout(() => setSuccessMsg(null), 2000);
      
    } catch (e) {
      setError('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const isMaxLimitReached = favorites.length >= MAX_FAVORITES;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FF8C5A', '#FF6B35', '#FF5722', '#E64A19']}
        locations={[0, 0.3, 0.7, 1]}
        style={styles.gradient}
      >
        <StatusBar style="light" />
        
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Favorites</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Content */}
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            Platform.OS !== 'web' ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FFF"
                colors={['#FF6B35']}
              />
            ) : undefined
          }
        >
          <View style={styles.card}>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <View style={styles.searchBar}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name or email"
                  placeholderTextColor="#999"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {isSearching && <ActivityIndicator size="small" color="#FF6B35" />}
                {searchQuery.length > 0 && !isSearching && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Text style={styles.clearIcon}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            )}

            {/* Success Message */}
            {successMsg && (
              <View style={styles.successContainer}>
                <Text style={styles.successText}>✓ {successMsg}</Text>
              </View>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <View style={styles.searchResults}>
                <Text style={styles.sectionTitle}>Search Results</Text>
                <ScrollView 
                  style={styles.searchResultsList}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  {searchResults.map(searchUser => {
                    const alreadyAdded = isInFavorites(searchUser.mailId);
                    return (
                      <View key={searchUser.mailId} style={styles.userRow}>
                        <View style={styles.userInfo}>
                          <Text style={styles.userName}>{searchUser.name}</Text>
                          <Text style={styles.userEmail}>{searchUser.mailId}</Text>
                        </View>
                        {alreadyAdded ? (
                          <TouchableOpacity 
                            style={styles.removeButton}
                            onPress={() => handleRemoveFavorite(searchUser.mailId)}
                          >
                            <Text style={styles.removeIcon}>🗑️</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity 
                            style={[
                              styles.addButton,
                              isMaxLimitReached && styles.addButtonDisabled
                            ]}
                            onPress={() => handleAddFavorite(searchUser)}
                            disabled={isMaxLimitReached}
                          >
                            <Text style={[
                              styles.addButtonText,
                              isMaxLimitReached && styles.addButtonTextDisabled
                            ]}>Add</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* No Search Results */}
            {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>No users found</Text>
              </View>
            )}

            {/* Favorites List */}
            <View style={styles.favoritesSection}>
              {favorites.length > 0 && (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitleNoMargin}>Following</Text>
                  <Text style={styles.countText}>{favorites.length}/{MAX_FAVORITES}</Text>
                </View>
              )}
              {favorites.length > 0 ? (
                <View style={[
                  styles.favoritesList,
                  favorites.length > 5 && styles.favoritesListScrollable
                ]}>
                  <ScrollView 
                    showsVerticalScrollIndicator={favorites.length > 5}
                    nestedScrollEnabled={true}
                    scrollEnabled={favorites.length > 5}
                  >
                    {favorites.map(fav => (
                      <View 
                        key={fav.mailId} 
                        style={[
                          styles.userRow,
                          pendingAdditions.includes(fav.mailId) && styles.pendingAddRow
                        ]}
                      >
                        <View style={styles.userInfo}>
                          <Text style={styles.userName}>{fav.name}</Text>
                          <Text style={styles.userEmail}>{fav.mailId}</Text>
                        </View>
                        <TouchableOpacity 
                          style={styles.removeButton}
                          onPress={() => handleRemoveFavorite(fav.mailId)}
                        >
                          <Text style={styles.removeIcon}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : (
                <View style={styles.emptyStateCard}>
                  <Text style={styles.emptyTextBold}>No favorites yet</Text>
                  <Text style={styles.emptySubtextBold}>Search to add people you split bills with often</Text>
                </View>
              )}
            </View>

            {/* Action Buttons - Only show when there are changes */}
            {hasChanges && (
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={handleCancel}
                  disabled={isSaving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 65 : 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 28,
    color: '#FFF',
    fontWeight: '300',
    marginTop: -2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingTop: 0,
    flexGrow: 1,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    minHeight: 300,
  },
  searchContainer: {
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    ...(Platform.OS === 'web' && {
      outlineStyle: 'none',
    }),
  },
  clearIcon: {
    fontSize: 16,
    color: '#999',
    padding: 5,
  },
  errorContainer: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#FFE69C',
  },
  errorText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    fontWeight: '500',
  },
  successContainer: {
    backgroundColor: '#D4EDDA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#C3E6CB',
  },
  successText: {
    fontSize: 14,
    color: '#155724',
    textAlign: 'center',
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  countText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  searchResults: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchResultsList: {
    maxHeight: 200,
  },
  noResultsContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  noResultsText: {
    fontSize: 15,
    color: '#999',
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionTitleNoMargin: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  favoritesSection: {
    flex: 1,
  },
  favoritesList: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  favoritesListScrollable: {
    maxHeight: 300, // ~5 rows
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  pendingAddRow: {
    backgroundColor: '#FFF5F0',
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: '#888',
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FF6B35',
  },
  addButtonDisabled: {
    backgroundColor: '#CCC',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  addButtonTextDisabled: {
    color: '#999',
  },
  removeButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeIcon: {
    fontSize: 16,
  },
  emptyStateCard: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    marginTop: 10,
  },
  emptyTextBold: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtextBold: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginTop: 15,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#FF6B35',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B35',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});
