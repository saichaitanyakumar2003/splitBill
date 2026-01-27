import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
  Platform,
  ActivityIndicator,
  Modal,
  BackHandler,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { authGet, authPost, authDelete, authPut } from '../utils/apiHelper';
import { useAuth } from '../context/AuthContext';

export default function GroupsScreen({ route }) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groups, setGroups] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupDetails, setGroupDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [memberNames, setMemberNames] = useState({});
  
  // Modal state for viewing member splits
  const [modalVisible, setModalVisible] = useState(false);
  const [activeExpenseIndex, setActiveExpenseIndex] = useState(null);
  
  // Delete confirmation modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Tab state for group details view
  const [activeTab, setActiveTab] = useState('expenses'); // 'expenses' or 'settlements'
  
  // Expense actions state
  const [expandedExpenseIndex, setExpandedExpenseIndex] = useState(null);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [deletingExpense, setDeletingExpense] = useState(false);
  const [deleteExpenseModalVisible, setDeleteExpenseModalVisible] = useState(false);
  
  // Edit expense modal state
  const [editExpenseModalVisible, setEditExpenseModalVisible] = useState(false);
  const [editExpenseName, setEditExpenseName] = useState('');
  const [editExpenseAmount, setEditExpenseAmount] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);

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

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchGroups();
    if (selectedGroup) {
      const groupId = selectedGroup._id || selectedGroup.id;
      await fetchGroupDetails(groupId);
    }
    setRefreshing(false);
  };

  const handleBack = () => {
    if (selectedGroup) {
      setSelectedGroup(null);
      setGroupDetails(null);
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };

  // Handle Android hardware back button
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

  const handleSelectGroup = async (group) => {
    setSelectedGroup(group);
    setActiveTab('expenses'); // Reset to expenses tab
    const groupId = group._id || group.id;
    await fetchGroupDetails(groupId, group);
  };

  // Handle delete group
  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    
    setDeleting(true);
    try {
      const groupId = selectedGroup._id || selectedGroup.id;
      const response = await authDelete(`/groups/${groupId}`);
      const data = await response.json();
      
      if (data.success) {
        setDeleteModalVisible(false);
        setSelectedGroup(null);
        setGroupDetails(null);
        // Refresh the groups list
        await fetchGroups();
        
        // Show success message
        if (Platform.OS === 'web') {
          alert('Group deleted successfully. It will be permanently removed in 7 days.');
        } else {
          Alert.alert('Success', 'Group deleted successfully. It will be permanently removed in 7 days.');
        }
      } else {
        throw new Error(data.message || 'Failed to delete group');
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      if (Platform.OS === 'web') {
        alert('Failed to delete group. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to delete group. Please try again.');
      }
    } finally {
      setDeleting(false);
    }
  };

  // Toggle expense actions inline
  const toggleExpenseActions = (expense, index) => {
    if (expandedExpenseIndex === index) {
      setExpandedExpenseIndex(null);
      setSelectedExpense(null);
    } else {
      setExpandedExpenseIndex(index);
      setSelectedExpense({ ...expense, index });
    }
  };

  // Handle view expense (opens member modal)
  const handleViewExpense = (expense, index) => {
    setExpandedExpenseIndex(null);
    openMemberModal(index);
  };

  // Handle edit expense
  const handleEditExpense = (expense) => {
    setExpandedExpenseIndex(null);
    setSelectedExpense(expense);
    setEditExpenseName(expense.name || expense.title || '');
    setEditExpenseAmount(String(expense.totalAmount || expense.amount || ''));
    setEditExpenseModalVisible(true);
  };

  // Save edited expense
  const handleSaveExpense = async () => {
    if (!selectedExpense || !editExpenseName.trim() || !editExpenseAmount) return;
    
    setSavingExpense(true);
    try {
      const groupId = selectedGroup?._id || selectedGroup?.id;
      const response = await authPut(`/groups/${groupId}/expenses/${selectedExpense.id}`, {
        name: editExpenseName.trim(),
        totalAmount: parseFloat(editExpenseAmount),
        amount: parseFloat(editExpenseAmount)
      });
      const data = await response.json();
      
      if (data.success) {
        setEditExpenseModalVisible(false);
        setSelectedExpense(null);
        // Refresh group details to get updated data
        await fetchGroupDetails(groupId);
      } else {
        throw new Error(data.error || 'Failed to update expense');
      }
    } catch (error) {
      console.error('Error updating expense:', error);
      if (Platform.OS === 'web') {
        alert('Failed to update expense. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to update expense. Please try again.');
      }
    } finally {
      setSavingExpense(false);
    }
  };

  // Handle delete expense confirmation
  const handleDeleteExpenseConfirm = (expense) => {
    setExpandedExpenseIndex(null);
    setSelectedExpense(expense);
    setDeleteExpenseModalVisible(true);
  };

  // Delete expense
  const handleDeleteExpense = async () => {
    if (!selectedExpense) return;
    
    setDeletingExpense(true);
    try {
      const groupId = selectedGroup?._id || selectedGroup?.id;
      const response = await authDelete(`/groups/${groupId}/expenses/${selectedExpense.id}`);
      const data = await response.json();
      
      if (data.success) {
        setDeleteExpenseModalVisible(false);
        setSelectedExpense(null);
        // Refresh group details to get updated data
        await fetchGroupDetails(groupId);
        
        if (Platform.OS === 'web') {
          alert('Expense deleted successfully.');
        } else {
          Alert.alert('Success', 'Expense deleted successfully.');
        }
      } else {
        throw new Error(data.error || 'Failed to delete expense');
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
      if (Platform.OS === 'web') {
        alert('Failed to delete expense. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to delete expense. Please try again.');
      }
    } finally {
      setDeletingExpense(false);
    }
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
    <View style={styles.content}>
      <View style={styles.card}>
        {/* Card Header with Search and Refresh */}
        <View style={styles.cardHeader}>
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
          <TouchableOpacity 
            onPress={handleRefresh} 
            style={styles.cardRefreshButton}
            disabled={refreshing || loading}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#FF6B35" />
            ) : (
              <Ionicons name="refresh" size={20} color="#FF6B35" />
            )}
          </TouchableOpacity>
        </View>

        {/* Groups List */}
        <ScrollView 
          style={styles.cardScrollView}
          contentContainerStyle={styles.cardScrollContent}
          showsVerticalScrollIndicator={true}
        >
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
                    <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
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
        </ScrollView>
      </View>
    </View>
  );

  // Render Expenses Tab Content
  const renderExpensesTab = () => {
    const expenses = groupDetails?.expenses || [];
    const isEditable = isGroupEditable();
    
    return (
      <View style={styles.tabContent}>
        {expenses.length > 0 ? (
          <ScrollView 
            style={styles.expensesScrollFull}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.expensesScrollContent}
          >
            {expenses.map((expense, index) => (
              <View key={index} style={styles.expenseRow}>
                <View style={styles.expenseMainContent}>
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
                    <Text style={styles.expensePayeesCount}>
                      {expense.payees?.length || 0} member{(expense.payees?.length || 0) !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                
                {/* Action Buttons or Menu Icon */}
                {expandedExpenseIndex === index ? (
                  <View style={styles.expenseActionsInline}>
                    <TouchableOpacity 
                      style={styles.expenseActionIcon}
                      onPress={() => handleViewExpense(expense, index)}
                    >
                      <Ionicons name="eye-outline" size={18} color="#666" />
                    </TouchableOpacity>
                    {isEditable && (
                      <>
                        <TouchableOpacity 
                          style={styles.expenseActionIcon}
                          onPress={() => handleEditExpense(expense)}
                        >
                          <Ionicons name="create-outline" size={18} color="#FF6B35" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.expenseActionIcon}
                          onPress={() => handleDeleteExpenseConfirm(expense)}
                        >
                          <Ionicons name="trash-outline" size={18} color="#DC3545" />
                        </TouchableOpacity>
                      </>
                    )}
                    <TouchableOpacity 
                      style={styles.expenseCloseIcon}
                      onPress={() => toggleExpenseActions(expense, index)}
                    >
                      <Ionicons name="close" size={18} color="#888" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.expenseMenuButton}
                    onPress={() => toggleExpenseActions(expense, index)}
                  >
                    <Ionicons name="ellipsis-vertical" size={18} color="#888" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.noExpensesFull}>
            <Text style={styles.noExpensesIcon}>📝</Text>
            <Text style={styles.noExpensesTitle}>No Expenses Yet</Text>
            <Text style={styles.noExpensesText}>
              {isEditable ? 'Add your first expense to this group' : 'No expenses were added to this group'}
            </Text>
          </View>
        )}

        {/* Add Expense Button - Only for editable groups */}
        {isEditable && (
          <TouchableOpacity
            style={styles.addExpenseButton}
            onPress={() => navigation.navigate('AddExpense', { 
              selectedGroup: {
                id: selectedGroup?._id || selectedGroup?.id,
                name: selectedGroup?.name
              }
            })}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={22} color="#FFF" />
            <Text style={styles.addExpenseButtonText}>Add Expense</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render Settlements Tab Content
  const renderSettlementsTab = () => {
    const consolidatedEdges = groupDetails?.consolidatedExpenses || [];
    const unpaidEdges = consolidatedEdges.filter(e => !e.resolved);
    const paidEdges = consolidatedEdges.filter(e => e.resolved);
    
    return (
      <View style={styles.tabContent}>
        {consolidatedEdges.length > 0 ? (
          <ScrollView 
            style={styles.settlementsScrollFull}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.settlementsScrollContent}
          >
            {/* Unpaid Settlements */}
            {unpaidEdges.length > 0 && (
              <View style={styles.settlementSection}>
                <View style={styles.settlementSectionHeader}>
                  <Ionicons name="time-outline" size={18} color="#FF6B35" />
                  <Text style={styles.settlementSectionTitle}>Pending ({unpaidEdges.length})</Text>
                </View>
                {unpaidEdges.map((edge, index) => (
                  <View key={`unpaid-${index}`} style={styles.settlementRow}>
                    <View style={styles.settlementInfo}>
                      <Text style={styles.settlementFromTo}>
                        <Text style={styles.settlementName}>{getMemberName(edge.from)}</Text>
                        <Text style={styles.settlementArrow}> → </Text>
                        <Text style={styles.settlementName}>{getMemberName(edge.to)}</Text>
                      </Text>
                    </View>
                    <View style={styles.settlementAmountContainer}>
                      <Text style={styles.settlementAmountPending}>
                        ₹{parseFloat(edge.amount || 0).toFixed(2)}
                      </Text>
                      <View style={styles.unpaidBadge}>
                        <Text style={styles.unpaidBadgeText}>Unpaid</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Paid Settlements */}
            {paidEdges.length > 0 && (
              <View style={styles.settlementSection}>
                <View style={styles.settlementSectionHeader}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#28A745" />
                  <Text style={[styles.settlementSectionTitle, styles.settlementSectionTitlePaid]}>
                    Paid ({paidEdges.length})
                  </Text>
                </View>
                {paidEdges.map((edge, index) => (
                  <View key={`paid-${index}`} style={[styles.settlementRow, styles.settlementRowPaid]}>
                    <View style={styles.settlementInfo}>
                      <Text style={styles.settlementFromTo}>
                        <Text style={styles.settlementNamePaid}>{getMemberName(edge.from)}</Text>
                        <Text style={styles.settlementArrowPaid}> → </Text>
                        <Text style={styles.settlementNamePaid}>{getMemberName(edge.to)}</Text>
                      </Text>
                    </View>
                    <View style={styles.settlementAmountContainer}>
                      <Text style={styles.settlementAmountPaid}>
                        ₹{parseFloat(edge.amount || 0).toFixed(2)}
                      </Text>
                      <View style={styles.paidBadge}>
                        <Text style={styles.paidBadgeText}>Paid</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        ) : (
          <View style={styles.noSettlementsFull}>
            <Text style={styles.noExpensesIcon}>💰</Text>
            <Text style={styles.noExpensesTitle}>No Settlements</Text>
            <Text style={styles.noExpensesText}>Add expenses to see settlement calculations</Text>
          </View>
        )}
      </View>
    );
  };

  // Format timestamp for display
  const formatTimestamp = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Check if group is editable (not deleted or completed)
  const isGroupEditable = () => {
    const status = selectedGroup?.status || groupDetails?.status;
    return status === 'active';
  };

  // Render group details view (same format as Preview)
  const renderGroupDetails = () => {
    const expenses = groupDetails?.expenses || [];
    const consolidatedEdges = groupDetails?.consolidatedExpenses || [];
    const groupStatus = selectedGroup?.status || groupDetails?.status;
    const isEditable = isGroupEditable();
    
    return (
      <View style={styles.content}>
        <View style={styles.card}>
          {/* Card Header with Group Name, Refresh and Delete */}
          <View style={styles.detailsCardHeader}>
            <View style={styles.groupNameSection}>
              <View style={styles.groupNameRow}>
                <Text style={styles.groupNameLabel}>GROUP</Text>
                {(groupStatus === 'completed' || groupStatus === 'deleted') && (
                  <View style={[
                    styles.groupStatusBadge,
                    groupStatus === 'deleted' && styles.groupStatusBadgeDeleted
                  ]}>
                    <Text style={[
                      styles.groupStatusBadgeText,
                      groupStatus === 'deleted' && styles.groupStatusBadgeTextDeleted
                    ]}>
                      {groupStatus === 'completed' ? 'Completed' : 'Deleted'}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.groupNameText} numberOfLines={1}>{selectedGroup?.name}</Text>
              {(groupStatus === 'completed' || groupStatus === 'deleted') && (
                <Text style={styles.groupTimestamp}>
                  {groupStatus === 'completed' ? 'Completed' : 'Deleted'} on {formatTimestamp(groupDetails?.updatedAt || selectedGroup?.updatedAt)}
                </Text>
              )}
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity 
                onPress={handleRefresh} 
                style={styles.cardRefreshButton}
                disabled={refreshing || loadingDetails}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color="#FF6B35" />
                ) : (
                  <Ionicons name="refresh" size={20} color="#FF6B35" />
                )}
              </TouchableOpacity>
              {isEditable && (
                <TouchableOpacity 
                  onPress={() => setDeleteModalVisible(true)} 
                  style={styles.cardDeleteButton}
                  disabled={deleting}
                >
                  <Ionicons name="trash-outline" size={20} color="#DC3545" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Tab Bar */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'expenses' && styles.tabActive]}
              onPress={() => setActiveTab('expenses')}
            >
              <Ionicons 
                name="receipt-outline" 
                size={18} 
                color={activeTab === 'expenses' ? '#FF6B35' : '#888'} 
              />
              <Text style={[styles.tabText, activeTab === 'expenses' && styles.tabTextActive]}>
                Expenses ({expenses.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'settlements' && styles.tabActive]}
              onPress={() => setActiveTab('settlements')}
            >
              <Ionicons 
                name="swap-horizontal-outline" 
                size={18} 
                color={activeTab === 'settlements' ? '#FF6B35' : '#888'} 
              />
              <Text style={[styles.tabText, activeTab === 'settlements' && styles.tabTextActive]}>
                Settlements ({consolidatedEdges.length})
              </Text>
            </TouchableOpacity>
          </View>

          {loadingDetails ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#FF6B35" />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : (
            <View style={styles.detailsContent}>
              {activeTab === 'expenses' ? renderExpensesTab() : renderSettlementsTab()}
            </View>
          )}
        </View>
      </View>
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

        {/* Floating Create Group Button - Only show in list view */}
        {!selectedGroup && (
          <TouchableOpacity
            style={styles.floatingButton}
            onPress={() => navigation.navigate('CreateGroup')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={24} color="#FFF" />
            <Text style={styles.floatingButtonText}>Create Group</Text>
          </TouchableOpacity>
        )}
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

      {/* Delete Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={deleteModalVisible}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalIcon}>
              <Ionicons name="trash-outline" size={40} color="#DC3545" />
            </View>
            <Text style={styles.deleteModalTitle}>Delete Group?</Text>
            <Text style={styles.deleteModalText}>
              Are you sure you want to delete "{selectedGroup?.name}"? The group will be permanently removed in 7 days.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.deleteModalCancelButton}
                onPress={() => setDeleteModalVisible(false)}
                disabled={deleting}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteModalConfirmButton}
                onPress={handleDeleteGroup}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.deleteModalConfirmText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Expense Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editExpenseModalVisible}
        onRequestClose={() => setEditExpenseModalVisible(false)}
      >
        <View style={styles.editExpenseOverlay}>
          <View style={styles.editExpenseContent}>
            <View style={styles.editExpenseHeader}>
              <Text style={styles.editExpenseTitle}>Edit Expense</Text>
              <TouchableOpacity onPress={() => setEditExpenseModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.editExpenseField}>
              <Text style={styles.editExpenseLabel}>Expense Name</Text>
              <TextInput
                style={styles.editExpenseInput}
                value={editExpenseName}
                onChangeText={setEditExpenseName}
                placeholder="Enter expense name"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.editExpenseField}>
              <Text style={styles.editExpenseLabel}>Amount (₹)</Text>
              <TextInput
                style={styles.editExpenseInput}
                value={editExpenseAmount}
                onChangeText={setEditExpenseAmount}
                placeholder="Enter amount"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.editExpenseButtons}>
              <TouchableOpacity
                style={styles.editExpenseCancelButton}
                onPress={() => setEditExpenseModalVisible(false)}
                disabled={savingExpense}
              >
                <Text style={styles.editExpenseCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editExpenseSaveButton}
                onPress={handleSaveExpense}
                disabled={savingExpense || !editExpenseName.trim() || !editExpenseAmount}
              >
                {savingExpense ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.editExpenseSaveText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Expense Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={deleteExpenseModalVisible}
        onRequestClose={() => setDeleteExpenseModalVisible(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalIcon}>
              <Ionicons name="receipt-outline" size={40} color="#DC3545" />
            </View>
            <Text style={styles.deleteModalTitle}>Delete Expense?</Text>
            <Text style={styles.deleteModalText}>
              Are you sure you want to delete "{selectedExpense?.name}"? This will recalculate all settlements.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.deleteModalCancelButton}
                onPress={() => setDeleteExpenseModalVisible(false)}
                disabled={deletingExpense}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteModalConfirmButton}
                onPress={handleDeleteExpense}
                disabled={deletingExpense}
              >
                {deletingExpense ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.deleteModalConfirmText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardRefreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  cardDeleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  cardScrollView: {
    flex: 1,
  },
  cardScrollContent: {
    paddingBottom: 80, // Extra padding for floating button
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    marginRight: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
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
    flex: 1,
  },
  groupNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  groupNameLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupStatusBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  groupStatusBadgeDeleted: {
    backgroundColor: '#FFEBEE',
  },
  groupStatusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#28A745',
  },
  groupStatusBadgeTextDeleted: {
    color: '#DC3545',
  },
  groupNameText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  groupTimestamp: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  expensesSection: {
    marginBottom: 24,
  },
  // Tab Bar Styles
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },
  tabTextActive: {
    color: '#FF6B35',
  },
  tabContent: {
    flex: 1,
  },
  detailsContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  expensesSectionFull: {
    flex: 1,
  },
  expensesScrollFull: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
  },
  expensesScrollContent: {
    paddingBottom: 10,
  },
  noExpensesFull: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  noExpensesIcon: {
    fontSize: 50,
    marginBottom: 16,
  },
  noExpensesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  addExpenseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 16,
    gap: 8,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  addExpenseButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  // Settlements Tab Styles
  settlementsScrollFull: {
    flex: 1,
  },
  settlementsScrollContent: {
    paddingBottom: 10,
  },
  settlementSection: {
    marginBottom: 20,
  },
  settlementSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  settlementSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF6B35',
  },
  settlementSectionTitlePaid: {
    color: '#28A745',
  },
  settlementRow: {
    backgroundColor: '#FFF5F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B35',
  },
  settlementRowPaid: {
    backgroundColor: '#F0FFF4',
    borderLeftColor: '#28A745',
  },
  settlementInfo: {
    flex: 1,
  },
  settlementFromTo: {
    fontSize: 14,
  },
  settlementName: {
    fontWeight: '600',
    color: '#333',
  },
  settlementNamePaid: {
    fontWeight: '600',
    color: '#666',
  },
  settlementArrow: {
    color: '#FF6B35',
    fontWeight: '700',
  },
  settlementArrowPaid: {
    color: '#28A745',
    fontWeight: '700',
  },
  settlementAmountContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  settlementAmountPending: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B35',
  },
  settlementAmountPaid: {
    fontSize: 16,
    fontWeight: '700',
    color: '#28A745',
  },
  unpaidBadge: {
    backgroundColor: '#FFE5DC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  unpaidBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FF6B35',
  },
  paidBadge: {
    backgroundColor: '#D4EDDA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  paidBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#28A745',
  },
  noSettlementsFull: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  expenseMainContent: {
    flex: 1,
  },
  expenseMenuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  expensePayeesCount: {
    fontSize: 12,
    color: '#888',
  },
  expenseActionsInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expenseActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  expenseCloseIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
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
  // Delete Confirmation Modal
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  deleteModalIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  deleteModalText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteModalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  deleteModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  deleteModalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#DC3545',
    alignItems: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  deleteModalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  // Edit Expense Modal
  editExpenseOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  editExpenseContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  editExpenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  editExpenseTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  editExpenseField: {
    marginBottom: 20,
  },
  editExpenseLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  editExpenseInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  editExpenseButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  editExpenseCancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  editExpenseCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  editExpenseSaveButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  editExpenseSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  // Floating Create Group Button
  floatingButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 30,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    gap: 8,
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  floatingButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});
