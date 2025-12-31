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
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';

// API Base URL
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3001/api' 
  : 'https://your-backend-url.onrender.com/api';

export default function CreateGroupScreen() {
  const navigation = useNavigation();
  const { user, token } = useAuth();
  const { favorites, loadFavorites } = useStore();
  
  // Form state
  const [groupName, setGroupName] = useState('');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [amount, setAmount] = useState('');
  
  // Members state
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // UI state
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

  // Load favorites on mount
  useEffect(() => {
    if (user?.friends) {
      loadFavorites(token, user.friends);
    }
  }, [user?.friends, token, loadFavorites]);

  // Search users
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/auth/search?q=${encodeURIComponent(searchQuery.trim())}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        const data = await response.json();
        
        if (data.success) {
          // Filter out already selected members
          const filtered = data.data.filter(
            u => !selectedMembers.some(m => m.mailId === u.mailId)
          );
          setSearchResults(filtered);
        }
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, token, selectedMembers]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('SplitOptions');
    }
  };

  const handleSelectMember = (member) => {
    if (!selectedMembers.some(m => m.mailId === member.mailId)) {
      setSelectedMembers([...selectedMembers, member]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveMember = (mailId) => {
    setSelectedMembers(selectedMembers.filter(m => m.mailId !== mailId));
  };

  const handleSelectFromFavorites = (fav) => {
    if (!selectedMembers.some(m => m.mailId === fav.mailId)) {
      setSelectedMembers([...selectedMembers, fav]);
    }
  };

  const isFormValid = () => {
    return groupName.trim() && expenseTitle.trim() && amount && parseFloat(amount) > 0 && selectedMembers.length > 0;
  };

  const handleCreateGroup = async () => {
    if (!isFormValid()) {
      setError('Please fill all fields and select at least one member');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Create group with initial expense
      const response = await fetch(`${API_BASE_URL}/groups`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: groupName.trim(),
          members: [user.mailId, ...selectedMembers.map(m => m.mailId)],
          expense: {
            name: expenseTitle.trim(),
            amount: parseFloat(amount),
            paidBy: user.mailId,
            splitWith: selectedMembers.map(m => m.mailId),
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Navigate to group details or home
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      } else {
        setError(data.message || 'Failed to create group');
      }
    } catch (e) {
      setError('Network error. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // Filter favorites to exclude already selected members
  const availableFavorites = favorites.filter(
    fav => !selectedMembers.some(m => m.mailId === fav.mailId)
  );

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
          <Text style={styles.headerTitle}>Create New Group</Text>
          <View style={styles.headerRight} />
        </View>

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.card}>
              {/* Group Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Group Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Dinner at Mario's"
                  placeholderTextColor="#999"
                  value={groupName}
                  onChangeText={setGroupName}
                />
              </View>

              {/* Expense Title */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Expense Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Food & Drinks"
                  placeholderTextColor="#999"
                  value={expenseTitle}
                  onChangeText={setExpenseTitle}
                />
              </View>

              {/* Amount */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Amount Paid by You</Text>
                <View style={styles.amountInputContainer}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0.00"
                    placeholderTextColor="#999"
                    value={amount}
                    onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ''))}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* Selected Members */}
              <View style={styles.membersSection}>
                <Text style={styles.label}>
                  Split With ({selectedMembers.length} selected)
                </Text>
                
                {selectedMembers.length > 0 && (
                  <ScrollView 
                    style={[
                      styles.selectedMembersScroll,
                      selectedMembers.length > 4 && styles.selectedMembersScrollLimited
                    ]}
                    showsVerticalScrollIndicator={selectedMembers.length > 4}
                    nestedScrollEnabled={true}
                  >
                    <View style={styles.selectedMembersContainer}>
                      {selectedMembers.map(member => (
                        <View key={member.mailId} style={styles.memberChip}>
                          <Text style={styles.memberChipText}>{member.name}</Text>
                          <TouchableOpacity 
                            onPress={() => handleRemoveMember(member.mailId)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Text style={styles.memberChipRemove}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                )}

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
                  </View>
                </View>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <View style={styles.searchResults}>
                    {searchResults.map(result => (
                      <TouchableOpacity
                        key={result.mailId}
                        style={styles.searchResultItem}
                        onPress={() => handleSelectMember(result)}
                      >
                        <View style={styles.userInfo}>
                          <Text style={styles.userName}>{result.name}</Text>
                          <Text style={styles.userEmail}>{result.mailId}</Text>
                        </View>
                        <Text style={styles.addIcon}>+</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Favorites Section */}
                {availableFavorites.length > 0 && (
                  <View style={styles.favoritesSection}>
                    <Text style={styles.favoritesTitle}>From Favorites ({availableFavorites.length})</Text>
                    <ScrollView 
                      style={[
                        styles.favoritesScroll,
                        availableFavorites.length > 4 && styles.favoritesScrollLimited
                      ]}
                      showsVerticalScrollIndicator={availableFavorites.length > 4}
                      nestedScrollEnabled={true}
                    >
                      <View style={styles.favoritesList}>
                        {availableFavorites.map(fav => (
                          <TouchableOpacity
                            key={fav.mailId}
                            style={styles.favoriteItem}
                            onPress={() => handleSelectFromFavorites(fav)}
                          >
                            <View style={styles.userInfo}>
                              <Text style={styles.userName}>{fav.name}</Text>
                              <Text style={styles.userEmail}>{fav.mailId}</Text>
                            </View>
                            <Text style={styles.addIcon}>+</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                )}

                {availableFavorites.length === 0 && searchQuery.length < 2 && selectedMembers.length === 0 && (
                  <Text style={styles.hintText}>
                    Search for users to add them to this group
                  </Text>
                )}
              </View>

              {/* Error */}
              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>⚠️ {error}</Text>
                </View>
              )}

              {/* Create Button */}
              <TouchableOpacity
                style={[styles.createButton, !isFormValid() && styles.createButtonDisabled]}
                onPress={handleCreateGroup}
                disabled={!isFormValid() || isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.createButtonText}>Continue</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  scrollView: {
    flex: 1,
    padding: 20,
    paddingTop: 0,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 40,
  },
  inputGroup: {
    marginBottom: 24,
  },
  membersSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FF6B35',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  selectedMembersScroll: {
    marginBottom: 16,
  },
  selectedMembersScrollLimited: {
    maxHeight: 88, // ~2 rows of chips (44px per row)
  },
  selectedMembersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    borderRadius: 20,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 10,
    gap: 8,
  },
  memberChipText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  memberChipRemove: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    marginBottom: 12,
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
    fontSize: 16,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  searchResults: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: '#888',
  },
  addIcon: {
    fontSize: 24,
    color: '#FF6B35',
    fontWeight: '600',
  },
  favoritesSection: {
    marginTop: 8,
  },
  favoritesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  favoritesScroll: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
  },
  favoritesScrollLimited: {
    maxHeight: 220, // ~4 rows (55px per row)
  },
  favoritesList: {
    overflow: 'hidden',
  },
  favoriteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  hintText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
  errorContainer: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFE69C',
  },
  errorText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    fontWeight: '500',
  },
  createButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#CCC',
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
});

