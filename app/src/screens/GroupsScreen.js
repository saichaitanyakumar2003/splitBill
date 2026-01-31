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
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { authGet, authPost, authDelete, authPut } from '../utils/apiHelper';
import { useAuth } from '../context/AuthContext';
import WebPullToRefresh from '../components/WebPullToRefresh';

export default function GroupsScreen({ route }) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  
  // Detect mobile web (web platform with narrow screen)
  const isMobileWeb = Platform.OS === 'web' && screenWidth < 768;
  const isAndroid = Platform.OS === 'android';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groups, setGroups] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupDetails, setGroupDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [memberNames, setMemberNames] = useState({});
  const [oldToCurrentEmail, setOldToCurrentEmail] = useState({}); // Map old emails to current emails
  
  // Handle incoming navigation params from History screen
  const selectedGroupId = route?.params?.selectedGroupId;
  const selectedGroupName = route?.params?.groupName;
  const fromScreen = route?.params?.fromScreen;
  
  // Modal state for viewing member splits
  const [modalVisible, setModalVisible] = useState(false);
  const [activeExpenseIndex, setActiveExpenseIndex] = useState(null);
  
  // Delete confirmation modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Tab state for group details view
  const [activeTab, setActiveTab] = useState('expenses'); // 'expenses', 'settlements', or 'activity'
  
  // Edit history state
  const [editHistory, setEditHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
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
  
  // Original expense values for change detection
  const [originalExpenseName, setOriginalExpenseName] = useState('');
  const [originalPayees, setOriginalPayees] = useState([]);
  
  // Edit expense payees state
  const [editPayees, setEditPayees] = useState([]); // Current payees with amounts
  const [removedPayees, setRemovedPayees] = useState([]); // Removed payees (can be added back)
  const [addUserSearch, setAddUserSearch] = useState(''); // Search query for adding users
  const [showAddUserSection, setShowAddUserSection] = useState(false); // Toggle add user section
  const [allGroupMembers, setAllGroupMembers] = useState([]); // All members in the group for search suggestions
  const [userSearchResults, setUserSearchResults] = useState([]); // Search results from API
  const [isSearchingUsers, setIsSearchingUsers] = useState(false); // Loading state for user search
  
  // Save confirmation modal state
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);

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
  // Returns { names: { email: name }, oldToCurrentEmail: { oldEmail: currentEmail } }
  const fetchMemberNames = async (emails) => {
    try {
      const response = await authPost('/auth/friends/details', { emails: Array.from(emails) });
      const data = await response.json();
      if (data.success && data.data) {
        const names = {};
        const oldToCurrentEmail = {}; // Map old emails to current emails
        data.data.forEach(member => {
          names[member.mailId] = member.name;
          // If this is an old email, track the mapping to current email
          if (member.currentMailId && member.currentMailId !== member.mailId) {
            oldToCurrentEmail[member.mailId] = member.currentMailId;
          }
        });
        // Add current user's name
        if (user) {
          names[user.mailId] = user.name || user.mailId.split('@')[0];
        }
        return { names, oldToCurrentEmail };
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
    return { names, oldToCurrentEmail: {} };
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
      const { names, oldToCurrentEmail: emailMapping } = await fetchMemberNames(memberEmails);
      setMemberNames(names);
      setOldToCurrentEmail(emailMapping);
      setGroupDetails(data);
      
    } catch (error) {
      console.error('Error fetching group details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Fetch edit history for a group
  const fetchEditHistory = async (groupId) => {
    setLoadingHistory(true);
    try {
      const response = await authGet(`/groups/${groupId}/edit-history`);
      const data = await response.json();
      
      if (data.success) {
        setEditHistory(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching edit history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // Search users via API when typing in edit expense search
  useEffect(() => {
    const searchUsers = async () => {
      if (addUserSearch.trim().length < 2) {
        setUserSearchResults([]);
        return;
      }

      setIsSearchingUsers(true);
      try {
        // Use forPayer=true to filter out users whose previous_mails match the search (avoid showing old emails)
        const response = await authGet(`/auth/search?q=${encodeURIComponent(addUserSearch.trim())}&forPayer=true`);
        const data = await response.json();
        
        if (data.success) {
          // Filter out users already in editPayees
          const currentPayeeIds = new Set(editPayees.map(p => p.mailId.toLowerCase()));
          const filtered = data.data.filter(
            u => !currentPayeeIds.has(u.mailId.toLowerCase())
          );
          setUserSearchResults(filtered);
        }
      } catch (e) {
        console.error('User search error:', e);
      } finally {
        setIsSearchingUsers(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [addUserSearch, editPayees]);

  // Auto-select group when coming from History screen
  useEffect(() => {
    if (selectedGroupId && groups.length > 0 && !selectedGroup) {
      const groupToSelect = groups.find(g => (g._id || g.id) === selectedGroupId);
      if (groupToSelect) {
        handleSelectGroup(groupToSelect, 'settlements'); // Open settlements tab when coming from history
      } else {
        // Group not found in current list, fetch it directly
        const fetchAndSelectGroup = async () => {
          try {
            const response = await authGet(`/groups/${selectedGroupId}`);
            const data = await response.json();
            if (data && data._id) {
              setSelectedGroup(data);
              setActiveTab('settlements'); // Default to settlements tab when coming from history
              await fetchGroupDetails(selectedGroupId, data);
            }
          } catch (error) {
            console.error('Error fetching selected group:', error);
          }
        };
        fetchAndSelectGroup();
      }
    }
  }, [selectedGroupId, groups]);

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
      // If came from History, navigate back to History directly
      if (fromScreen === 'History') {
        navigation.setParams({ selectedGroupId: undefined, groupName: undefined, fromScreen: undefined });
        navigation.navigate('History');
        return;
      }
      setSelectedGroup(null);
      setGroupDetails(null);
      // Clear navigation params to prevent auto-reselection
      if (route?.params?.selectedGroupId) {
        navigation.setParams({ selectedGroupId: undefined, groupName: undefined, fromScreen: undefined });
      }
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
      if (selectedGroup) {
        // If came from History, navigate back to History directly
        if (fromScreen === 'History') {
          navigation.setParams({ selectedGroupId: undefined, groupName: undefined, fromScreen: undefined });
          navigation.navigate('History');
          return true;
        }
        setSelectedGroup(null);
        setGroupDetails(null);
        if (route?.params?.selectedGroupId) {
          navigation.setParams({ selectedGroupId: undefined, groupName: undefined, fromScreen: undefined });
        }
        return true;
      }
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Home');
      }
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => subscription.remove();
  }, [navigation, selectedGroup, fromScreen]);

  const handleSelectGroup = async (group, defaultTab = 'expenses') => {
    setSelectedGroup(group);
    setActiveTab(defaultTab);
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
    const expenseName = expense.name || expense.title || '';
    setEditExpenseName(expenseName);
    setOriginalExpenseName(expenseName); // Store original name
    setEditExpenseAmount(String(expense.totalAmount || expense.amount || ''));
    
    // Initialize payees with their amounts
    const rawPayeesList = (expense.payees || []).map(p => {
      if (typeof p === 'object') {
        return {
          mailId: p.mailId,
          name: getMemberName(p.mailId),
          amount: String(p.amount || 0),
          isPayer: p.mailId === expense.payer
        };
      } else {
        const totalAmount = expense.totalAmount || expense.amount || 0;
        const splitAmount = totalAmount / (expense.payees?.length || 1);
        return {
          mailId: p,
          name: getMemberName(p),
          amount: String(splitAmount.toFixed(2)),
          isPayer: p === expense.payer
        };
      }
    });
    
    // Deduplicate payees: if both old and new email exist, keep only the current one
    const seenCurrentEmails = new Set();
    const payeesList = [];
    
    // First pass: identify which current emails are present
    rawPayeesList.forEach(p => {
      const currentEmail = oldToCurrentEmail[p.mailId] || p.mailId;
      seenCurrentEmails.add(currentEmail.toLowerCase());
    });
    
    // Second pass: filter out old emails if current email is also present
    const addedEmails = new Set();
    rawPayeesList.forEach(p => {
      const currentEmail = oldToCurrentEmail[p.mailId];
      const emailToUse = p.mailId.toLowerCase();
      
      if (currentEmail) {
        // This is an old email
        if (!addedEmails.has(currentEmail.toLowerCase())) {
          // Current email not yet added, use current email instead
          payeesList.push({
            ...p,
            mailId: currentEmail,
            name: getMemberName(currentEmail)
          });
          addedEmails.add(currentEmail.toLowerCase());
        }
        // Skip if current email already added
      } else {
        // This is a current email
        if (!addedEmails.has(emailToUse)) {
          payeesList.push(p);
          addedEmails.add(emailToUse);
        }
      }
    });
    
    // Store original payees for change detection
    setOriginalPayees(payeesList.map(p => ({ mailId: p.mailId, amount: p.amount })));
    
    // Collect all unique members from all expenses in the group for search suggestions
    const allMembers = new Set();
    const groupExpenses = groupDetails?.expenses || [];
    groupExpenses.forEach(exp => {
      if (exp.payer) allMembers.add(exp.payer);
      if (exp.payees) {
        exp.payees.forEach(p => {
          if (typeof p === 'object' && p.mailId) {
            allMembers.add(p.mailId);
          } else if (typeof p === 'string') {
            allMembers.add(p);
          }
        });
      }
    });
    
    // Also add from consolidated expenses
    const consolidatedEdges = groupDetails?.consolidatedExpenses || [];
    consolidatedEdges.forEach(edge => {
      if (edge.from) allMembers.add(edge.from);
      if (edge.to) allMembers.add(edge.to);
    });
    
    // Deduplicate: Remove old emails if their current email is also in the set
    // oldToCurrentEmail maps oldEmail -> currentEmail
    const membersToRemove = new Set();
    allMembers.forEach(email => {
      const currentEmail = oldToCurrentEmail[email];
      if (currentEmail && allMembers.has(currentEmail)) {
        // This is an old email and the current email is also present, remove the old one
        membersToRemove.add(email);
      }
    });
    membersToRemove.forEach(email => allMembers.delete(email));
    
    // Convert to array with names
    const membersList = Array.from(allMembers).map(mailId => ({
      mailId,
      name: getMemberName(mailId)
    }));
    
    setAllGroupMembers(membersList);
    setEditPayees(payeesList);
    setRemovedPayees([]);
    setAddUserSearch('');
    setShowAddUserSection(false);
    setEditExpenseModalVisible(true);
  };
  
  // Show save confirmation modal
  const handleShowSaveConfirm = () => {
    setShowSaveConfirmModal(true);
  };
  
  // Check if there are any changes to the expense
  const hasExpenseChanges = () => {
    // Check if name changed
    if (editExpenseName.trim() !== originalExpenseName.trim()) {
      return true;
    }
    
    // Get valid current payees (with amount > 0)
    const currentValidPayees = editPayees
      .filter(p => {
        const amount = parseFloat(p.amount);
        return !isNaN(amount) && amount > 0;
      })
      .map(p => ({ mailId: p.mailId.toLowerCase(), amount: parseFloat(p.amount).toFixed(2) }))
      .sort((a, b) => a.mailId.localeCompare(b.mailId));
    
    // Get original valid payees
    const originalValidPayees = originalPayees
      .filter(p => {
        const amount = parseFloat(p.amount);
        return !isNaN(amount) && amount > 0;
      })
      .map(p => ({ mailId: p.mailId.toLowerCase(), amount: parseFloat(p.amount).toFixed(2) }))
      .sort((a, b) => a.mailId.localeCompare(b.mailId));
    
    // Check if number of payees changed
    if (currentValidPayees.length !== originalValidPayees.length) {
      return true;
    }
    
    // Check if any payee or amount changed
    for (let i = 0; i < currentValidPayees.length; i++) {
      if (currentValidPayees[i].mailId !== originalValidPayees[i].mailId ||
          currentValidPayees[i].amount !== originalValidPayees[i].amount) {
        return true;
      }
    }
    
    return false;
  };
  
  // Confirm and save changes
  const handleConfirmSave = () => {
    setShowSaveConfirmModal(false);
    handleSaveExpense();
  };

  // Save edited expense
  const handleSaveExpense = async () => {
    if (!selectedExpense || !editExpenseName.trim()) return;
    
    // Filter out payees with 0 or empty amounts
    const validPayees = editPayees.filter(p => {
      const amount = parseFloat(p.amount);
      return !isNaN(amount) && amount > 0;
    });
    
    if (validPayees.length === 0) {
      if (Platform.OS === 'web') {
        alert('At least one member with a valid amount is required.');
      } else {
        Alert.alert('Error', 'At least one member with a valid amount is required.');
      }
      return;
    }
    
    // Calculate total from individual amounts
    const calculatedTotal = validPayees.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    
    setSavingExpense(true);
    try {
      const groupId = selectedGroup?._id || selectedGroup?.id;
      const expenseId = selectedExpense.id || selectedExpense._id;
      const response = await authPut(`/groups/${groupId}/expenses/${expenseId}`, {
        name: editExpenseName.trim(),
        totalAmount: calculatedTotal,
        amount: calculatedTotal,
        payees: validPayees.map(p => ({
          mailId: p.mailId.toLowerCase().trim(),
          amount: parseFloat(p.amount)
        }))
      });
      const data = await response.json();
      
      if (data.success) {
        setEditExpenseModalVisible(false);
        setSelectedExpense(null);
        setEditPayees([]);
        setRemovedPayees([]);
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
  
  // Update payee amount
  const handlePayeeAmountChange = (mailId, newAmount) => {
    setEditPayees(prev => prev.map(p => 
      p.mailId === mailId ? { ...p, amount: newAmount } : p
    ));
  };
  
  // Remove payee from expense (preserve amount for adding back)
  const handleRemovePayee = (payee) => {
    setEditPayees(prev => prev.filter(p => p.mailId !== payee.mailId));
    // Store the payee with their current amount so it can be restored
    setRemovedPayees(prev => [...prev, { ...payee }]);
  };
  
  // Add back removed payee (restore their original amount)
  const handleAddBackPayee = (payee) => {
    setRemovedPayees(prev => prev.filter(p => p.mailId !== payee.mailId));
    // Restore with the same amount they had before removal
    setEditPayees(prev => [...prev, { ...payee }]);
  };
  
  // Add new user by email
  const handleAddNewUser = () => {
    const email = addUserSearch.trim().toLowerCase();
    if (!email) return;
    
    // Check if already in payees or removed
    const existsInPayees = editPayees.some(p => p.mailId.toLowerCase() === email);
    const existsInRemoved = removedPayees.some(p => p.mailId.toLowerCase() === email);
    
    if (existsInPayees) {
      if (Platform.OS === 'web') {
        alert('This user is already in the expense.');
      } else {
        Alert.alert('Info', 'This user is already in the expense.');
      }
      return;
    }
    
    if (existsInRemoved) {
      // Add back from removed
      const payee = removedPayees.find(p => p.mailId.toLowerCase() === email);
      handleAddBackPayee(payee);
    } else {
      // Add new user
      const newPayee = {
        mailId: email,
        name: getMemberName(email) || email.split('@')[0],
        amount: '0',
        isPayer: email === selectedExpense?.payer
      };
      setEditPayees(prev => [...prev, newPayee]);
    }
    
    setAddUserSearch('');
    setShowAddUserSection(false);
  };
  
  // Get calculated total from payees
  const getEditPayeesTotal = () => {
    return editPayees.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  };
  
  // Get search suggestions for adding users (combines group members + API results)
  const getSearchSuggestions = () => {
    const searchLower = addUserSearch.toLowerCase().trim();
    const currentPayeeIds = new Set(editPayees.map(p => p.mailId.toLowerCase()));
    
    // Start with group members that are not already in payees
    let groupMemberSuggestions = allGroupMembers.filter(member => {
      const mailIdLower = member.mailId.toLowerCase();
      const nameLower = (member.name || '').toLowerCase();
      
      // Check if not already in current payees
      const notInPayees = !currentPayeeIds.has(mailIdLower);
      
      // If there's a search query, filter by it (partial match)
      if (searchLower) {
        const matchesSearch = mailIdLower.includes(searchLower) || nameLower.includes(searchLower);
        return matchesSearch && notInPayees;
      }
      
      return notInPayees;
    });
    
    // Mark group members
    groupMemberSuggestions = groupMemberSuggestions.map(m => ({ ...m, isGroupMember: true }));
    
    // Add API search results (not already in group members or payees)
    const groupMemberIds = new Set(groupMemberSuggestions.map(m => m.mailId.toLowerCase()));
    const apiResults = userSearchResults
      .filter(u => !groupMemberIds.has(u.mailId.toLowerCase()) && !currentPayeeIds.has(u.mailId.toLowerCase()))
      .map(u => ({ ...u, isApiResult: true }));
    
    // Combine: group members first, then API results
    let suggestions = [...groupMemberSuggestions, ...apiResults];
    
    // Always show option to add email if it looks like a valid email and not already added
    if (searchLower && searchLower.includes('@')) {
      const exactMatchExists = suggestions.some(s => s.mailId.toLowerCase() === searchLower);
      
      if (!exactMatchExists && !currentPayeeIds.has(searchLower)) {
        // Add the new email option at the beginning
        suggestions.unshift({
          mailId: searchLower,
          name: searchLower.split('@')[0],
          isNew: true
        });
      }
    }
    
    return suggestions.slice(0, 8); // Limit to 8 suggestions
  };
  
  // Handle selecting a suggestion
  const handleSelectSuggestion = (suggestion) => {
    const existsInRemoved = removedPayees.some(p => p.mailId.toLowerCase() === suggestion.mailId.toLowerCase());
    
    if (existsInRemoved) {
      // Add back from removed
      const payee = removedPayees.find(p => p.mailId.toLowerCase() === suggestion.mailId.toLowerCase());
      handleAddBackPayee(payee);
    } else {
      // Add new user
      const newPayee = {
        mailId: suggestion.mailId,
        name: suggestion.name || getMemberName(suggestion.mailId) || suggestion.mailId.split('@')[0],
        amount: '0',
        isPayer: suggestion.mailId.toLowerCase() === selectedExpense?.payer?.toLowerCase()
      };
      setEditPayees(prev => [...prev, newPayee]);
    }
    
    setAddUserSearch('');
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
      const expenseId = selectedExpense.id || selectedExpense._id;
      const response = await authDelete(`/groups/${groupId}/expenses/${expenseId}`);
      const data = await response.json();
      
      if (data.success) {
        setDeleteExpenseModalVisible(false);
        setSelectedExpense(null);
        // Refresh group details to get updated data
        await fetchGroupDetails(groupId);
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
            style={[styles.cardRefreshButton, isMobileWeb && styles.cardRefreshButtonMobileWeb]}
            disabled={refreshing || loading}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#FF6B35" />
            ) : (
              <>
                <Ionicons name="refresh" size={20} color="#FF6B35" />
                {isMobileWeb && <Text style={styles.refreshButtonText}>Refresh</Text>}
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Groups List */}
        {isMobileWeb ? (
          <WebPullToRefresh
            onRefresh={handleRefresh}
            refreshing={refreshing}
            style={styles.cardScrollView}
            contentContainerStyle={styles.cardScrollContent}
            scrollViewProps={{
              showsVerticalScrollIndicator: true,
            }}
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
          </WebPullToRefresh>
        ) : (
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
        )}
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
                
                {/* Menu Icon */}
                <TouchableOpacity 
                  style={styles.expenseMenuButton}
                  onPress={() => toggleExpenseActions(expense, index)}
                >
                  <Ionicons name="ellipsis-vertical" size={18} color="#888" />
                </TouchableOpacity>
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

  // Get action icon and color
  const getActionStyle = (action) => {
    switch (action) {
      case 'add_expense':
        return { icon: 'add-circle', color: '#28A745', bgColor: '#E8F5E9' };
      case 'edit_expense':
        return { icon: 'create', color: '#FF6B35', bgColor: '#FFF5F0' };
      case 'delete_expense':
        return { icon: 'trash', color: '#DC3545', bgColor: '#FFEBEE' };
      case 'delete_group':
        return { icon: 'close-circle', color: '#DC3545', bgColor: '#FFEBEE' };
      default:
        return { icon: 'ellipse', color: '#888', bgColor: '#F5F5F5' };
    }
  };

  // Get action label
  const getActionLabel = (action) => {
    switch (action) {
      case 'add_expense': return 'Added Expense';
      case 'edit_expense': return 'Edited Expense';
      case 'delete_expense': return 'Deleted Expense';
      case 'delete_group': return 'Deleted Group';
      default: return 'Action';
    }
  };

  // Render Activity Tab Content
  const renderActivityTab = () => {
    return (
      <View style={styles.tabContent}>
        {editHistory.length > 0 ? (
          <ScrollView 
            style={styles.activityScrollFull}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.activityScrollContent}
          >
            {editHistory.map((item, index) => {
              const actionStyle = getActionStyle(item.action);
              return (
                <View key={item._id || index} style={styles.activityRow}>
                  <View style={[styles.activityIconContainer, { backgroundColor: actionStyle.bgColor }]}>
                    <Ionicons name={actionStyle.icon} size={18} color={actionStyle.color} />
                  </View>
                  <View style={styles.activityContent}>
                    <View style={styles.activityHeader}>
                      <Text style={[styles.activityAction, { color: actionStyle.color }]}>
                        {getActionLabel(item.action)}
                      </Text>
                      <Text style={styles.activityTime}>
                        {formatTimestamp(item.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.activityDescription} numberOfLines={2}>
                      {item.details?.changes || item.details?.expenseName || 'No details'}
                    </Text>
                    <Text style={styles.activityUser}>
                      by {item.actionByName || item.actionBy?.split('@')[0] || 'Unknown'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.noActivityFull}>
            <Text style={styles.noExpensesIcon}>📋</Text>
            <Text style={styles.noExpensesTitle}>No Activity</Text>
            <Text style={styles.noExpensesText}>Actions like adding, editing, or deleting expenses will appear here</Text>
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
                style={[styles.cardRefreshButton, isMobileWeb && styles.cardRefreshButtonMobileWeb]}
                disabled={refreshing || loadingDetails}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color="#FF6B35" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={20} color="#FF6B35" />
                    {isMobileWeb && <Text style={styles.refreshButtonText}>Refresh</Text>}
                  </>
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
              style={[
                styles.tab, 
                activeTab === 'expenses' && styles.tabActive,
                (Platform.OS === 'web' && !isMobileWeb) ? styles.tabDesktop : styles.tabMobile
              ]}
              onPress={() => setActiveTab('expenses')}
            >
              <Ionicons 
                name="receipt-outline" 
                size={(Platform.OS === 'web' && !isMobileWeb) ? 16 : 20} 
                color={activeTab === 'expenses' ? '#FF6B35' : '#888'} 
              />
              <Text style={[
                styles.tabText, 
                activeTab === 'expenses' && styles.tabTextActive,
                (Platform.OS === 'web' && !isMobileWeb) ? styles.tabTextDesktop : styles.tabTextMobile
              ]}>
                Expenses
              </Text>
              <Text style={[
                styles.tabCount, 
                activeTab === 'expenses' && styles.tabCountActive,
                (Platform.OS === 'web' && !isMobileWeb) ? styles.tabCountDesktop : styles.tabCountMobile
              ]}>
                ({expenses.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab, 
                activeTab === 'settlements' && styles.tabActive,
                (Platform.OS === 'web' && !isMobileWeb) ? styles.tabDesktop : styles.tabMobile
              ]}
              onPress={() => setActiveTab('settlements')}
            >
              <Ionicons 
                name="swap-horizontal-outline" 
                size={(Platform.OS === 'web' && !isMobileWeb) ? 16 : 20} 
                color={activeTab === 'settlements' ? '#FF6B35' : '#888'} 
              />
              <Text style={[
                styles.tabText, 
                activeTab === 'settlements' && styles.tabTextActive,
                (Platform.OS === 'web' && !isMobileWeb) ? styles.tabTextDesktop : styles.tabTextMobile
              ]}>
                Settle
              </Text>
              <Text style={[
                styles.tabCount, 
                activeTab === 'settlements' && styles.tabCountActive,
                (Platform.OS === 'web' && !isMobileWeb) ? styles.tabCountDesktop : styles.tabCountMobile
              ]}>
                ({consolidatedEdges.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab, 
                activeTab === 'activity' && styles.tabActive,
                (Platform.OS === 'web' && !isMobileWeb) ? styles.tabDesktop : styles.tabMobile
              ]}
              onPress={() => {
                setActiveTab('activity');
                const groupId = selectedGroup?._id || selectedGroup?.id;
                if (groupId) fetchEditHistory(groupId);
              }}
            >
              <Ionicons 
                name="time-outline" 
                size={(Platform.OS === 'web' && !isMobileWeb) ? 16 : 20} 
                color={activeTab === 'activity' ? '#FF6B35' : '#888'} 
              />
              <Text style={[
                styles.tabText, 
                activeTab === 'activity' && styles.tabTextActive,
                (Platform.OS === 'web' && !isMobileWeb) ? styles.tabTextDesktop : styles.tabTextMobile
              ]}>
                Activity
              </Text>
            </TouchableOpacity>
          </View>

          {loadingDetails || (activeTab === 'activity' && loadingHistory) ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#FF6B35" />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : (
            <View style={styles.detailsContent}>
              {activeTab === 'expenses' && renderExpensesTab()}
              {activeTab === 'settlements' && renderSettlementsTab()}
              {activeTab === 'activity' && renderActivityTab()}
            </View>
          )}
        </View>
      </View>
    );
  };

  // Get current expense for modal
  const currentExpense = activeExpenseIndex !== null && groupDetails?.expenses?.[activeExpenseIndex];
  const expenseMembers = currentExpense ? getExpenseMembers(currentExpense) : [];

  // Android-specific layout
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
            <Pressable onPress={handleBack} style={androidStyles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#E85A24" />
            </Pressable>
            <Text style={androidStyles.headerTitle}>
              {selectedGroup ? selectedGroup.name : 'Groups'}
            </Text>
            <View style={androidStyles.headerRight} />
          </View>

          {/* Decorative Icon */}
          <View style={androidStyles.decorativeIconContainer}>
            <View style={androidStyles.decorativeIconCircle}>
              <Ionicons name="people-outline" size={40} color="#FFF" />
            </View>
          </View>

          {/* White Content Area */}
          <View style={androidStyles.whiteContentArea}>
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
          </View>
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
            <View style={styles.editExpenseContentLarge}>
              <View style={styles.editExpenseHeader}>
                <Text style={styles.editExpenseTitle}>Edit Expense</Text>
                <TouchableOpacity onPress={() => setEditExpenseModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.editExpenseScrollView}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
              >
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

                {/* Total Amount Display */}
                <View style={styles.editTotalRow}>
                  <Text style={styles.editTotalLabel}>Total Amount</Text>
                  <Text style={styles.editTotalValue}>₹{getEditPayeesTotal().toFixed(2)}</Text>
                </View>

                {/* Members Section */}
                <View style={styles.editPayeesSection}>
                  <View style={styles.editPayeesHeader}>
                    <Text style={styles.editExpenseLabel}>Members & Splits</Text>
                    <TouchableOpacity 
                      style={styles.addUserButton}
                      onPress={() => setShowAddUserSection(!showAddUserSection)}
                    >
                      <Ionicons name={showAddUserSection ? "close" : "person-add"} size={18} color="#FF6B35" />
                      <Text style={styles.addUserButtonText}>{showAddUserSection ? 'Close' : 'Add'}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Add User Section */}
                  {showAddUserSection && (
                    <View style={styles.addUserSection}>
                      <View style={styles.addUserInputRow}>
                        <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
                        <TextInput
                          style={styles.addUserInput}
                          value={addUserSearch}
                          onChangeText={setAddUserSearch}
                          placeholder="Search by name or email..."
                          placeholderTextColor="#999"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoFocus={true}
                        />
                        {addUserSearch.trim() ? (
                          <TouchableOpacity 
                            style={styles.clearSearchButton}
                            onPress={() => setAddUserSearch('')}
                          >
                            <Ionicons name="close-circle" size={20} color="#999" />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      
                      {/* Search Results */}
                      <View style={styles.searchResultsContainer}>
                        {isSearchingUsers && addUserSearch.trim().length >= 2 && (
                          <View style={styles.searchingIndicator}>
                            <ActivityIndicator size="small" color="#FF6B35" />
                            <Text style={styles.searchingText}>Searching...</Text>
                          </View>
                        )}
                        {getSearchSuggestions().length > 0 ? (
                          <>
                            {getSearchSuggestions().map((suggestion, index) => (
                              <TouchableOpacity
                                key={suggestion.mailId}
                                style={[
                                  styles.suggestionItem,
                                  suggestion.isNew && styles.suggestionItemNew,
                                  suggestion.isApiResult && styles.suggestionItemApi,
                                  index < getSearchSuggestions().length - 1 && styles.suggestionItemBorder
                                ]}
                                onPress={() => handleSelectSuggestion(suggestion)}
                              >
                                <View style={[
                                  styles.suggestionAvatar,
                                  suggestion.isNew && styles.suggestionAvatarNew,
                                  suggestion.isApiResult && styles.suggestionAvatarApi
                                ]}>
                                  {suggestion.isNew ? (
                                    <Ionicons name="person-add" size={14} color="#FFF" />
                                  ) : (
                                    <Text style={styles.suggestionAvatarText}>
                                      {(suggestion.name || suggestion.mailId).charAt(0).toUpperCase()}
                                    </Text>
                                  )}
                                </View>
                                <View style={styles.suggestionInfo}>
                                  <View style={styles.suggestionNameRow}>
                                    <Text style={[styles.suggestionName, suggestion.isNew && styles.suggestionNameNew]} numberOfLines={1}>
                                      {suggestion.isNew ? 'Add new member' : suggestion.name}
                                    </Text>
                                    {suggestion.isGroupMember && (
                                      <View style={styles.suggestionBadge}>
                                        <Text style={styles.suggestionBadgeText}>Group</Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text style={styles.suggestionEmail} numberOfLines={1}>
                                    {suggestion.mailId}
                                  </Text>
                                </View>
                                <Ionicons name="add-circle" size={22} color={suggestion.isNew ? "#28A745" : "#FF6B35"} />
                              </TouchableOpacity>
                            ))}
                          </>
                        ) : addUserSearch.trim() && addUserSearch.trim().length >= 2 && !isSearchingUsers ? (
                          <View style={styles.noResultsMessage}>
                            <Text style={styles.noResultsText}>No users found for "{addUserSearch}"</Text>
                            <Text style={styles.noResultsHint}>Enter a full email address to add someone new</Text>
                            {addUserSearch.includes('@') && (
                              <TouchableOpacity
                                style={styles.addNewEmailRow}
                                onPress={handleAddNewUser}
                              >
                                <View style={[styles.suggestionAvatar, styles.suggestionAvatarNew]}>
                                  <Ionicons name="person-add" size={14} color="#FFF" />
                                </View>
                                <View style={styles.suggestionInfo}>
                                  <Text style={styles.suggestionNameNew}>Add as new member</Text>
                                  <Text style={styles.suggestionEmail}>{addUserSearch.trim()}</Text>
                                </View>
                                <Ionicons name="add-circle" size={22} color="#28A745" />
                              </TouchableOpacity>
                            )}
                          </View>
                        ) : !addUserSearch.trim() ? (
                          <View style={styles.noResultsMessage}>
                            <Text style={styles.noResultsText}>
                              {allGroupMembers.filter(m => !editPayees.some(p => p.mailId.toLowerCase() === m.mailId.toLowerCase())).length === 0 
                                ? 'All group members added' 
                                : 'Type to search users...'}
                            </Text>
                            <Text style={styles.noResultsHint}>Search by name or email</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  )}

                  {/* Current Payees */}
                  {editPayees.map((payee, index) => (
                    <View key={payee.mailId} style={styles.editPayeeRow}>
                      <View style={styles.editPayeeInfo}>
                        <View style={styles.editPayeeAvatar}>
                          <Text style={styles.editPayeeAvatarText}>
                            {(payee.name || payee.mailId).charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.editPayeeDetails}>
                          <Text style={styles.editPayeeName} numberOfLines={1}>{payee.name}</Text>
                          {payee.isPayer && (
                            <Text style={styles.editPayerBadge}>Payer</Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.editPayeeActions}>
                        <View style={styles.editPayeeAmountWrapper}>
                          <Text style={styles.editPayeeCurrency}>₹</Text>
                          <TextInput
                            style={styles.editPayeeAmountInput}
                            value={payee.amount}
                            onChangeText={(val) => handlePayeeAmountChange(payee.mailId, val)}
                            placeholder="0"
                            placeholderTextColor="#CCC"
                            keyboardType="decimal-pad"
                          />
                        </View>
                        {/* Don't allow deleting the payer */}
                        {!payee.isPayer && (
                          <TouchableOpacity 
                            style={styles.editPayeeDeleteButton}
                            onPress={() => handleRemovePayee(payee)}
                          >
                            <Ionicons name="trash-outline" size={18} color="#DC3545" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}

                  {editPayees.length === 0 && (
                    <View style={styles.noPayeesMessage}>
                      <Text style={styles.noPayeesText}>No members added. Add members to split the expense.</Text>
                    </View>
                  )}

                  {/* Removed Payees - Can Add Back */}
                  {removedPayees.length > 0 && (
                    <View style={styles.removedPayeesSection}>
                      <Text style={styles.removedPayeesTitle}>Removed Members</Text>
                      {removedPayees.map((payee) => (
                        <View key={payee.mailId} style={styles.removedPayeeRow}>
                          <View style={styles.editPayeeInfo}>
                            <View style={[styles.editPayeeAvatar, styles.removedPayeeAvatar]}>
                              <Text style={styles.editPayeeAvatarText}>
                                {(payee.name || payee.mailId).charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <View style={styles.removedPayeeDetails}>
                              <Text style={styles.removedPayeeName} numberOfLines={1}>{payee.name}</Text>
                              {parseFloat(payee.amount) > 0 && (
                                <Text style={styles.removedPayeeAmount}>₹{parseFloat(payee.amount).toFixed(2)}</Text>
                              )}
                            </View>
                          </View>
                          <TouchableOpacity 
                            style={styles.addBackButton}
                            onPress={() => handleAddBackPayee(payee)}
                          >
                            <Ionicons name="add-circle-outline" size={18} color="#28A745" />
                            <Text style={styles.addBackButtonText}>Add back</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </ScrollView>

              <View style={styles.editExpenseButtons}>
                <TouchableOpacity
                  style={styles.editExpenseCancelButton}
                  onPress={() => setEditExpenseModalVisible(false)}
                  disabled={savingExpense}
                >
                  <Text style={styles.editExpenseCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.editExpenseSaveButton,
                    (!editExpenseName.trim() || editPayees.length === 0 || !hasExpenseChanges()) && styles.editExpenseSaveButtonDisabled
                  ]}
                  onPress={handleShowSaveConfirm}
                  disabled={savingExpense || !editExpenseName.trim() || editPayees.length === 0 || !hasExpenseChanges()}
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

        {/* Save Confirmation Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={showSaveConfirmModal}
          onRequestClose={() => setShowSaveConfirmModal(false)}
        >
          <Pressable 
            style={styles.saveConfirmModalOverlay}
            onPress={() => setShowSaveConfirmModal(false)}
          >
            <View style={styles.saveConfirmModalContent}>
              <View style={styles.saveConfirmModalHeader}>
                <Ionicons name="help-circle" size={48} color="#FF6B35" />
                <Text style={styles.saveConfirmModalTitle}>Save Changes?</Text>
                <Text style={styles.saveConfirmModalSubtitle}>
                  Are you sure you want to save these changes to the expense?
                </Text>
              </View>
              <View style={styles.saveConfirmModalButtonsRow}>
                <TouchableOpacity
                  style={styles.saveConfirmCancelButtonRow}
                  onPress={() => setShowSaveConfirmModal(false)}
                >
                  <Text style={styles.saveConfirmCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveConfirmSaveButtonRow}
                  onPress={handleConfirmSave}
                >
                  <Ionicons name="checkmark" size={18} color="#FFF" />
                  <Text style={styles.saveConfirmSaveText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Modal>

        {/* Expense Actions Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={expandedExpenseIndex !== null}
          onRequestClose={() => setExpandedExpenseIndex(null)}
        >
          <Pressable 
            style={styles.expenseActionsModalOverlay}
            onPress={() => setExpandedExpenseIndex(null)}
          >
            <View style={styles.expenseActionsModalContent}>
              <View style={styles.expenseActionsModalHeader}>
                <Text style={styles.expenseActionsModalTitle}>
                  {selectedExpense?.name || 'Expense Options'}
                </Text>
                <TouchableOpacity 
                  style={styles.expenseActionsCloseButton}
                  onPress={() => setExpandedExpenseIndex(null)}
                >
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity 
                style={styles.expenseActionRow}
                onPress={() => {
                  const index = expandedExpenseIndex;
                  setExpandedExpenseIndex(null);
                  handleViewExpense(selectedExpense, index);
                }}
              >
                <Ionicons name="eye-outline" size={20} color="#666" />
                <Text style={styles.expenseActionText}>View Details</Text>
              </TouchableOpacity>
              {isGroupEditable() && (
                <>
                  <TouchableOpacity 
                    style={styles.expenseActionRow}
                    onPress={() => {
                      setExpandedExpenseIndex(null);
                      handleEditExpense(selectedExpense);
                    }}
                  >
                    <Ionicons name="create-outline" size={20} color="#FF6B35" />
                    <Text style={[styles.expenseActionText, styles.expenseActionTextEdit]}>Edit Expense</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.expenseActionRow, styles.expenseActionRowLast]}
                    onPress={() => {
                      setExpandedExpenseIndex(null);
                      handleDeleteExpenseConfirm(selectedExpense);
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#DC3545" />
                    <Text style={[styles.expenseActionText, styles.expenseActionTextDelete]}>Delete</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </Pressable>
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

  // Original layout for Web/iOS
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
          <View style={styles.editExpenseContentLarge}>
            <View style={styles.editExpenseHeader}>
              <Text style={styles.editExpenseTitle}>Edit Expense</Text>
              <TouchableOpacity onPress={() => setEditExpenseModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.editExpenseScrollView}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
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

              {/* Total Amount Display */}
              <View style={styles.editTotalRow}>
                <Text style={styles.editTotalLabel}>Total Amount</Text>
                <Text style={styles.editTotalValue}>₹{getEditPayeesTotal().toFixed(2)}</Text>
              </View>

              {/* Members Section */}
              <View style={styles.editPayeesSection}>
                <View style={styles.editPayeesHeader}>
                  <Text style={styles.editExpenseLabel}>Members & Splits</Text>
                  <TouchableOpacity 
                    style={styles.addUserButton}
                    onPress={() => setShowAddUserSection(!showAddUserSection)}
                  >
                    <Ionicons name={showAddUserSection ? "close" : "person-add"} size={18} color="#FF6B35" />
                    <Text style={styles.addUserButtonText}>{showAddUserSection ? 'Close' : 'Add'}</Text>
                  </TouchableOpacity>
                </View>

                {/* Add User Section */}
                {showAddUserSection && (
                  <View style={styles.addUserSection}>
                    <View style={styles.addUserInputRow}>
                      <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
                      <TextInput
                        style={styles.addUserInput}
                        value={addUserSearch}
                        onChangeText={setAddUserSearch}
                        placeholder="Search by name or email..."
                        placeholderTextColor="#999"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoFocus={true}
                      />
                      {addUserSearch.trim() ? (
                        <TouchableOpacity 
                          style={styles.clearSearchButton}
                          onPress={() => setAddUserSearch('')}
                        >
                          <Ionicons name="close-circle" size={20} color="#999" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    
                    {/* Search Results */}
                    <View style={styles.searchResultsContainer}>
                      {isSearchingUsers && addUserSearch.trim().length >= 2 && (
                        <View style={styles.searchingIndicator}>
                          <ActivityIndicator size="small" color="#FF6B35" />
                          <Text style={styles.searchingText}>Searching...</Text>
                        </View>
                      )}
                      {getSearchSuggestions().length > 0 ? (
                        <>
                          {getSearchSuggestions().map((suggestion, index) => (
                            <TouchableOpacity
                              key={suggestion.mailId}
                              style={[
                                styles.suggestionItem,
                                suggestion.isNew && styles.suggestionItemNew,
                                suggestion.isApiResult && styles.suggestionItemApi,
                                index < getSearchSuggestions().length - 1 && styles.suggestionItemBorder
                              ]}
                              onPress={() => handleSelectSuggestion(suggestion)}
                            >
                              <View style={[
                                styles.suggestionAvatar,
                                suggestion.isNew && styles.suggestionAvatarNew,
                                suggestion.isApiResult && styles.suggestionAvatarApi
                              ]}>
                                {suggestion.isNew ? (
                                  <Ionicons name="person-add" size={14} color="#FFF" />
                                ) : (
                                  <Text style={styles.suggestionAvatarText}>
                                    {(suggestion.name || suggestion.mailId).charAt(0).toUpperCase()}
                                  </Text>
                                )}
                              </View>
                              <View style={styles.suggestionInfo}>
                                <View style={styles.suggestionNameRow}>
                                  <Text style={[styles.suggestionName, suggestion.isNew && styles.suggestionNameNew]} numberOfLines={1}>
                                    {suggestion.isNew ? 'Add new member' : suggestion.name}
                                  </Text>
                                  {suggestion.isGroupMember && (
                                    <View style={styles.suggestionBadge}>
                                      <Text style={styles.suggestionBadgeText}>Group</Text>
                                    </View>
                                  )}
                                </View>
                                <Text style={styles.suggestionEmail} numberOfLines={1}>
                                  {suggestion.mailId}
                                </Text>
                              </View>
                              <Ionicons name="add-circle" size={22} color={suggestion.isNew ? "#28A745" : "#FF6B35"} />
                            </TouchableOpacity>
                          ))}
                        </>
                      ) : addUserSearch.trim() && addUserSearch.trim().length >= 2 && !isSearchingUsers ? (
                        <View style={styles.noResultsMessage}>
                          <Text style={styles.noResultsText}>No users found for "{addUserSearch}"</Text>
                          <Text style={styles.noResultsHint}>Enter a full email address to add someone new</Text>
                          {addUserSearch.includes('@') && (
                            <TouchableOpacity
                              style={styles.addNewEmailRow}
                              onPress={handleAddNewUser}
                            >
                              <View style={[styles.suggestionAvatar, styles.suggestionAvatarNew]}>
                                <Ionicons name="person-add" size={14} color="#FFF" />
                              </View>
                              <View style={styles.suggestionInfo}>
                                <Text style={styles.suggestionNameNew}>Add as new member</Text>
                                <Text style={styles.suggestionEmail}>{addUserSearch.trim()}</Text>
                              </View>
                              <Ionicons name="add-circle" size={22} color="#28A745" />
                            </TouchableOpacity>
                          )}
                        </View>
                      ) : !addUserSearch.trim() ? (
                        <View style={styles.noResultsMessage}>
                          <Text style={styles.noResultsText}>
                            {allGroupMembers.filter(m => !editPayees.some(p => p.mailId.toLowerCase() === m.mailId.toLowerCase())).length === 0 
                              ? 'All group members added' 
                              : 'Type to search users...'}
                          </Text>
                          <Text style={styles.noResultsHint}>Search by name or email</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                )}

                {/* Current Payees */}
                {editPayees.map((payee, index) => (
                  <View key={payee.mailId} style={styles.editPayeeRow}>
                    <View style={styles.editPayeeInfo}>
                      <View style={styles.editPayeeAvatar}>
                        <Text style={styles.editPayeeAvatarText}>
                          {(payee.name || payee.mailId).charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.editPayeeDetails}>
                        <Text style={styles.editPayeeName} numberOfLines={1}>{payee.name}</Text>
                        {payee.isPayer && (
                          <Text style={styles.editPayerBadge}>Payer</Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.editPayeeActions}>
                      <View style={styles.editPayeeAmountWrapper}>
                        <Text style={styles.editPayeeCurrency}>₹</Text>
                        <TextInput
                          style={styles.editPayeeAmountInput}
                          value={payee.amount}
                          onChangeText={(val) => handlePayeeAmountChange(payee.mailId, val)}
                          placeholder="0"
                          placeholderTextColor="#CCC"
                          keyboardType="decimal-pad"
                        />
                      </View>
                      {/* Don't allow deleting the payer */}
                      {!payee.isPayer && (
                        <TouchableOpacity 
                          style={styles.editPayeeDeleteButton}
                          onPress={() => handleRemovePayee(payee)}
                        >
                          <Ionicons name="trash-outline" size={18} color="#DC3545" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}

                {editPayees.length === 0 && (
                  <View style={styles.noPayeesMessage}>
                    <Text style={styles.noPayeesText}>No members added. Add members to split the expense.</Text>
                  </View>
                )}

                {/* Removed Payees - Can Add Back */}
                {removedPayees.length > 0 && (
                  <View style={styles.removedPayeesSection}>
                    <Text style={styles.removedPayeesTitle}>Removed Members</Text>
                    {removedPayees.map((payee) => (
                      <View key={payee.mailId} style={styles.removedPayeeRow}>
                        <View style={styles.editPayeeInfo}>
                          <View style={[styles.editPayeeAvatar, styles.removedPayeeAvatar]}>
                            <Text style={styles.editPayeeAvatarText}>
                              {(payee.name || payee.mailId).charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.removedPayeeDetails}>
                            <Text style={styles.removedPayeeName} numberOfLines={1}>{payee.name}</Text>
                            {parseFloat(payee.amount) > 0 && (
                              <Text style={styles.removedPayeeAmount}>₹{parseFloat(payee.amount).toFixed(2)}</Text>
                            )}
                          </View>
                        </View>
                        <TouchableOpacity 
                          style={styles.addBackButton}
                          onPress={() => handleAddBackPayee(payee)}
                        >
                          <Ionicons name="add-circle-outline" size={18} color="#28A745" />
                          <Text style={styles.addBackButtonText}>Add back</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.editExpenseButtons}>
              <TouchableOpacity
                style={styles.editExpenseCancelButton}
                onPress={() => setEditExpenseModalVisible(false)}
                disabled={savingExpense}
              >
                <Text style={styles.editExpenseCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.editExpenseSaveButton,
                  (!editExpenseName.trim() || editPayees.length === 0 || !hasExpenseChanges()) && styles.editExpenseSaveButtonDisabled
                ]}
                onPress={handleShowSaveConfirm}
                disabled={savingExpense || !editExpenseName.trim() || editPayees.length === 0 || !hasExpenseChanges()}
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

      {/* Save Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showSaveConfirmModal}
        onRequestClose={() => setShowSaveConfirmModal(false)}
      >
        <Pressable 
          style={styles.saveConfirmModalOverlay}
          onPress={() => setShowSaveConfirmModal(false)}
        >
          <View style={styles.saveConfirmModalContent}>
            <View style={styles.saveConfirmModalHeader}>
              <Ionicons name="help-circle" size={48} color="#FF6B35" />
              <Text style={styles.saveConfirmModalTitle}>Save Changes?</Text>
              <Text style={styles.saveConfirmModalSubtitle}>
                Are you sure you want to save these changes to the expense?
              </Text>
            </View>
            <View style={styles.saveConfirmModalButtonsRow}>
              <TouchableOpacity
                style={styles.saveConfirmCancelButtonRow}
                onPress={() => setShowSaveConfirmModal(false)}
              >
                <Text style={styles.saveConfirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveConfirmSaveButtonRow}
                onPress={handleConfirmSave}
              >
                <Ionicons name="checkmark" size={18} color="#FFF" />
                <Text style={styles.saveConfirmSaveText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Expense Actions Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={expandedExpenseIndex !== null}
        onRequestClose={() => setExpandedExpenseIndex(null)}
      >
        <Pressable 
          style={styles.expenseActionsModalOverlay}
          onPress={() => setExpandedExpenseIndex(null)}
        >
          <View style={styles.expenseActionsModalContent}>
            <View style={styles.expenseActionsModalHeader}>
              <Text style={styles.expenseActionsModalTitle}>
                {selectedExpense?.name || 'Expense Options'}
              </Text>
              <TouchableOpacity 
                style={styles.expenseActionsCloseButton}
                onPress={() => setExpandedExpenseIndex(null)}
              >
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              style={styles.expenseActionRow}
              onPress={() => {
                const index = expandedExpenseIndex;
                setExpandedExpenseIndex(null);
                handleViewExpense(selectedExpense, index);
              }}
            >
              <Ionicons name="eye-outline" size={20} color="#666" />
              <Text style={styles.expenseActionText}>View Details</Text>
            </TouchableOpacity>
            {isGroupEditable() && (
              <>
                <TouchableOpacity 
                  style={styles.expenseActionRow}
                  onPress={() => {
                    setExpandedExpenseIndex(null);
                    handleEditExpense(selectedExpense);
                  }}
                >
                  <Ionicons name="create-outline" size={20} color="#FF6B35" />
                  <Text style={[styles.expenseActionText, styles.expenseActionTextEdit]}>Edit Expense</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.expenseActionRow, styles.expenseActionRowLast]}
                  onPress={() => {
                    setExpandedExpenseIndex(null);
                    handleDeleteExpenseConfirm(selectedExpense);
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color="#DC3545" />
                  <Text style={[styles.expenseActionText, styles.expenseActionTextDelete]}>Delete</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Pressable>
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
  cardRefreshButtonMobileWeb: {
    width: 'auto',
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 6,
  },
  refreshButtonText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '600',
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
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabDesktop: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 4,
  },
  tabMobile: {
    flexDirection: 'column',
    paddingVertical: 8,
    paddingHorizontal: 2,
    gap: 2,
    minHeight: 60,
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
    fontWeight: '600',
    color: '#888',
    textAlign: 'center',
  },
  tabTextDesktop: {
    fontSize: 12,
  },
  tabTextMobile: {
    fontSize: 10,
  },
  tabTextActive: {
    color: '#FF6B35',
  },
  tabCount: {
    fontWeight: '600',
    color: '#888',
  },
  tabCountDesktop: {
    fontSize: 12,
  },
  tabCountMobile: {
    fontSize: 9,
  },
  tabCountActive: {
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
    padding: Platform.OS === 'web' ? 14 : 12,
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
    minWidth: 0, // Allow text truncation
    marginRight: 8,
  },
  settlementFromTo: {
    fontSize: Platform.OS === 'web' ? 14 : 13,
    flexWrap: 'wrap',
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
  // Activity Tab Styles
  activityScrollFull: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
  },
  activityScrollContent: {
    paddingVertical: 8,
  },
  activityRow: {
    flexDirection: 'row',
    padding: Platform.OS === 'web' ? 14 : 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
    backgroundColor: '#FFF',
  },
  activityIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  activityContent: {
    flex: 1,
    minWidth: 0,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  activityAction: {
    fontSize: Platform.OS === 'web' ? 14 : 13,
    fontWeight: '700',
  },
  activityTime: {
    fontSize: Platform.OS === 'web' ? 11 : 10,
    color: '#888',
  },
  activityDescription: {
    fontSize: Platform.OS === 'web' ? 13 : 12,
    color: '#333',
    marginBottom: 4,
    lineHeight: 18,
  },
  activityUser: {
    fontSize: Platform.OS === 'web' ? 12 : 11,
    color: '#888',
    fontStyle: 'italic',
  },
  noActivityFull: {
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
    position: 'relative',
    backgroundColor: '#F8F8F8',
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
  // Save Confirmation Modal Styles
  saveConfirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  saveConfirmModalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  saveConfirmModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  saveConfirmModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  saveConfirmModalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  saveConfirmModalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  saveConfirmCancelButtonRow: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  saveConfirmCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  saveConfirmSaveButtonRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FF6B35',
  },
  saveConfirmSaveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  expenseActionsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  expenseActionsModalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 300,
    overflow: 'hidden',
  },
  expenseActionsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  expenseActionsModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  expenseActionsCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  expenseActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    gap: 14,
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  expenseActionRowLast: {
    borderBottomWidth: 0,
  },
  expenseActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555',
  },
  expenseActionTextEdit: {
    color: '#FF6B35',
  },
  expenseActionTextDelete: {
    color: '#DC3545',
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
  editExpenseSaveButtonDisabled: {
    backgroundColor: '#CCC',
  },
  editExpenseContentLarge: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Platform.OS === 'web' ? 24 : 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : (Platform.OS === 'web' ? 24 : 16),
    maxHeight: '90%',
  },
  editExpenseScrollView: {
    maxHeight: Platform.OS === 'web' ? 400 : undefined,
  },
  editTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  editTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  editTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF6B35',
  },
  editPayeesSection: {
    marginBottom: 16,
  },
  editPayeesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addUserButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FFF5F0',
    borderRadius: 16,
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  addUserButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF6B35',
  },
  addUserSection: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  addUserInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    marginRight: 8,
  },
  addUserInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  addUserConfirmButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  addUserConfirmButtonDisabled: {
    backgroundColor: '#CCC',
  },
  clearSearchButton: {
    padding: 8,
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  searchResultsContainer: {
    marginTop: 10,
    backgroundColor: '#FFF',
    borderRadius: 10,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Platform.OS === 'web' ? 12 : 10,
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  suggestionItemNew: {
    backgroundColor: '#F0FFF4',
  },
  suggestionItemApi: {
    backgroundColor: '#FFF8F5',
  },
  suggestionItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  searchingText: {
    fontSize: 14,
    color: '#888',
  },
  suggestionAvatar: {
    width: Platform.OS === 'web' ? 32 : 28,
    height: Platform.OS === 'web' ? 32 : 28,
    borderRadius: Platform.OS === 'web' ? 16 : 14,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  suggestionAvatarNew: {
    backgroundColor: '#28A745',
  },
  suggestionAvatarApi: {
    backgroundColor: '#6C63FF',
  },
  suggestionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  suggestionBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#28A745',
  },
  suggestionAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  suggestionInfo: {
    flex: 1,
    marginRight: 8,
    minWidth: 0, // Allow text truncation
  },
  suggestionName: {
    fontSize: Platform.OS === 'web' ? 14 : 13,
    fontWeight: '600',
    color: '#333',
  },
  suggestionNameNew: {
    fontSize: Platform.OS === 'web' ? 14 : 13,
    fontWeight: '600',
    color: '#28A745',
  },
  suggestionEmail: {
    fontSize: Platform.OS === 'web' ? 12 : 11,
    color: '#888',
    marginTop: 1,
  },
  noResultsMessage: {
    padding: 16,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  noResultsHint: {
    fontSize: 12,
    color: '#AAA',
    marginBottom: 12,
    textAlign: 'center',
  },
  addNewEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0FFF4',
    borderRadius: 10,
    width: '100%',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  searchHintMessage: {
    padding: 16,
    alignItems: 'center',
  },
  searchHintText: {
    fontSize: 14,
    color: '#999',
  },
  editPayeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: Platform.OS === 'web' ? 12 : 10,
    marginBottom: 8,
  },
  editPayeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0, // Allow flex shrinking
    marginRight: 6,
  },
  editPayeeAvatar: {
    width: Platform.OS === 'web' ? 36 : 32,
    height: Platform.OS === 'web' ? 36 : 32,
    borderRadius: Platform.OS === 'web' ? 18 : 16,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  editPayeeAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  editPayeeDetails: {
    flex: 1,
    minWidth: 0, // Allow text truncation
  },
  editPayeeName: {
    fontSize: Platform.OS === 'web' ? 14 : 13,
    fontWeight: '600',
    color: '#333',
  },
  editPayerBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FF6B35',
    marginTop: 2,
  },
  editPayeeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.OS === 'web' ? 8 : 6,
    flexShrink: 0,
  },
  editPayeeAmountWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    paddingHorizontal: Platform.OS === 'web' ? 10 : 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  editPayeeCurrency: {
    fontSize: Platform.OS === 'web' ? 14 : 13,
    fontWeight: '600',
    color: '#666',
  },
  editPayeeAmountInput: {
    width: Platform.OS === 'web' ? 70 : 55,
    paddingVertical: Platform.OS === 'web' ? 10 : 8,
    paddingHorizontal: 4,
    fontSize: Platform.OS === 'web' ? 14 : 13,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  editPayeeDeleteButton: {
    width: Platform.OS === 'web' ? 36 : 32,
    height: Platform.OS === 'web' ? 36 : 32,
    borderRadius: Platform.OS === 'web' ? 18 : 16,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  noPayeesMessage: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  noPayeesText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  removedPayeesSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  removedPayeesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    marginBottom: 10,
  },
  removedPayeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderStyle: 'dashed',
  },
  removedPayeeAvatar: {
    backgroundColor: '#CCC',
  },
  removedPayeeDetails: {
    flex: 1,
  },
  removedPayeeName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888',
  },
  removedPayeeAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#28A745',
    marginTop: 2,
  },
  addBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#E8F5E9',
    borderRadius: 14,
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  addBackButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#28A745',
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

// Android-specific styles
const androidStyles = StyleSheet.create({
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
    paddingTop: 50,
    paddingHorizontal: 20,
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
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 44,
  },
  decorativeIconContainer: {
    alignItems: 'center',
    marginTop: -20,
    marginBottom: 10,
  },
  decorativeIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  whiteContentArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
    paddingTop: 30,
  },
});
