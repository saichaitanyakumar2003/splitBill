import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authGet, authPost, authDelete, reportNetworkError } from '../utils/apiHelper';

const MAX_FAVORITES = 20;

export default function FriendsScreen({ route }) {
  const navigation = useNavigation();
  const { user, token } = useAuth();
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
  
  const [pendingAdditions, setPendingAdditions] = useState([]);
  
  const hasChanges = pendingAdditions.length > 0;
  
  useEffect(() => {
    if (isInitialized) return;
    
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
  }, [user?.friends, token, loadFavoritesFromStore, isInitialized]);

  const favorites = localFavorites;
  const setFavorites = setLocalFavorites;

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const backAction = () => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Home');
      }
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => subscription.remove();
  }, [navigation]);

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
          const filtered = data.data.filter(
            u => u.mailId !== user?.mailId && !favorites.some(f => f.mailId === u.mailId)
          );
          setSearchResults(filtered);
        }
      } catch (e) {
        console.error('Search error:', e);
        setError('Search failed');
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, token, favorites, user?.mailId]);

  const isInFavorites = (mailId) => {
    return favorites.some(f => f.mailId === mailId);
  };

  const handleAddFavorite = (userToAdd) => {
    if (favorites.length >= MAX_FAVORITES) {
      setError(`Maximum ${MAX_FAVORITES} favorites allowed`);
      return;
    }

    setFavorites([...favorites, userToAdd]);
    setPendingAdditions([...pendingAdditions, userToAdd.mailId]);
    setSearchResults(searchResults.filter(u => u.mailId !== userToAdd.mailId));
    setError(null);
  };

  const addBackToSearchResults = (removedUser) => {
    if (searchQuery.trim().length >= 2) {
      const matchesSearch = 
        removedUser.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        removedUser.mailId?.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (matchesSearch) {
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
    const removedUser = favorites.find(f => f.mailId === mailId);
    
    if (pendingAdditions.includes(mailId)) {
      setFavorites(favorites.filter(f => f.mailId !== mailId));
      setPendingAdditions(pendingAdditions.filter(m => m !== mailId));
      if (removedUser) addBackToSearchResults(removedUser);
      return;
    }
    
    try {
      const response = await authPost('/auth/friends/remove', { friendEmail: mailId });
      const data = await response.json();
      
      if (data.success) {
        const updatedFavorites = favorites.filter(f => f.mailId !== mailId);
        setFavorites(updatedFavorites);
        setOriginalFavorites(originalFavorites.filter(f => f.mailId !== mailId));
        
        if (removedUser) addBackToSearchResults(removedUser);
        
        await removeFavoriteFromCache(mailId);
        
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
      for (const mailId of pendingAdditions) {
        await authPost('/auth/friends/add', { friendEmail: mailId });
      }

      const meResponse = await authGet('/auth/me');
      const meData = await meResponse.json();
      if (meData.success) {
        await AsyncStorage.setItem('@splitbill_user', JSON.stringify(meData.data));
      }

      await updateFavoritesInStore(favorites);

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
        
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Favorites</Text>
          <View style={styles.headerRight} />
        </View>

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

        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
        >
          <View style={styles.card}>
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            )}

            {successMsg && (
              <View style={styles.successContainer}>
                <Text style={styles.successText}>✓ {successMsg}</Text>
              </View>
            )}

            {searchResults.length > 0 && (
              <View style={styles.searchResults}>
                <Text style={styles.sectionTitle}>Search Results</Text>
                {searchResults.map(searchUser => {
                  const alreadyAdded = isInFavorites(searchUser.mailId);
                  return (
                    <View key={searchUser.mailId} style={styles.userRow}>
                      <View style={styles.userInfo}>
                        <Text style={styles.userName} numberOfLines={1}>{searchUser.name}</Text>
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
              </View>
            )}

            {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>No users found</Text>
              </View>
            )}

            <View style={styles.favoritesSection}>
              {favorites.length > 0 && (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitleNoMargin}>Following</Text>
                  <Text style={styles.countText}>{favorites.length}/{MAX_FAVORITES}</Text>
                </View>
              )}
              {favorites.length > 0 ? (
                <View style={styles.favoritesList}>
                  {favorites.map(fav => (
                    <View 
                      key={fav.mailId} 
                      style={[
                        styles.userRow,
                        pendingAdditions.includes(fav.mailId) && styles.pendingAddRow
                      ]}
                    >
                      <View style={styles.userInfo}>
                        <Text style={styles.userName} numberOfLines={1}>{fav.name}</Text>
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
                </View>
              ) : (
                <View style={styles.emptyStateCard}>
                  <Text style={styles.emptyTextBold}>No favorites yet</Text>
                  <Text style={styles.emptySubtextBold}>Search to add people you split bills with often</Text>
                </View>
              )}
            </View>

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
    paddingTop: Platform.OS === 'ios' ? 65 : (Platform.OS === 'web' ? 20 : 50),
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
    paddingHorizontal: 20,
    paddingBottom: 15,
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
    borderBottomColor: '#EEE',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sectionTitleNoMargin: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pendingAddRow: {
    backgroundColor: '#FFF8F0',
    marginHorizontal: -10,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  userInfo: {
    flex: 1,
    marginRight: 10,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  userEmail: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  addButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonDisabled: {
    backgroundColor: '#CCC',
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  addButtonTextDisabled: {
    color: '#888',
  },
  removeButton: {
    padding: 8,
  },
  removeIcon: {
    fontSize: 18,
  },
  favoritesSection: {
    flex: 1,
  },
  favoritesList: {
    flex: 1,
  },
  emptyStateCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTextBold: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtextBold: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  noResultsContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    color: '#888',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#FF6B35',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#FFB299',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
