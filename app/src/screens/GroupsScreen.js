import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
  Platform,
  RefreshControl,
  ActivityIndicator,
  Modal,
  BackHandler,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { authGet, authPost } from '../utils/apiHelper';
import { useAuth } from '../context/AuthContext';

export default function GroupsScreen({ route }) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupDetails, setGroupDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [memberNames, setMemberNames] = useState({});
  
  // Modal state for viewing member splits
  const [modalVisible, setModalVisible] = useState(false);
  const [activeExpenseIndex, setActiveExpenseIndex] = useState(null);

  // Fetch user's groups
  const fetchGroups = async () => {
    try {
      const response = await authGet('/groups');
      const data = await response.json();
      if (Array.isArray(data)) {
        setGroups(data);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch member names from emails
  const fetchMemberNames = async (emails) => {
    try {
      const response = await authPost('/auth/friends/details', { emails: Array.from(emails) });
      const data = await response.json();
      if (data.success && data.data) {
        const names = {};
        data.data.forEach(member => {
          names[member.mailId] = member.name;
        });
        // Add current user's name
        if (user) {
          names[user.mailId] = user.name || user.mailId.split('@')[0];
        }
        return names;
      }
    } catch (e) {
      console.error('Error fetching member names:', e);
    }
    
    // Fallback to email prefix
    const names = {};
    emails.forEach(email => {
      names[email] = email.split('@')[0];
    });
    if (user) {
      names[user.mailId] = user.name || user.mailId.split('@')[0];
    }
    return names;
  };

  // Fetch group details when a group is selected
  const fetchGroupDetails = async (groupId, existingGroupData = null) => {
    setLoadingDetails(true);
    try {
      let data;
      
      // Use existing data or fetch fresh
      if (existingGroupData && existingGroupData.expenses && existingGroupData.expenses.length > 0) {
        data = existingGroupData;
      } else {
        const response = await authGet(`/groups/${groupId}`);
        data = await response.json();
      }
      
      // Extract all unique member emails
      const memberEmails = new Set();
      if (data.expenses && Array.isArray(data.expenses)) {
        data.expenses.forEach(exp => {
          if (exp.payer) memberEmails.add(exp.payer);
          if (exp.payees && Array.isArray(exp.payees)) {
            exp.payees.forEach(p => {
              if (typeof p === 'object' && p.mailId) {
                memberEmails.add(p.mailId);
              } else if (typeof p === 'string') {
                memberEmails.add(p);
              }
            });
          }
        });
      }
      
      if (data.consolidatedExpenses && Array.isArray(data.consolidatedExpenses)) {
        data.consolidatedExpenses.forEach(ce => {
          if (ce.from) memberEmails.add(ce.from);
          if (ce.to) memberEmails.add(ce.to);
        });
      }
      
      // Fetch member names
      const names = await fetchMemberNames(memberEmails);
      setMemberNames(names);
      setGroupDetails(data);
      
    } catch (error) {
      console.error('Error fetching group details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGroups();
    if (selectedGroup) {
      const groupId = selectedGroup._id || selectedGroup.id;
      await fetchGroupDetails(groupId);
    }
    setRefreshing(false);
  }, [selectedGroup]);

  const handleBack = useCallback(() => {
    if (selectedGroup) {
      setSelectedGroup(null);
      setGroupDetails(null);
    } else {
      // On mobile, just navigate to Home. On web, handle side panel
      if (Platform.OS !== 'web') {
        navigation.navigate('Home');
      } else {
        const openSidePanel = route?.params?.fromSidePanel;
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home', params: openSidePanel ? { openSidePanel } : undefined }],
        });
      }
    }
  }, [selectedGroup, navigation, route?.params?.fromSidePanel]);

  // Handle Android hardware back button
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBack();
        return true; // Prevent default behavior
      });
      return () => backHandler.remove();
    }
  }, [handleBack]);

  const handleSelectGroup = async (group) => {
    setSelectedGroup(group);
    const groupId = group._id || group.id;
    await fetchGroupDetails(groupId, group);
  };

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getMemberName = (email) => {
    return memberNames[email] || email?.split('@')[0] || 'Unknown';
  };

  // Open member modal
  const openMemberModal = (expenseIndex) => {
    setActiveExpenseIndex(expenseIndex);
    setModalVisible(true);
  };

  // Get expense members with their split amounts
  const getExpenseMembers = (expense) => {
    if (!expense || !expense.payees) return [];
    
    return expense.payees.map(p => {
      if (typeof p === 'object') {
        return {
          mailId: p.mailId,
          name: getMemberName(p.mailId),
          amount: p.amount,
          isPayer: p.mailId === expense.payer
        };
      } else {
        // Old format - string email
        const totalAmount = expense.totalAmount || expense.amount || 0;
        const splitAmount = totalAmount / (expense.payees.length || 1);
        return {
          mailId: p,
          name: getMemberName(p),
          amount: splitAmount,
          isPayer: p === expense.payer
        };
      }
    });
  };

  // Render group list view
  const renderGroupList = () => (
    <>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search groups..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Groups List */}
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
          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#FF6B35" />
              <Text style={styles.loadingText}>Loading groups...</Text>
            </View>
          ) : filteredGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No groups found' : 'Search for a group'}
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery 
                  ? `No groups matching "${searchQuery}"`
                  : 'Search for a group to view expenses'
                }
              </Text>
            </View>
          ) : (
            <View style={styles.groupsList}>
              {filteredGroups.map((group, index) => (
                <TouchableOpacity
                  key={group._id || group.id}
                  style={[
                    styles.groupItem,
                    index < filteredGroups.length - 1 && styles.groupItemBorder
                  ]}
                  onPress={() => handleSelectGroup(group)}
                >
                  <View style={styles.groupIcon}>
                    <Text style={styles.groupIconText}>
                      {group.name.substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.groupInfo}>
                    <Text style={styles.groupName}>{group.name}</Text>
                    <Text style={[
                      styles.groupStatus,
                      group.status === 'completed' && styles.groupStatusCompleted
                    ]}>
                      {group.status === 'active' ? '● Active' : '✓ Completed'}
                    </Text>
                  </View>
                  <Text style={styles.groupArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );

  // Render group details view (same format as Preview)
  const renderGroupDetails = () => {
    const expenses = groupDetails?.expenses || [];
    
    return (
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
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
          {/* Group Name */}
          <View style={styles.groupNameSection}>
            <Text style={styles.groupNameLabel}>Group</Text>
            <Text style={styles.groupNameText}>{selectedGroup?.name}</Text>
          </View>

          {loadingDetails ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#FF6B35" />
              <Text style={styles.loadingText}>Loading expenses...</Text>
            </View>
          ) : (
            <>
              {/* Expenses List - Same format as Preview */}
              <View style={styles.expensesSection}>
                <Text style={styles.sectionTitle}>
                  Expenses ({expenses.length})
                </Text>
                
                {expenses.length > 0 ? (
                  <ScrollView 
                    style={[
                      styles.expensesScroll,
                      expenses.length > 3 && styles.expensesScrollLimited
                    ]}
                    showsVerticalScrollIndicator={expenses.length > 3}
                    nestedScrollEnabled={true}
                  >
                    {expenses.map((expense, index) => (
                      <View key={index} style={styles.expenseRow}>
                        <View style={styles.expenseTopRow}>
                          <Text style={styles.expenseTitle} numberOfLines={1}>
                            {expense.name || expense.title || 'Expense'}
                          </Text>
                          <Text style={styles.expenseAmount}>
                            ₹{parseFloat(expense.totalAmount || expense.amount || 0).toFixed(2)}
                          </Text>
                        </View>
                        <View style={styles.expenseBottomRow}>
                          <Text style={styles.expensePaidBy} numberOfLines={1}>
                            Paid by: {getMemberName(expense.payer)}
                          </Text>
                          <TouchableOpacity 
                            style={styles.viewMembersLink}
                            onPress={() => openMemberModal(index)}
                          >
                            <Text style={styles.viewMembersText}>View member list</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.noExpenses}>
                    <Text style={styles.noExpensesText}>No expenses in this group</Text>
                  </View>
                )}
              </View>

            </>
          )}
        </View>
      </ScrollView>
    );
  };

  // Get current expense for modal
  const currentExpense = activeExpenseIndex !== null && groupDetails?.expenses?.[activeExpenseIndex];
  const expenseMembers = currentExpense ? getExpenseMembers(currentExpense) : [];

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
          <Text style={styles.headerTitle}>
            {selectedGroup ? selectedGroup.name : 'Groups'}
          </Text>
          <View style={styles.headerRight} />
        </View>

        {selectedGroup ? renderGroupDetails() : renderGroupList()}
      </LinearGradient>

      {/* Member Split Modal - Same as Preview */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Split Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {currentExpense && (
              <>
                <View style={styles.modalTotalRow}>
                  <Text style={styles.modalTotalLabel}>Total Amount:</Text>
                  <Text style={styles.modalTotalValue}>
                    ₹{parseFloat(currentExpense.totalAmount || currentExpense.amount || 0).toFixed(2)}
                  </Text>
                </View>

                <ScrollView style={styles.membersList}>
                  {expenseMembers.map((member, index) => (
                    <View key={member.mailId || index} style={styles.memberRow}>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{member.name}</Text>
                        {member.mailId === currentExpense.payer && (
                          <Text style={styles.payerBadge}>Payer</Text>
                        )}
                      </View>
                      <View style={styles.amountDisplay}>
                        <Text style={styles.memberAmount}>
                          ₹{parseFloat(member.amount || 0).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
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
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 44,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 50,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  clearIcon: {
    fontSize: 16,
    color: '#999',
    padding: 5,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingTop: 10,
    flexGrow: 1,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    minHeight: 300,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  groupsList: {
    flex: 1,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  groupItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  groupIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  groupIconText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  groupStatus: {
    fontSize: 13,
    color: '#28A745', // Green for active
    fontWeight: '500',
  },
  groupStatusCompleted: {
    color: '#6C757D', // Gray for completed
  },
  groupArrow: {
    fontSize: 24,
    color: '#CCC',
    fontWeight: '300',
  },
  // Group Details Styles (matching Preview)
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
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
  },
  expensesScrollLimited: {
    maxHeight: 270, // ~3 rows (90px per row)
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
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  viewMembersText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B35',
  },
  noExpenses: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
  },
  noExpensesText: {
    fontSize: 15,
    color: '#888',
  },
  // Modal Styles (matching Preview)
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
  amountDisplay: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 90,
    alignItems: 'flex-end',
  },
  memberAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});
