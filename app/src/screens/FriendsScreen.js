import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';

// Max friends limit
const MAX_FRIENDS = 20;

// Mock data for friends (will be replaced with API data)
const mockFriends = [];

// Mock search results (will be replaced with API data)
const mockSearchResults = [];

export default function FriendsScreen() {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState(mockFriends);
  const [originalFriends, setOriginalFriends] = useState(mockFriends);
  const [searchResults, setSearchResults] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [pendingAdditions, setPendingAdditions] = useState([]);
  const [pendingDeletions, setPendingDeletions] = useState([]);
  const [showMaxLimitWarning, setShowMaxLimitWarning] = useState(false);
  
  // Check if max limit reached
  const isMaxLimitReached = friends.length >= MAX_FRIENDS;

  const handleBack = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  // Handle search
  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      // Filter mock search results based on query
      const results = mockSearchResults.filter(
        user => 
          (user.name.toLowerCase().includes(query) || 
           user.email.toLowerCase().includes(query)) &&
          !friends.find(f => f.id === user.id) &&
          !pendingAdditions.find(p => p.id === user.id)
      );
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, friends, pendingAdditions]);

  // Check for changes
  useEffect(() => {
    setHasChanges(pendingAdditions.length > 0 || pendingDeletions.length > 0);
  }, [pendingAdditions, pendingDeletions]);

  const handleAddFriend = (user) => {
    if (friends.length >= MAX_FRIENDS) {
      setShowMaxLimitWarning(true);
      setTimeout(() => setShowMaxLimitWarning(false), 3000);
      return;
    }
    setPendingAdditions([...pendingAdditions, user]);
    setFriends([...friends, user]);
    setSearchQuery('');
  };
  
  const handleDisabledAddPress = () => {
    setShowMaxLimitWarning(true);
    setTimeout(() => setShowMaxLimitWarning(false), 3000);
  };

  const handleDeleteFriend = (userId) => {
    const friendToDelete = friends.find(f => f.id === userId);
    if (friendToDelete) {
      // Check if it's a pending addition
      if (pendingAdditions.find(p => p.id === userId)) {
        setPendingAdditions(pendingAdditions.filter(p => p.id !== userId));
      } else {
        setPendingDeletions([...pendingDeletions, friendToDelete]);
      }
      setFriends(friends.filter(f => f.id !== userId));
    }
  };

  const handleCancel = () => {
    // Revert all changes
    setFriends(originalFriends);
    setPendingAdditions([]);
    setPendingDeletions([]);
    setSearchQuery('');
  };

  const handleSave = () => {
    // TODO: Call API to save changes
    // For now, just update the original state
    setOriginalFriends(friends);
    setPendingAdditions([]);
    setPendingDeletions([]);
    alert('Changes saved successfully!');
  };

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
          <Text style={styles.headerTitle}>Friends</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Content */}
        <View style={styles.content}>
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
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Text style={styles.clearIcon}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Max Limit Warning */}
            {showMaxLimitWarning && (
              <View style={styles.warningContainer}>
                <Text style={styles.warningText}>
                  ⚠️ You have reached the maximum limit of {MAX_FRIENDS} friends
                </Text>
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
                  {searchResults.map(user => (
                    <View key={user.id} style={styles.friendRow}>
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName}>{user.name}</Text>
                        <Text style={styles.friendEmail}>{user.email}</Text>
                      </View>
                      <TouchableOpacity 
                        style={[
                          styles.addButton,
                          isMaxLimitReached && styles.addButtonDisabled
                        ]}
                        onPress={isMaxLimitReached ? handleDisabledAddPress : () => handleAddFriend(user)}
                        activeOpacity={isMaxLimitReached ? 1 : 0.7}
                      >
                        <Text style={[
                          styles.addIcon,
                          isMaxLimitReached && styles.addIconDisabled
                        ]}>+</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* No Search Results */}
            {searchQuery.trim() !== '' && searchResults.length === 0 && (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>No results found</Text>
              </View>
            )}

            {/* Friends List */}
            <View style={styles.friendsSection}>
              {friends.length > 0 && (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitleNoMargin}>All Friends</Text>
                  <Text style={styles.countText}>{friends.length}/{MAX_FRIENDS}</Text>
                </View>
              )}
              {friends.length > 0 ? (
                <ScrollView 
                  style={styles.friendsList} 
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  {friends.map(friend => (
                    <View key={friend.id} style={[
                      styles.friendRow,
                      pendingAdditions.find(p => p.id === friend.id) && styles.pendingRow
                    ]}>
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName}>{friend.name}</Text>
                        <Text style={styles.friendEmail}>{friend.email}</Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.deleteButton}
                        onPress={() => handleDeleteFriend(friend.id)}
                      >
                        <Text style={styles.deleteIcon}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.emptyStateCard}>
                  <Text style={styles.emptyTextBold}>You have no friends added</Text>
                  <Text style={styles.emptySubtextBold}>Search to add friends</Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            {hasChanges && (
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={handleCancel}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.saveButton}
                  onPress={handleSave}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
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
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
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
    padding: 20,
    paddingTop: 0,
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
  warningContainer: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#FFE69C',
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    fontWeight: '500',
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
    maxHeight: 300, // ~5 items (60px each)
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
  friendsSection: {
    flex: 1,
  },
  friendsList: {
    maxHeight: 300, // ~5 items (60px each)
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  pendingRow: {
    backgroundColor: '#FFF5F0',
    marginHorizontal: -10,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  friendEmail: {
    fontSize: 14,
    color: '#666',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIcon: {
    fontSize: 22,
    color: '#FFF',
    fontWeight: '600',
    marginTop: -2,
  },
  addButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  addIconDisabled: {
    color: '#999',
  },
  deleteButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIcon: {
    fontSize: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#BBB',
  },
  emptyStateCard: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
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
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
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
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});
