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
  KeyboardAvoidingView,
  BackHandler,
  Dimensions,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { authGet, authPost } from '../utils/apiHelper';

const isAndroid = Platform.OS === 'android';

export default function AddExternalTransactionScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  
  // Get group info from navigation params
  const { groupId, groupName } = route.params || {};
  
  // List of payments to submit
  const [payments, setPayments] = useState([]);
  
  // Current form state for adding new payment
  const [fromUser, setFromUser] = useState(null);
  const [toUser, setToUser] = useState(null);
  const [amount, setAmount] = useState('');
  
  // From user search state
  const [fromSearchQuery, setFromSearchQuery] = useState('');
  const [fromSearchResults, setFromSearchResults] = useState([]);
  const [isFromSearching, setIsFromSearching] = useState(false);
  const [isFromDropdownOpen, setIsFromDropdownOpen] = useState(false);
  
  // To user search state
  const [toSearchQuery, setToSearchQuery] = useState('');
  const [toSearchResults, setToSearchResults] = useState([]);
  const [isToSearching, setIsToSearching] = useState(false);
  const [isToDropdownOpen, setIsToDropdownOpen] = useState(false);
  
  // Group members (for quick selection)
  const [groupMembers, setGroupMembers] = useState([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({
    fromUser: false,
    toUser: false,
    amount: false,
  });

  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isMobileWeb = Platform.OS === 'web' && screenWidth < 768;

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  // Redirect to Home if no group selected
  useEffect(() => {
    if (!groupId) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = '/';
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      }
    }
  }, [groupId, navigation]);

  // Fetch group members
  useEffect(() => {
    const fetchGroupMembers = async () => {
      if (!groupId) return;
      
      try {
        const response = await authGet(`/groups/${groupId}`);
        const data = await response.json();
        
        if (data && data.expenses) {
          const membersSet = new Map();
          
          data.expenses.forEach(expense => {
            if (expense.payer) {
              const payerEmail = expense.payer.toLowerCase();
              if (!membersSet.has(payerEmail)) {
                membersSet.set(payerEmail, { 
                  mailId: payerEmail, 
                  name: payerEmail.split('@')[0] 
                });
              }
            }
            
            if (expense.payees) {
              expense.payees.forEach(payee => {
                const payeeEmail = typeof payee === 'object' ? payee.mailId : payee;
                const payeeName = typeof payee === 'object' ? payee.name : payeeEmail?.split('@')[0];
                if (payeeEmail && !membersSet.has(payeeEmail.toLowerCase())) {
                  membersSet.set(payeeEmail.toLowerCase(), { 
                    mailId: payeeEmail.toLowerCase(), 
                    name: payeeName || payeeEmail.split('@')[0] 
                  });
                }
              });
            }
          });
          
          setGroupMembers(Array.from(membersSet.values()));
        }
      } catch (error) {
        console.error('Error fetching group members:', error);
      }
    };
    
    fetchGroupMembers();
  }, [groupId]);

  // Fetch user names for group members
  useEffect(() => {
    const fetchUserNames = async () => {
      if (groupMembers.length === 0) return;
      
      try {
        const emails = groupMembers.map(m => m.mailId);
        const response = await authPost('/auth/users-by-emails', { emails });
        const data = await response.json();
        
        if (data.success && data.data) {
          setGroupMembers(prev => prev.map(member => ({
            ...member,
            name: data.data[member.mailId]?.name || member.name
          })));
        }
      } catch (error) {
        console.error('Error fetching user names:', error);
      }
    };
    
    fetchUserNames();
  }, [groupMembers.length]);

  // Search users for "from" field
  useEffect(() => {
    const searchFromUsers = async () => {
      if (fromSearchQuery.trim().length < 2) {
        const filtered = groupMembers.filter(m => 
          m.mailId !== toUser?.mailId
        );
        setFromSearchResults(filtered);
        return;
      }

      setIsFromSearching(true);
      try {
        const response = await authGet(`/auth/search?q=${encodeURIComponent(fromSearchQuery.trim())}`);
        const data = await response.json();
        
        if (data.success) {
          const filtered = data.data.filter(u => u.mailId !== toUser?.mailId);
          setFromSearchResults(filtered);
        }
      } catch (e) {
        console.error('From user search error:', e);
      } finally {
        setIsFromSearching(false);
      }
    };

    const debounce = setTimeout(searchFromUsers, 300);
    return () => clearTimeout(debounce);
  }, [fromSearchQuery, toUser?.mailId, groupMembers]);

  // Search users for "to" field
  useEffect(() => {
    const searchToUsers = async () => {
      if (toSearchQuery.trim().length < 2) {
        const filtered = groupMembers.filter(m => 
          m.mailId !== fromUser?.mailId
        );
        setToSearchResults(filtered);
        return;
      }

      setIsToSearching(true);
      try {
        const response = await authGet(`/auth/search?q=${encodeURIComponent(toSearchQuery.trim())}`);
        const data = await response.json();
        
        if (data.success) {
          const filtered = data.data.filter(u => u.mailId !== fromUser?.mailId);
          setToSearchResults(filtered);
        }
      } catch (e) {
        console.error('To user search error:', e);
      } finally {
        setIsToSearching(false);
      }
    };

    const debounce = setTimeout(searchToUsers, 300);
    return () => clearTimeout(debounce);
  }, [toSearchQuery, fromUser?.mailId, groupMembers]);

  // Handle back navigation
  const handleBack = () => {
    if (loading) return; // Prevent back while loading
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Groups', { selectedGroupId: groupId });
    }
  };

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (loading) return true; // Prevent back while loading
      handleBack();
      return true;
    });
    return () => backHandler.remove();
  }, [loading]);

  // Format amount with commas
  const formatAmount = (value) => {
    const numericValue = value.replace(/[^0-9.]/g, '');
    const parts = numericValue.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  // Validate current form for adding payment
  const validateCurrentForm = () => {
    const errors = {
      fromUser: !fromUser,
      toUser: !toUser,
      amount: !amount || parseFloat(amount.replace(/,/g, '')) <= 0,
    };
    
    setValidationErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  // Add payment to list
  const handleAddPayment = () => {
    if (!validateCurrentForm()) {
      setError('Please fill in all fields to add a payment');
      return;
    }

    if (fromUser.mailId === toUser.mailId) {
      setError('Payer and recipient cannot be the same person');
      return;
    }

    const parsedAmount = parseFloat(amount.replace(/,/g, ''));
    
    const newPayment = {
      id: Date.now().toString(),
      fromUser: { ...fromUser },
      toUser: { ...toUser },
      amount: parsedAmount,
    };

    setPayments(prev => [...prev, newPayment]);
    
    // Reset form
    setFromUser(null);
    setToUser(null);
    setAmount('');
    setFromSearchQuery('');
    setToSearchQuery('');
    setError(null);
    setValidationErrors({ fromUser: false, toUser: false, amount: false });
  };

  // Remove payment from list
  const handleRemovePayment = (paymentId) => {
    setPayments(prev => prev.filter(p => p.id !== paymentId));
  };

  // Submit all payments
  const handleSubmit = async () => {
    if (payments.length === 0) {
      setError('Please add at least one payment');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let successCount = 0;
      let totalAmount = 0;

      // Submit each payment sequentially
      const errorMessages = [];
      
      for (const payment of payments) {
        try {
          const response = await authPost(`/groups/${groupId}/add-external-payment`, {
            from: payment.fromUser.mailId,
            to: payment.toUser.mailId,
            amount: payment.amount,
          });
          
          const data = await response.json();
          
          // Check if response is ok (2xx status) and success is true
          if (response.ok && data.success) {
            successCount++;
            // Use the actual recorded amount (may be capped)
            const recordedAmt = data.data?.recordedAmount || payment.amount;
            totalAmount += recordedAmt;
            
            if (data.data?.wasCapped) {
              console.log(`Payment capped: Requested ₹${payment.amount}, recorded ₹${recordedAmt}`);
            }
          } else {
            // API returned error
            const errMsg = data.message || 'Unknown error';
            errorMessages.push(`${payment.fromUser.name} → ${payment.toUser.name}: ${errMsg}`);
            console.error('Failed to record payment:', errMsg);
          }
        } catch (paymentError) {
          // Individual payment failed, but continue with others
          errorMessages.push(`${payment.fromUser.name} → ${payment.toUser.name}: Network error`);
          console.error('Error recording individual payment:', paymentError);
        }
      }

      if (successCount > 0) {
        // Show success message
        let message;
        if (successCount === payments.length) {
          message = `All ${successCount} payment(s) totaling ₹${totalAmount.toFixed(2)} recorded successfully!`;
        } else {
          message = `${successCount} of ${payments.length} payments recorded (₹${totalAmount.toFixed(2)}).`;
          if (errorMessages.length > 0) {
            message += `\n\nFailed:\n${errorMessages.join('\n')}`;
          }
        }
        
        // Navigate back to groups screen after showing success
        const navigateBack = () => {
          navigation.navigate('Groups', { 
            selectedGroupId: groupId,
            refresh: Date.now()
          });
        };
        
        if (Platform.OS === 'web') {
          alert(message);
          navigateBack();
        } else {
          // On native, wait for user to press OK before navigating
          Alert.alert(
            '✅ Success',
            message,
            [
              {
                text: 'OK',
                onPress: navigateBack,
              }
            ],
            { cancelable: false }
          );
        }
      } else {
        // All payments failed - show specific errors if available
        if (errorMessages.length > 0) {
          setError(errorMessages.join('\n'));
        } else {
          setError('Failed to record any payments. Please try again.');
        }
        setLoading(false);
      }
    } catch (e) {
      console.error('Error recording payments:', e);
      setError('Failed to record payments. Please try again.');
      setLoading(false);
    }
  };

  // Calculate total amount
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  const renderUserSelector = (type, selectedUser, setSelectedUser, searchQuery, setSearchQuery, searchResults, isSearching, isDropdownOpen, setIsDropdownOpen) => {
    const label = type === 'from' ? 'Who Paid?' : 'Paid To?';
    const placeholder = type === 'from' ? 'Search who made the payment...' : 'Search who received the payment...';
    const hasError = type === 'from' ? validationErrors.fromUser : validationErrors.toUser;

    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>{label}</Text>
        
        {selectedUser ? (
          <View style={styles.selectedUserContainer}>
            <View style={styles.selectedUserInfo}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {selectedUser.name?.charAt(0).toUpperCase() || selectedUser.mailId?.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{selectedUser.name}</Text>
                <Text style={styles.userEmail}>{selectedUser.mailId}</Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={() => {
                setSelectedUser(null);
                setSearchQuery('');
              }}
              style={styles.removeUserButton}
              disabled={loading}
            >
              <Ionicons name="close-circle" size={24} color={loading ? "#CCC" : "#FF6B35"} />
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <TouchableOpacity
              style={[styles.dropdown, hasError && styles.dropdownError]}
              onPress={() => !loading && setIsDropdownOpen(!isDropdownOpen)}
              disabled={loading}
            >
              <TextInput
                style={styles.dropdownInput}
                placeholder={placeholder}
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  if (!isDropdownOpen) setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                editable={!loading}
              />
              <Ionicons 
                name={isDropdownOpen ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#666" 
              />
            </TouchableOpacity>
            
            {isDropdownOpen && !loading && (
              <View style={styles.dropdownList}>
                {isSearching ? (
                  <View style={styles.searchingContainer}>
                    <ActivityIndicator size="small" color="#FF6B35" />
                    <Text style={styles.searchingText}>Searching...</Text>
                  </View>
                ) : searchResults.length > 0 ? (
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                    {searchResults.map((user) => (
                      <TouchableOpacity
                        key={user.mailId}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setSelectedUser(user);
                          setIsDropdownOpen(false);
                          setSearchQuery('');
                        }}
                      >
                        <View style={styles.dropdownItemAvatar}>
                          <Text style={styles.dropdownItemAvatarText}>
                            {user.name?.charAt(0).toUpperCase() || user.mailId?.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.dropdownItemInfo}>
                          <Text style={styles.dropdownItemName}>{user.name}</Text>
                          <Text style={styles.dropdownItemEmail}>{user.mailId}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>
                      {searchQuery.length < 2 
                        ? 'Type at least 2 characters to search all users'
                        : 'No users found'}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  // Render payment card
  const renderPaymentCard = (payment, index) => (
    <View key={payment.id} style={styles.paymentCard}>
      <View style={styles.paymentCardHeader}>
        <Text style={styles.paymentCardIndex}>#{index + 1}</Text>
        <TouchableOpacity 
          onPress={() => handleRemovePayment(payment.id)}
          disabled={loading}
          style={styles.paymentCardRemove}
        >
          <Ionicons name="close-circle" size={22} color={loading ? "#CCC" : "#DC3545"} />
        </TouchableOpacity>
      </View>
      <View style={styles.paymentCardContent}>
        <View style={styles.paymentCardUsers}>
          <View style={styles.paymentCardUser}>
            <View style={styles.paymentCardUserAvatar}>
              <Text style={styles.paymentCardUserAvatarText}>
                {payment.fromUser.name?.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.paymentCardUserName} numberOfLines={1}>
              {payment.fromUser.name}
            </Text>
          </View>
          <View style={styles.paymentCardArrow}>
            <Ionicons name="arrow-forward" size={20} color="#FF6B35" />
          </View>
          <View style={styles.paymentCardUser}>
            <View style={styles.paymentCardUserAvatar}>
              <Text style={styles.paymentCardUserAvatarText}>
                {payment.toUser.name?.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.paymentCardUserName} numberOfLines={1}>
              {payment.toUser.name}
            </Text>
          </View>
        </View>
        <Text style={styles.paymentCardAmount}>₹{payment.amount.toFixed(2)}</Text>
      </View>
    </View>
  );

  // Common content for both layouts
  const formContent = (
    <>
      {/* Group Name Display */}
      <View style={styles.groupInfoContainer}>
        <Text style={styles.groupLabel}>GROUP</Text>
        <Text style={styles.groupName}>{groupName || 'Unknown Group'}</Text>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={20} color="#FF6B35" />
        <Text style={styles.infoBannerText}>
          Record payments made outside the app. Add multiple payments and submit them all at once.
        </Text>
      </View>

      {/* Added Payments List */}
      {payments.length > 0 && (
        <View style={styles.paymentsListContainer}>
          <View style={styles.paymentsListHeader}>
            <Text style={styles.paymentsListTitle}>Payments to Record ({payments.length})</Text>
            <Text style={styles.paymentsListTotal}>Total: ₹{totalAmount.toFixed(2)}</Text>
          </View>
          <ScrollView style={styles.paymentsList} nestedScrollEnabled>
            {payments.map((payment, index) => renderPaymentCard(payment, index))}
          </ScrollView>
        </View>
      )}

      {/* Add New Payment Section */}
      <View style={styles.addPaymentSection}>
        <Text style={styles.addPaymentTitle}>
          {payments.length > 0 ? 'Add Another Payment' : 'Add Payment'}
        </Text>

        {/* From User Selector */}
        {renderUserSelector(
          'from',
          fromUser,
          setFromUser,
          fromSearchQuery,
          setFromSearchQuery,
          fromSearchResults,
          isFromSearching,
          isFromDropdownOpen,
          setIsFromDropdownOpen
        )}

        {/* To User Selector */}
        {renderUserSelector(
          'to',
          toUser,
          setToUser,
          toSearchQuery,
          setToSearchQuery,
          toSearchResults,
          isToSearching,
          isToDropdownOpen,
          setIsToDropdownOpen
        )}

        {/* Amount Input */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Amount Paid</Text>
          <View style={[styles.amountInputContainer, validationErrors.amount && styles.inputError]}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={(text) => setAmount(formatAmount(text))}
              editable={!loading}
            />
          </View>
        </View>

        {/* Add Payment Button */}
        <TouchableOpacity
          style={[styles.addPaymentButton, loading && styles.buttonDisabled]}
          onPress={handleAddPayment}
          disabled={loading}
        >
          <Ionicons name="add-circle-outline" size={22} color={loading ? "#CCC" : "#FF6B35"} />
          <Text style={[styles.addPaymentButtonText, loading && styles.buttonTextDisabled]}>
            Add to List
          </Text>
        </TouchableOpacity>
      </View>

      {/* Error Display */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color="#DC3545" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton, 
          (loading || payments.length === 0) && styles.submitButtonDisabled
        ]}
        onPress={handleSubmit}
        disabled={loading || payments.length === 0}
      >
        {loading ? (
          <>
            <ActivityIndicator color="#FFF" size="small" />
            <Text style={styles.submitButtonText}>Recording Payments...</Text>
          </>
        ) : (
          <>
            <Ionicons name="checkmark-done-circle-outline" size={24} color="#FFF" />
            <Text style={styles.submitButtonText}>
              Mark {payments.length > 0 ? `${payments.length} Payment${payments.length > 1 ? 's' : ''}` : ''} as Resolved
            </Text>
          </>
        )}
      </TouchableOpacity>
    </>
  );

  // Android layout
  if (isAndroid) {
    return (
      <View style={androidStyles.container}>
        <LinearGradient
          colors={['#F57C3A', '#E85A24', '#D84315']}
          style={androidStyles.gradient}
        >
          <StatusBar style="light" />
          
          {/* Header */}
          <View style={androidStyles.header}>
            <Pressable 
              onPress={handleBack} 
              style={[androidStyles.backButton, loading && { opacity: 0.5 }]}
              disabled={loading}
            >
              <Ionicons name="arrow-back" size={24} color="#E85A24" />
            </Pressable>
            <Text style={androidStyles.headerTitle}>Record External Payments</Text>
            <View style={androidStyles.headerRight} />
          </View>

          {/* Decorative Icon */}
          <View style={androidStyles.decorativeIconContainer}>
            <View style={androidStyles.decorativeIconCircle}>
              <Ionicons name="wallet-outline" size={26} color="#E85A24" />
            </View>
          </View>

          {/* White Content Area with Curved Top */}
          <View style={androidStyles.content}>
            <ScrollView 
              style={androidStyles.scrollView}
              contentContainerStyle={androidStyles.scrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {formContent}
            </ScrollView>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // Web/iOS layout
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
          <Pressable 
            onPress={handleBack} 
            style={[styles.backButton, loading && { opacity: 0.5 }]}
            disabled={loading}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Record External Payments</Text>
          <View style={styles.headerRight} />
        </View>

        {/* White Background Card */}
        <View style={styles.content}>
          <View style={styles.card}>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {formContent}
            </ScrollView>
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
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
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
    flex: 1,
    textAlign: 'center',
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
  cardMobileWeb: {
    // No special styling needed for mobile web
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  groupInfoContainer: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    marginBottom: 4,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF5F0',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    gap: 10,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  paymentsListContainer: {
    marginBottom: 24,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
  },
  paymentsListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentsListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  paymentsListTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF6B35',
  },
  paymentsList: {
    maxHeight: 200,
  },
  paymentCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  paymentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentCardIndex: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
  },
  paymentCardRemove: {
    padding: 2,
  },
  paymentCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  paymentCardUsers: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
    gap: 4,
  },
  paymentCardUser: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentCardUserAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  paymentCardUserAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B35',
  },
  paymentCardUserName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    maxWidth: 100,
  },
  paymentCardArrow: {
    paddingHorizontal: 12,
  },
  paymentCardAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#28A745',
    marginLeft: 'auto',
  },
  addPaymentSection: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderStyle: 'dashed',
  },
  addPaymentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  selectedUserContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  selectedUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  userEmail: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  removeUserButton: {
    padding: 4,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 12,
    height: 50,
  },
  dropdownError: {
    borderColor: '#DC3545',
  },
  dropdownInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  dropdownList: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 8,
    maxHeight: 200,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      },
      default: {
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dropdownItemAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dropdownItemAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
  },
  dropdownItemInfo: {
    flex: 1,
  },
  dropdownItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  dropdownItemEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  searchingText: {
    fontSize: 14,
    color: '#666',
  },
  noResultsContainer: {
    padding: 16,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 12,
    height: 50,
  },
  inputError: {
    borderColor: '#DC3545',
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    paddingVertical: 0,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  addPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FF6B35',
    gap: 8,
    marginTop: 32,
    marginBottom: 20,
  },
  addPaymentButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B35',
  },
  buttonDisabled: {
    borderColor: '#CCC',
  },
  buttonTextDisabled: {
    color: '#CCC',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F0',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#DC3545',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 24,
  },
  submitButtonDisabled: {
    backgroundColor: '#CCC',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
});

const androidStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F57C3A',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  headerRight: {
    width: 44,
  },
  decorativeIconContainer: {
    alignItems: 'center',
    marginTop: 5,
    marginBottom: -25,
    zIndex: 20,
  },
  decorativeIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: 0,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
});
