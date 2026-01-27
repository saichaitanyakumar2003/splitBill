import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  BackHandler,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { authGet, authPost } from '../utils/apiHelper';
import { useAuth } from '../context/AuthContext';

export default function PendingExpensesScreen({ route }) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingExpenses, setPendingExpenses] = useState([]);
  const [resolvingEdge, setResolvingEdge] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    groupId: null,
    from: null,
    to: null,
    toName: '',
    amount: 0,
    isLastEdge: false,
    groupName: '',
  });
  const [successModal, setSuccessModal] = useState({
    visible: false,
    groupName: '',
    keptActive: false,
  });
  const [completionChoiceModal, setCompletionChoiceModal] = useState({
    visible: false,
    groupId: null,
    from: null,
    to: null,
    groupName: '',
  });

  const fetchPendingExpenses = async () => {
    try {
      const response = await authGet('/groups/pending');
      const data = await response.json();
      if (data.success) {
        setPendingExpenses(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching pending expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingExpenses();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPendingExpenses();
    setRefreshing(false);
  }, []);

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


  const handleResolve = (groupId, from, to, toName, amount, groupName, pendingCount) => {
    const isLastEdge = pendingCount === 1;
    setConfirmModal({
      visible: true,
      groupId,
      from,
      to,
      toName,
      amount,
      isLastEdge,
      groupName,
    });
  };

  const processResolve = async (groupId, from, to, keepActive = false) => {
    setResolvingEdge(`${groupId}-${from}-${to}`);
    try {
      const response = await authPost(`/groups/${groupId}/resolve`, { from, to, keepActive });
      const data = await response.json();
      
      if (data.success) {
        await fetchPendingExpenses();
        
        if (data.data.allResolved) {
          setSuccessModal({
            visible: true,
            groupName: data.data.groupName,
            keptActive: keepActive,
          });
        }
      } else {
        const errorMsg = data.message || 'Failed to mark as settled';
        if (Platform.OS === 'web') {
          alert(errorMsg);
        } else {
          Alert.alert('Error', errorMsg);
        }
      }
    } catch (error) {
      console.error('Error resolving expense:', error);
      const errorMsg = 'Network error. Please try again.';
      if (Platform.OS === 'web') {
        alert(errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setResolvingEdge(null);
    }
  };

  const handleConfirmSettle = () => {
    const { groupId, from, to, isLastEdge, groupName } = confirmModal;
    setConfirmModal({ ...confirmModal, visible: false });
    
    if (isLastEdge) {
      // Show completion choice modal
      setCompletionChoiceModal({
        visible: true,
        groupId,
        from,
        to,
        groupName,
      });
    } else {
      processResolve(groupId, from, to);
    }
  };

  const handleCancelSettle = () => {
    setConfirmModal({
      visible: false,
      groupId: null,
      from: null,
      to: null,
      toName: '',
      amount: 0,
      isLastEdge: false,
      groupName: '',
    });
  };

  const handleCompletionChoice = (keepActive) => {
    const { groupId, from, to } = completionChoiceModal;
    setCompletionChoiceModal({ visible: false, groupId: null, from: null, to: null, groupName: '' });
    processResolve(groupId, from, to, keepActive);
  };

  const handleCancelCompletionChoice = () => {
    setCompletionChoiceModal({
      visible: false,
      groupId: null,
      from: null,
      to: null,
      groupName: '',
    });
  };

  const totalPending = pendingExpenses.reduce(
    (sum, group) => sum + (group.pendingEdges?.length || 0),
    0
  );

  const totalAmount = pendingExpenses.reduce(
    (sum, group) => sum + (group.pendingEdges || []).reduce((s, e) => s + (e.amount || 0), 0),
    0
  );

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
          <Text style={styles.headerTitle}>Pending Payments</Text>
          <View style={styles.headerRight} />
        </View>

        {/* White Background Card */}
        <View style={styles.content}>
          <View style={styles.card}>
            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="large" color="#FF6B35" />
                <Text style={styles.loadingText}>Loading pending expenses...</Text>
              </View>
            ) : pendingExpenses.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>✅</Text>
                <Text style={styles.emptyTitle}>All Settled!</Text>
                <Text style={styles.emptySubtext}>
                  You have no pending payments. All your expenses are settled.
                </Text>
              </View>
            ) : (
              <>
                {/* Summary Header */}
                <View style={styles.summaryHeader}>
                  <View>
                    <Text style={styles.summaryTitle}>You Owe</Text>
                    <Text style={styles.summaryAmount}>₹{totalAmount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryBadge}>
                    <Text style={styles.summaryBadgeText}>
                      {totalPending} payment{totalPending !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                {/* Scrollable Pending List */}
                <ScrollView 
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollViewContent}
                  showsVerticalScrollIndicator={true}
                  bounces={true}
                  nestedScrollEnabled={true}
                  refreshControl={
                    Platform.OS !== 'web' ? (
                      <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#FF6B35"
                        colors={['#FF6B35']}
                      />
                    ) : undefined
                  }
                >
                  {pendingExpenses.map((group) => (
                    <View key={group.groupId} style={styles.groupSection}>
                      {/* Group Header */}
                      <View style={styles.groupHeader}>
                        <View style={styles.groupIcon}>
                          <Text style={styles.groupIconText}>
                            {group.groupName.substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.groupInfo}>
                          <Text style={styles.groupName} numberOfLines={1}>{group.groupName}</Text>
                          <Text style={styles.groupStatus}>
                            {group.pendingEdges?.length || 0} pending
                            {group.resolvedEdges?.length > 0 && ` • ${group.resolvedEdges.length} settled`}
                          </Text>
                        </View>
                      </View>

                      {/* Pending Edges */}
                      {group.pendingEdges?.map((edge, index) => {
                        const isResolving = resolvingEdge === `${group.groupId}-${edge.from}-${edge.to}`;
                        const pendingCount = group.pendingEdges?.length || 0;
                        return (
                          <View key={`pending-${index}`} style={styles.expenseRow}>
                            <View style={styles.expenseTop}>
                              <View style={styles.avatarTo}>
                                <Text style={styles.avatarText}>
                                  {(edge.toName || 'U').charAt(0).toUpperCase()}
                                </Text>
                              </View>
                              <View style={styles.expenseInfo}>
                                <Text style={styles.expenseText} numberOfLines={1}>
                                  Pay <Text style={styles.expenseName}>{edge.toName}</Text>
                                </Text>
                                <Text style={styles.expenseAmount}>₹{edge.amount.toFixed(2)}</Text>
                              </View>
                            </View>
                            <View style={styles.buttonGroup}>
                              <TouchableOpacity
                                style={[styles.resolveButton, isResolving && styles.resolveButtonDisabled]}
                                onPress={() => handleResolve(group.groupId, edge.from, edge.to, edge.toName, edge.amount, group.groupName, pendingCount)}
                                disabled={isResolving}
                              >
                                {isResolving ? (
                                  <ActivityIndicator size="small" color="#FF6B35" />
                                ) : (
                                  <Text style={styles.resolveButtonText}>Mark as Settled</Text>
                                )}
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}

                      {/* Resolved Edges */}
                      {group.resolvedEdges?.map((edge, index) => (
                        <View key={`resolved-${index}`} style={styles.expenseRowResolved}>
                          <View style={styles.expenseLeft}>
                            <View style={styles.avatarResolved}>
                              <Text style={styles.avatarTextResolved}>
                                {(edge.toName || 'U').charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <View style={styles.expenseInfo}>
                              <Text style={styles.expenseTextResolved} numberOfLines={1}>
                                Paid {edge.toName}
                              </Text>
                              <Text style={styles.expenseAmountResolved}>₹{edge.amount.toFixed(2)}</Text>
                            </View>
                          </View>
                          <View style={styles.settledBadge}>
                            <Text style={styles.settledBadgeText}>✓</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        </View>

        {/* Confirm Settle Modal */}
        <Modal
          visible={confirmModal.visible}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCancelSettle}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalIconContainer}>
                <Text style={styles.modalIcon}>💰</Text>
              </View>
              <Text style={styles.modalTitle}>Mark as Settled?</Text>
              <Text style={styles.modalMessage}>
                Have you paid{' '}
                <Text style={styles.modalAmount}>₹{confirmModal.amount.toFixed(2)}</Text>
                {' '}to{' '}
                <Text style={styles.modalName}>{confirmModal.toName}</Text>?
              </Text>
              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={handleCancelSettle}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmButton}
                  onPress={handleConfirmSettle}
                >
                  <Text style={styles.modalConfirmText}>Yes, Settled</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Success Modal */}
        <Modal
          visible={successModal.visible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSuccessModal({ visible: false, groupName: '', keptActive: false })}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.successModalContainer}>
              <View style={styles.successIconContainer}>
                <Text style={styles.successIcon}>{successModal.keptActive ? '✅' : '🎉'}</Text>
              </View>
              <Text style={styles.successTitle}>
                {successModal.keptActive ? 'All Settled!' : 'Group Completed!'}
              </Text>
              <Text style={styles.successMessage}>
                All payments in{' '}
                <Text style={styles.successGroupName}>"{successModal.groupName}"</Text>
                {' '}have been settled!
              </Text>
              <Text style={styles.successSubMessage}>
                {successModal.keptActive 
                  ? 'The group is still active for future expenses.'
                  : 'The group has been moved to History and will be auto-deleted in 7 days.'}
              </Text>
              <TouchableOpacity
                style={styles.successButton}
                onPress={() => setSuccessModal({ visible: false, groupName: '', keptActive: false })}
              >
                <Text style={styles.successButtonText}>Got it!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Completion Choice Modal */}
        <Modal
          visible={completionChoiceModal.visible}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCancelCompletionChoice}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.completionModalContainer}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleCancelCompletionChoice}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
              <View style={styles.completionIconContainer}>
                <Text style={styles.completionIcon}>🏁</Text>
              </View>
              <Text style={styles.completionTitle}>Last Payment!</Text>
              <Text style={styles.completionMessage}>
                This is the last pending payment in{' '}
                <Text style={styles.completionGroupName}>"{completionChoiceModal.groupName}"</Text>.
                {'\n\n'}What would you like to do with the group?
              </Text>
              <View style={styles.completionButtonRow}>
                <TouchableOpacity
                  style={styles.keepActiveButton}
                  onPress={() => handleCompletionChoice(true)}
                >
                  <Text style={styles.keepActiveButtonText}>Keep Active</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.completeGroupButton}
                  onPress={() => handleCompletionChoice(false)}
                >
                  <Text style={styles.completeGroupButtonText}>Complete Group</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
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
    overflow: 'hidden',
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
    paddingHorizontal: 20,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888',
  },
  summaryAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FF6B35',
    marginTop: 2,
  },
  summaryBadge: {
    backgroundColor: '#FFF5F0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  summaryBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  groupSection: {
    marginTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupIconText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  groupStatus: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  expenseRow: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  expenseTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  expenseRowResolved: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    opacity: 0.5,
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarTo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#28A745',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarResolved: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#CCC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  avatarTextResolved: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  expenseInfo: {
    flex: 1,
  },
  expenseText: {
    fontSize: 15,
    color: '#333',
  },
  expenseName: {
    fontWeight: '600',
    color: '#28A745',
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 2,
  },
  expenseTextResolved: {
    fontSize: 14,
    color: '#888',
    textDecorationLine: 'line-through',
  },
  expenseAmountResolved: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  resolveButton: {
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FF6B35',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  resolveButtonDisabled: {
    opacity: 0.7,
  },
  resolveButtonText: {
    color: '#FF6B35',
    fontSize: 13,
    fontWeight: '700',
  },
  settledBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  settledBadgeText: {
    color: '#28A745',
    fontSize: 14,
    fontWeight: '700',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  modalIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIcon: {
    fontSize: 36,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
  modalAmount: {
    fontWeight: '700',
    color: '#FF6B35',
  },
  modalName: {
    fontWeight: '700',
    color: '#333',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#28A745',
    alignItems: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  successModalContainer: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successIcon: {
    fontSize: 42,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#28A745',
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  successGroupName: {
    fontWeight: '700',
    color: '#333',
  },
  successSubMessage: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  successButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#28A745',
    alignItems: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  completionModalContainer: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 28,
    paddingTop: 40,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  completionIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  completionIcon: {
    fontSize: 42,
  },
  completionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  completionMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  completionGroupName: {
    fontWeight: '700',
    color: '#333',
  },
  completionButtonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  completeGroupButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28A745',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  completeGroupButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  keepActiveButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  keepActiveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});
