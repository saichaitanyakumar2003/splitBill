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
  BackHandler,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { authGet } from '../utils/apiHelper';

export default function AddExpenseScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, token } = useAuth();
  const { favorites, loadFavorites } = useStore();
  
  // Get selected group and billData from navigation params
  const { selectedGroup, billData } = route.params || {};
  const isFromBillScan = !!billData;
  
  // Form state - group name is fixed
  const [expenseTitle, setExpenseTitle] = useState(isFromBillScan ? billData?.merchantName || '' : '');
  const [amount, setAmount] = useState(isFromBillScan ? billData?.total?.toString() || '' : '');
  
  // Payer state
  const [paidBy, setPaidBy] = useState(null);
  const [isPayerDropdownOpen, setIsPayerDropdownOpen] = useState(false);
  const [payerSearchQuery, setPayerSearchQuery] = useState('');
  const [payerSearchResults, setPayerSearchResults] = useState([]);
  const [isPayerSearching, setIsPayerSearching] = useState(false);
  
  // Members state
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Search state for split with
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // UI state
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({
    expenseTitle: false,
    paidBy: false,
    amount: false,
    selectedMembers: false,
  });

  // Redirect to Home if no group selected (e.g., on page refresh)
  useEffect(() => {
    if (!selectedGroup) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = '/';
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      }
    }
  }, [selectedGroup, navigation]);
  
  // Set current user as default payer
  useEffect(() => {
    if (user && !paidBy) {
      setPaidBy({ mailId: user.mailId, name: user.name || 'You' });
    }
  }, [user]);
  
  // Search users for payer
  useEffect(() => {
    const searchPayerUsers = async () => {
      if (payerSearchQuery.trim().length < 2) {
        setPayerSearchResults([]);
        return;
      }

      setIsPayerSearching(true);
      try {
        const response = await authGet(`/auth/search?q=${encodeURIComponent(payerSearchQuery.trim())}`);
        const data = await response.json();
        
        if (data.success) {
          const filtered = data.data.filter(
            u => u.mailId !== paidBy?.mailId && u.mailId !== user?.mailId
          );
          setPayerSearchResults(filtered);
        }
      } catch (e) {
        console.error('Payer search error:', e);
      } finally {
        setIsPayerSearching(false);
      }
    };

    const debounce = setTimeout(searchPayerUsers, 300);
    return () => clearTimeout(debounce);
  }, [payerSearchQuery, token, paidBy?.mailId, user?.mailId]);

  // Load favorites on mount
  useEffect(() => {
    if (user?.friends) {
      loadFavorites(token, user.friends);
    }
  }, [user?.friends, token, loadFavorites]);

  // Search users for split
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await authGet(`/auth/search?q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await response.json();
        
        if (data.success) {
          const filtered = data.data.filter(
            u => !selectedMembers.some(m => m.mailId === u.mailId) && 
                 u.mailId !== paidBy?.mailId
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
  }, [searchQuery, token, selectedMembers, paidBy?.mailId]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };

  // Handle Android hardware back button
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backAction = () => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('Home');
        }
        return true;
      };
      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => backHandler.remove();
    }
  }, []);

  const handleSelectMember = (member) => {
    if (!selectedMembers.some(m => m.mailId === member.mailId)) {
      setSelectedMembers([...selectedMembers, member]);
      if (validationErrors.selectedMembers) {
        setValidationErrors(prev => ({ ...prev, selectedMembers: false }));
      }
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveMember = (mailId) => {
    setSelectedMembers(selectedMembers.filter(m => m.mailId !== mailId));
    if (paidBy?.mailId === mailId) {
      setPaidBy(user ? { mailId: user.mailId, name: user.name || 'You' } : null);
    }
  };

  const handleSelectFromFavorites = (fav) => {
    if (!selectedMembers.some(m => m.mailId === fav.mailId)) {
      setSelectedMembers([...selectedMembers, fav]);
      if (validationErrors.selectedMembers) {
        setValidationErrors(prev => ({ ...prev, selectedMembers: false }));
      }
    }
  };

  const validateForm = () => {
    const errors = {
      expenseTitle: !expenseTitle.trim(),
      paidBy: !paidBy,
      amount: !amount || parseFloat(amount) <= 0,
      selectedMembers: selectedMembers.length === 0,
    };
    
    setValidationErrors(errors);
    return !errors.expenseTitle && !errors.paidBy && !errors.amount && !errors.selectedMembers;
  };

  const handleContinue = async () => {
    setError(null);
    
    if (!validateForm()) {
      setError('Please fill all required fields');
      return;
    }

    // Navigate to appropriate preview screen
    if (isFromBillScan) {
      // Use specialized bill split preview for scanned bills
      navigation.navigate('BillSplitPreview', {
        groupId: selectedGroup.id, // Pass group ID for existing group
        groupName: selectedGroup.name,
        expenseTitle: expenseTitle.trim(),
        amount: parseFloat(amount),
        paidBy: paidBy,
        selectedMembers: selectedMembers,
        billData: billData,
      });
    } else {
      // Use regular preview for manual entry
      navigation.navigate('GroupPreview', {
        groupId: selectedGroup.id, // Pass group ID for existing group
        groupName: selectedGroup.name,
        expenseTitle: expenseTitle.trim(),
        amount: parseFloat(amount),
        paidBy: paidBy,
        selectedMembers: selectedMembers,
        sourceScreen: 'AddExpense',
      });
    }
  };
  
  const handleExpenseTitleChange = (text) => {
    setExpenseTitle(text);
    if (validationErrors.expenseTitle && text.trim()) {
      setValidationErrors(prev => ({ ...prev, expenseTitle: false }));
    }
  };
  
  const handleAmountChange = (text) => {
    const cleanedText = text.replace(/[^0-9.]/g, '');
    setAmount(cleanedText);
    if (validationErrors.amount && cleanedText && parseFloat(cleanedText) > 0) {
      setValidationErrors(prev => ({ ...prev, amount: false }));
    }
  };

  const togglePayerDropdown = () => {
    setIsPayerDropdownOpen(!isPayerDropdownOpen);
    if (!isPayerDropdownOpen) {
      setIsDropdownOpen(false);
      setPayerSearchQuery('');
      setPayerSearchResults([]);
    }
  };

  const selectPayer = (payer) => {
    setPaidBy(payer);
    setPayerSearchQuery('');
    setPayerSearchResults([]);
    setIsPayerDropdownOpen(false);
    if (validationErrors.paidBy) {
      setValidationErrors(prev => ({ ...prev, paidBy: false }));
    }
    if (selectedMembers.some(m => m.mailId === payer.mailId)) {
      setSelectedMembers(selectedMembers.filter(m => m.mailId !== payer.mailId));
    }
  };

  const availablePayerFavorites = favorites.filter(
    fav => fav.mailId !== paidBy?.mailId && fav.mailId !== user?.mailId
  );

  const availableFavorites = favorites.filter(
    fav => !selectedMembers.some(m => m.mailId === fav.mailId) && 
           fav.mailId !== paidBy?.mailId
  );

  const showCurrentUserInSplit = user && 
    paidBy?.mailId !== user.mailId && 
    !selectedMembers.some(m => m.mailId === user.mailId);
  
  const currentUserOption = showCurrentUserInSplit ? {
    mailId: user.mailId,
    name: `${user.name || 'You'} (You)`
  } : null;

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
    if (!isDropdownOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setIsPayerDropdownOpen(false);
    }
  };

  if (!selectedGroup) {
    return null;
  }

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
          <Text style={styles.headerTitle}>Add Expense</Text>
          <View style={styles.headerRight} />
        </View>

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}
        >
          <ScrollView 
            style={styles.cardScrollView}
            contentContainerStyle={styles.cardScrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
            <View style={styles.card}>
              {/* Group Name - Fixed/Read-only */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Group Name</Text>
                <View style={styles.fixedGroupContainer}>
                  <View style={styles.fixedGroupIcon}>
                    <Text style={styles.fixedGroupIconText}>
                      {selectedGroup.name.substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.fixedGroupName}>{selectedGroup.name}</Text>
                  <Text style={styles.fixedGroupBadge}>Selected</Text>
                </View>
              </View>

              {/* Expense Title */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Expense Title</Text>
                <TextInput
                  style={[styles.input, validationErrors.expenseTitle && styles.inputError]}
                  placeholder="e.g., Food & Drinks"
                  placeholderTextColor="#999"
                  value={expenseTitle}
                  onChangeText={handleExpenseTitleChange}
                />
              </View>

              {/* Paid By */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Paid By</Text>
                <TouchableOpacity 
                  style={[
                    styles.payerDropdownTrigger, 
                    isPayerDropdownOpen && styles.payerDropdownTriggerOpen,
                    validationErrors.paidBy && styles.dropdownError
                  ]}
                  onPress={togglePayerDropdown}
                  activeOpacity={0.8}
                >
                  {paidBy ? (
                    <View style={styles.payerChipContainer}>
                      <View style={styles.payerChip}>
                        <Text style={styles.payerChipText} numberOfLines={1}>
                          {paidBy.mailId === user?.mailId ? `${paidBy.name} (You)` : paidBy.name}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.payerPlaceholder}>Select who paid</Text>
                  )}
                  <Text style={[styles.dropdownArrow, isPayerDropdownOpen && styles.dropdownArrowUp]}>
                    {isPayerDropdownOpen ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>

                {isPayerDropdownOpen && (
                  <View style={styles.payerDropdownContent}>
                    <View style={styles.dropdownSearchBar}>
                      <Text style={styles.searchIcon}>🔍</Text>
                      <TextInput
                        style={styles.dropdownSearchInput}
                        placeholder="Search by name or email"
                        placeholderTextColor="#999"
                        value={payerSearchQuery}
                        onChangeText={setPayerSearchQuery}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {isPayerSearching && <ActivityIndicator size="small" color="#FF6B35" />}
                    </View>

                    <ScrollView 
                      style={styles.payerDropdownScroll}
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                      keyboardShouldPersistTaps="handled"
                    >
                      {payerSearchResults.length > 0 && (
                        <View style={styles.listSection}>
                          <Text style={styles.listSectionTitle}>Search Results</Text>
                          {payerSearchResults.map(result => (
                            <TouchableOpacity
                              key={result.mailId}
                              style={styles.listItem}
                              onPress={() => selectPayer(result)}
                            >
                              <View style={styles.userInfo}>
                                <Text style={styles.userName}>{result.name}</Text>
                                <Text style={styles.userEmail}>{result.mailId}</Text>
                              </View>
                              <Text style={styles.selectIcon}>○</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      {payerSearchResults.length === 0 && paidBy?.mailId !== user?.mailId && (
                        <View style={styles.listSection}>
                          <Text style={styles.listSectionTitle}>You</Text>
                          <TouchableOpacity
                            style={styles.listItem}
                            onPress={() => selectPayer({ mailId: user?.mailId, name: user?.name || 'You' })}
                          >
                            <View style={styles.userInfo}>
                              <Text style={styles.userName}>{user?.name || 'You'}</Text>
                              <Text style={styles.userEmail}>{user?.mailId}</Text>
                            </View>
                            <Text style={styles.selectIcon}>○</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {availablePayerFavorites.length > 0 && payerSearchResults.length === 0 && (
                        <View style={styles.listSection}>
                          <Text style={styles.listSectionTitle}>Favorites</Text>
                          {availablePayerFavorites.map(fav => (
                            <TouchableOpacity
                              key={fav.mailId}
                              style={styles.listItem}
                              onPress={() => selectPayer(fav)}
                            >
                              <View style={styles.userInfo}>
                                <Text style={styles.userName}>{fav.name}</Text>
                                <Text style={styles.userEmail}>{fav.mailId}</Text>
                              </View>
                              <Text style={styles.selectIcon}>○</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Amount */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Amount Paid
                  {isFromBillScan && <Text style={styles.labelHint}> (from scanned bill)</Text>}
                </Text>
                <View style={[
                  styles.amountInputContainer, 
                  validationErrors.amount && styles.inputError,
                  isFromBillScan && styles.amountInputLocked
                ]}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={[styles.amountInput, isFromBillScan && styles.amountInputDisabled]}
                    placeholder="0.00"
                    placeholderTextColor="#999"
                    value={amount}
                    onChangeText={handleAmountChange}
                    keyboardType="decimal-pad"
                    editable={!isFromBillScan}
                  />
                  {isFromBillScan && (
                    <Text style={styles.lockedIcon}>🔒</Text>
                  )}
                </View>
              </View>

              {/* Split With */}
              <View style={styles.splitWithSection}>
                <Text style={styles.label}>
                  Split With ({selectedMembers.length} selected)
                </Text>
                
                <TouchableOpacity 
                  style={[
                    styles.dropdownTrigger, 
                    isDropdownOpen && styles.dropdownTriggerOpen,
                    validationErrors.selectedMembers && styles.dropdownError
                  ]}
                  onPress={toggleDropdown}
                  activeOpacity={0.8}
                >
                  {selectedMembers.length === 0 ? (
                    <Text style={styles.dropdownPlaceholder}>Select members to split with</Text>
                  ) : (
                    <View style={styles.chipsPreview}>
                      {selectedMembers.slice(0, 2).map(member => (
                        <View key={member.mailId} style={styles.previewChip}>
                          <Text style={styles.previewChipText} numberOfLines={1}>
                            {member.name}
                          </Text>
                        </View>
                      ))}
                      {selectedMembers.length > 2 && (
                        <Text style={styles.moreCount}>+{selectedMembers.length - 2} more</Text>
                      )}
                    </View>
                  )}
                  <Text style={[styles.dropdownArrow, isDropdownOpen && styles.dropdownArrowUp]}>
                    {isDropdownOpen ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>

                {isDropdownOpen && (
                  <View style={styles.dropdownContent}>
                    {selectedMembers.length > 0 && (
                      <ScrollView 
                        style={styles.selectedChipsScrollContainer}
                        showsVerticalScrollIndicator={selectedMembers.length > 4}
                        nestedScrollEnabled={true}
                      >
                        <View style={styles.selectedChipsWrap}>
                          {selectedMembers.map(member => (
                            <View key={member.mailId} style={styles.memberChip}>
                              <Text style={styles.memberChipText} numberOfLines={1}>
                                {member.name}
                              </Text>
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

                    <View style={styles.dropdownSearchBar}>
                      <Text style={styles.searchIcon}>🔍</Text>
                      <TextInput
                        style={styles.dropdownSearchInput}
                        placeholder="Search by name or email"
                        placeholderTextColor="#999"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {isSearching && <ActivityIndicator size="small" color="#FF6B35" />}
                    </View>

                    <ScrollView 
                      style={styles.dropdownScroll}
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                      keyboardShouldPersistTaps="handled"
                    >
                      {searchResults.length > 0 && (
                        <View style={styles.listSection}>
                          <Text style={styles.listSectionTitle}>Search Results</Text>
                          {searchResults.map(result => (
                            <TouchableOpacity
                              key={result.mailId}
                              style={styles.listItem}
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

                      {currentUserOption && searchResults.length === 0 && (
                        <View style={styles.listSection}>
                          <Text style={styles.listSectionTitle}>Add Yourself</Text>
                          <TouchableOpacity
                            style={styles.listItem}
                            onPress={() => handleSelectFromFavorites({ mailId: user.mailId, name: user.name || 'You' })}
                          >
                            <View style={styles.userInfo}>
                              <Text style={styles.userName}>{user.name || 'You'} (You)</Text>
                              <Text style={styles.userEmail}>{user.mailId}</Text>
                            </View>
                            <Text style={styles.addIcon}>+</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {availableFavorites.length > 0 && searchResults.length === 0 && (
                        <View style={styles.listSection}>
                          <Text style={styles.listSectionTitle}>Favorites</Text>
                          {availableFavorites.map(fav => (
                            <TouchableOpacity
                              key={fav.mailId}
                              style={styles.listItem}
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
                      )}

                      {!currentUserOption && availableFavorites.length === 0 && searchResults.length === 0 && searchQuery.length < 2 && (
                        <Text style={styles.emptyText}>
                          Type to search for users
                        </Text>
                      )}

                      {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                        <Text style={styles.emptyText}>
                          No users found
                        </Text>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Error */}
              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>⚠️ {error}</Text>
                </View>
              )}

              {/* Continue Button */}
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleContinue}
                activeOpacity={0.8}
              >
                <Text style={styles.createButtonText}>Continue</Text>
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
    paddingTop: Platform.OS === 'ios' ? 65 : 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 10,
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
  cardScrollView: {
    flex: 1,
  },
  cardScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
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
  },
  inputGroup: {
    marginBottom: 20,
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
    borderWidth: 2,
    borderColor: 'transparent',
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  inputError: {
    borderColor: '#DC3545',
  },
  // Fixed Group Name Styles
  fixedGroupContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  fixedGroupIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fixedGroupIconText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  fixedGroupName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  fixedGroupBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B35',
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'transparent',
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
  amountInputLocked: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  amountInputDisabled: {
    color: '#2E7D32',
  },
  lockedIcon: {
    fontSize: 16,
    marginLeft: 8,
  },
  labelHint: {
    fontSize: 12,
    fontWeight: '400',
    color: '#4CAF50',
    fontStyle: 'italic',
  },
  payerDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  payerDropdownTriggerOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  payerPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  payerChipContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  payerChip: {
    backgroundColor: '#FF6B35',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    maxWidth: 200,
  },
  payerChipText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  payerDropdownContent: {
    backgroundColor: '#F5F5F5',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
  },
  payerDropdownScroll: {
    maxHeight: 180,
  },
  splitWithSection: {
    marginBottom: 20,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dropdownError: {
    borderColor: '#DC3545',
  },
  dropdownTriggerOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  dropdownPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  chipsPreview: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewChip: {
    backgroundColor: '#FF6B35',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 100,
  },
  previewChipText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  moreCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  dropdownArrowUp: {
    color: '#FF6B35',
  },
  dropdownContent: {
    backgroundColor: '#F5F5F5',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
  },
  selectedChipsScrollContainer: {
    maxHeight: 88,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFF5F0',
  },
  selectedChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
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
    gap: 6,
  },
  memberChipText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    maxWidth: 100,
  },
  memberChipRemove: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    margin: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  dropdownSearchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  listSection: {
    paddingBottom: 8,
  },
  listSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ECECEC',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
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
  selectIcon: {
    fontSize: 20,
    color: '#FF6B35',
    fontWeight: '400',
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 24,
    fontStyle: 'italic',
  },
  errorContainer: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
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
  createButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
});

