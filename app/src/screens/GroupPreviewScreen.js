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
  Modal,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { authPost, reportNetworkError } from '../utils/apiHelper';

export default function GroupPreviewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, token } = useAuth();
  
  // Get data from navigation params
  const params = route.params || {};
  const { groupName, expenseTitle, amount, paidBy, selectedMembers, sourceScreen } = params;
  
  // Check if params are missing (e.g., on page refresh)
  const paramsValid = Boolean(groupName && expenseTitle && amount && selectedMembers?.length > 0 && paidBy);
  
  // State for expense with member splits
  const [expenses, setExpenses] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [activeExpenseIndex, setActiveExpenseIndex] = useState(null);
  const [memberAmounts, setMemberAmounts] = useState({});
  const [splitError, setSplitError] = useState(null);

  // Initialize expenses with equal split
  useEffect(() => {
    if (paramsValid && amount && selectedMembers?.length > 0 && paidBy) {
      // Build list of all members involved (payer + selected members, no duplicates)
      const allMembersMap = new Map();
      
      // Add payer first
      allMembersMap.set(paidBy.mailId, { mailId: paidBy.mailId, name: paidBy.name });
      
      // Add selected members
      selectedMembers.forEach(member => {
        if (!allMembersMap.has(member.mailId)) {
          allMembersMap.set(member.mailId, member);
        }
      });
      
      // Add current user if they're involved but not already in the list
      if (user && !allMembersMap.has(user.mailId)) {
        // Check if current user should be part of the split
        // (they are if they're in selectedMembers or if they're the payer)
        const isUserInvolved = paidBy.mailId === user.mailId || 
          selectedMembers.some(m => m.mailId === user.mailId);
        if (isUserInvolved) {
          allMembersMap.set(user.mailId, { mailId: user.mailId, name: user.name });
        }
      }
      
      const allMembers = Array.from(allMembersMap.values());
      const totalMembers = allMembers.length;
      const equalSplit = (parseFloat(amount) / totalMembers).toFixed(2);
      
      const initialSplits = {};
      allMembers.forEach(member => {
        initialSplits[member.mailId] = equalSplit;
      });
      
      setExpenses([{
        title: expenseTitle,
        totalAmount: parseFloat(amount),
        paidBy: paidBy.mailId,
        paidByName: paidBy.name,
        splits: initialSplits,
        members: allMembers
      }]);
    }
  }, [paramsValid, amount, selectedMembers, expenseTitle, paidBy, user]);

  // Redirect to Home if params are missing (e.g., on page refresh)
  useEffect(() => {
    if (!paramsValid && !isRedirecting) {
      setIsRedirecting(true);
      // Redirect to home on refresh
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = '/';
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      }
    }
  }, [paramsValid, isRedirecting, navigation]);
  
  // Show loading while redirecting
  if (!paramsValid || isRedirecting) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FF6B35' }}>
        <Text style={{ color: '#FFF', fontSize: 16 }}>Redirecting...</Text>
      </View>
    );
  }

  const handleBack = () => {
    navigation.goBack();
  };

  const openMemberModal = (expenseIndex) => {
    setActiveExpenseIndex(expenseIndex);
    const expense = expenses[expenseIndex];
    setMemberAmounts({ ...expense.splits });
    setSplitError(null);
    setModalVisible(true);
  };

  const handleAmountChange = (mailId, value) => {
    const numValue = value.replace(/[^0-9.]/g, '');
    setMemberAmounts(prev => ({
      ...prev,
      [mailId]: numValue
    }));
    setSplitError(null);
  };

  const validateAndSaveSplits = () => {
    const expense = expenses[activeExpenseIndex];
    const total = Object.values(memberAmounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    
    if (Math.abs(total - expense.totalAmount) > 0.01) {
      setSplitError(`Total must equal ₹${expense.totalAmount.toFixed(2)} (Current: ₹${total.toFixed(2)})`);
      return;
    }
    
    // Update expense splits
    const updatedExpenses = [...expenses];
    updatedExpenses[activeExpenseIndex].splits = { ...memberAmounts };
    setExpenses(updatedExpenses);
    setModalVisible(false);
  };

  const handleCheckout = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await authPost('/groups/checkout', {
        groupName: groupName,
        members: [user.mailId, ...selectedMembers.map(m => m.mailId)],
        expenses: expenses.map(exp => ({
          title: exp.title,
          totalAmount: exp.totalAmount,
          paidBy: exp.paidBy,
          splits: exp.splits,
        })),
      });

      const data = await response.json();

      if (data.success) {
        // Navigate to Split Summary with expenses and consolidated settlements
        navigation.navigate('SplitSummary', {
          groupId: data.data.groupId,
          groupName: data.data.groupName,
          consolidatedExpenses: data.data.consolidatedExpenses,
          // Pass the expenses with readable names for display
          expenses: expenses.map(exp => ({
            title: exp.title,
            totalAmount: exp.totalAmount,
            paidByName: exp.paidByName,
            memberCount: exp.members?.length || Object.keys(exp.splits || {}).length,
          })),
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

  const getSplitTotal = (expenseIndex) => {
    const expense = expenses[expenseIndex];
    if (!expense) return 0;
    return Object.values(expense.splits).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
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
          <Text style={styles.headerTitle}>Preview</Text>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.content}>
          <View style={styles.card}>
            {/* Group Name */}
            <View style={styles.groupNameSection}>
              <Text style={styles.groupNameLabel}>Group</Text>
              <Text style={styles.groupNameText} numberOfLines={1}>{groupName}</Text>
            </View>

            {/* Expenses List */}
            <View style={styles.expensesSection}>
              <Text style={styles.sectionTitle}>Expenses ({expenses.length})</Text>
              
              <ScrollView 
                style={styles.expensesScroll}
                contentContainerStyle={styles.expensesScrollContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {expenses.map((expense, index) => (
                  <View key={index} style={styles.expenseRow}>
                    <View style={styles.expenseTopRow}>
                      <Text style={styles.expenseTitle} numberOfLines={1}>{expense.title}</Text>
                      <Text style={styles.expenseAmount}>₹{expense.totalAmount.toFixed(2)}</Text>
                    </View>
                    <View style={styles.expenseBottomRow}>
                      <Text style={styles.expensePaidBy} numberOfLines={1}>Paid by: {expense.paidByName}</Text>
                      <TouchableOpacity 
                        style={styles.viewMembersLink}
                        onPress={() => openMemberModal(index)}
                      >
                        <Text style={styles.viewMembersText}>View expense</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* Error */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            )}

            {/* Checkout Button */}
            <TouchableOpacity
              style={[styles.createButton, isCreating && styles.createButtonDisabled]}
              onPress={handleCheckout}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.createButtonText}>Checkout</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Member Split Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>View Expense</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {activeExpenseIndex !== null && expenses[activeExpenseIndex] && (
              <>
                <View style={styles.modalTotalRow}>
                  <Text style={styles.modalTotalLabel}>Total Amount:</Text>
                  <Text style={styles.modalTotalValue}>
                    ₹{expenses[activeExpenseIndex].totalAmount.toFixed(2)}
                  </Text>
                </View>

                <ScrollView style={styles.membersList}>
                  {expenses[activeExpenseIndex].members.map(member => (
                    <View key={member.mailId} style={styles.memberRow}>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName} numberOfLines={1}>{member.name}</Text>
                        {member.mailId === expenses[activeExpenseIndex].paidBy && (
                          <Text style={styles.payerBadge}>Payer</Text>
                        )}
                      </View>
                      <View style={styles.amountInputContainer}>
                        <Text style={styles.currencySymbol}>₹</Text>
                        <TextInput
                          style={styles.amountInput}
                          value={memberAmounts[member.mailId]?.toString() || ''}
                          onChangeText={(value) => handleAmountChange(member.mailId, value)}
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          placeholderTextColor="#999"
                        />
                      </View>
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.modalSummary}>
                  <Text style={styles.summaryLabel}>Current Total:</Text>
                  <Text style={[
                    styles.summaryValue,
                    Math.abs(Object.values(memberAmounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0) - expenses[activeExpenseIndex].totalAmount) > 0.01 && styles.summaryValueError
                  ]}>
                    ₹{Object.values(memberAmounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0).toFixed(2)}
                  </Text>
                </View>

                {splitError && (
                  <Text style={styles.splitErrorText}>{splitError}</Text>
                )}

                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={validateAndSaveSplits}
                >
                  <Text style={styles.saveButtonText}>Save Split</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  groupNameSection: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  groupNameLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  groupNameText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  expensesSection: {
    flex: 1,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  expensesScroll: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
  },
  expensesScrollContent: {
    paddingBottom: 10,
  },
  expenseRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  expenseTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  expenseBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  expensePaidBy: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B35',
  },
  viewMembersLink: {
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  viewMembersText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF6B35',
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
    opacity: 0.7,
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  modalClose: {
    fontSize: 20,
    color: '#999',
    padding: 5,
  },
  modalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  modalTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  modalTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF6B35',
  },
  membersList: {
    maxHeight: 300,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  memberInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  payerBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF6B35',
    backgroundColor: '#FFF5F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    width: 110,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B35',
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    paddingVertical: 10,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  modalSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#28A745',
  },
  summaryValueError: {
    color: '#DC3545',
  },
  splitErrorText: {
    fontSize: 13,
    color: '#DC3545',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

