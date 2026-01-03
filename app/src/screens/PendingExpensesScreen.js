import React, { useState, useCallback, useEffect } from 'react';
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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
  });
  const [successModal, setSuccessModal] = useState({
    visible: false,
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

  // Handle Android hardware back button - use useFocusEffect to ensure it only runs when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;

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
    }, [navigation])
  );

  const handleResolve = (groupId, from, to, toName, amount) => {
    // Show confirmation modal for both web and mobile
    setConfirmModal({
      visible: true,
      groupId,
      from,
      to,
      toName,
      amount,
    });
  };

  const processResolve = async (groupId, from, to) => {
    setResolvingEdge(`${groupId}-${from}-${to}`);
    try {
      const response = await authPost(`/groups/${groupId}/resolve`, { from, to });
      const data = await response.json();
      
      if (data.success) {
        // Refresh the list
        await fetchPendingExpenses();
        
        // Show success modal if group was completed
        if (data.data.allResolved) {
          setSuccessModal({
            visible: true,
            groupName: data.data.groupName,
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
    const { groupId, from, to } = confirmModal;
    setConfirmModal({ ...confirmModal, visible: false });
    processResolve(groupId, from, to);
  };

  const handleCancelSettle = () => {
    setConfirmModal({
      visible: false,
      groupId: null,
      from: null,
      to: null,
      toName: '',
      amount: 0,
    });
  };

  // Count total pending payments
  const totalPending = pendingExpenses.reduce(
    (sum, group) => sum + (group.pendingEdges?.length || 0),
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
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pending Expenses</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Content */}
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
          {loading ? (
            <View style={styles.card}>
              <View style={styles.loadingState}>
                <ActivityIndicator size="large" color="#FF6B35" />
                <Text style={styles.loadingText}>Loading pending expenses...</Text>
              </View>
            </View>
          ) : pendingExpenses.length === 0 ? (
            <View style={styles.card}>
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>✅</Text>
                <Text style={styles.emptyTitle}>All Settled!</Text>
                <Text style={styles.emptySubtext}>
                  You have no pending payments. All your expenses are settled.
                </Text>
              </View>
            </View>
          ) : (
            <>
              {/* Summary */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>You Owe</Text>
                <Text style={styles.summaryCount}>{totalPending} payment{totalPending !== 1 ? 's' : ''}</Text>
              </View>

              {/* Pending Expenses by Group */}
              {pendingExpenses.map((group) => (
                <View key={group.groupId} style={styles.groupCard}>
                  <View style={styles.groupHeader}>
                    <View style={styles.groupIcon}>
                      <Text style={styles.groupIconText}>
                        {group.groupName.substring(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.groupInfo}>
                      <Text style={styles.groupName}>{group.groupName}</Text>
                      <Text style={styles.groupStatus}>
                        {group.pendingEdges?.length || 0} pending
                        {group.resolvedEdges?.length > 0 && `, ${group.resolvedEdges.length} settled`}
                      </Text>
                    </View>
                  </View>

                  {/* Pending Edges */}
                  {group.pendingEdges?.map((edge, index) => {
                    const isResolving = resolvingEdge === `${group.groupId}-${edge.from}-${edge.to}`;
                    return (
                      <View key={`pending-${index}`} style={styles.expenseRow}>
                        <View style={styles.expenseInfo}>
                          <Text style={styles.expenseText}>
                            Pay <Text style={styles.expenseName}>{edge.toName}</Text>
                          </Text>
                          <Text style={styles.expenseAmount}>₹{edge.amount.toFixed(2)}</Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.resolveButton, isResolving && styles.resolveButtonDisabled]}
                          onPress={() => handleResolve(group.groupId, edge.from, edge.to, edge.toName, edge.amount)}
                          disabled={isResolving}
                        >
                          {isResolving ? (
                            <ActivityIndicator size="small" color="#FFF" />
                          ) : (
                            <Text style={styles.resolveButtonText}>Mark Settled</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })}

                  {/* Resolved Edges (greyed out) */}
                  {group.resolvedEdges?.map((edge, index) => (
                    <View key={`resolved-${index}`} style={[styles.expenseRow, styles.expenseRowResolved]}>
                      <View style={styles.expenseInfo}>
                        <Text style={[styles.expenseText, styles.expenseTextResolved]}>
                          Paid <Text style={styles.expenseNameResolved}>{edge.toName}</Text>
                        </Text>
                        <Text style={[styles.expenseAmount, styles.expenseAmountResolved]}>
                          ₹{edge.amount.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.settledBadge}>
                        <Text style={styles.settledBadgeText}>✓ Settled</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </>
          )}
        </ScrollView>

        {/* Confirmation Modal */}
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

        {/* Success Modal - Group Completed */}
        <Modal
          visible={successModal.visible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSuccessModal({ visible: false, groupName: '' })}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.successModalContainer}>
              <View style={styles.successIconContainer}>
                <Text style={styles.successIcon}>🎉</Text>
              </View>
              <Text style={styles.successTitle}>Group Completed!</Text>
              <Text style={styles.successMessage}>
                All payments in{' '}
                <Text style={styles.successGroupName}>"{successModal.groupName}"</Text>
                {' '}have been settled!
              </Text>
              <Text style={styles.successSubMessage}>
                The group has been moved to History.
              </Text>
              <TouchableOpacity
                style={styles.successButton}
                onPress={() => setSuccessModal({ visible: false, groupName: '' })}
              >
                <Text style={styles.successButtonText}>Got it!</Text>
              </TouchableOpacity>
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
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
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
    paddingHorizontal: 20,
  },
  summaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  summaryCount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF6B35',
  },
  groupCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupIconText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  groupStatus: {
    fontSize: 13,
    color: '#888',
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  expenseRowResolved: {
    opacity: 0.6,
    backgroundColor: '#F9F9F9',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseText: {
    fontSize: 15,
    color: '#333',
    marginBottom: 2,
  },
  expenseTextResolved: {
    color: '#888',
    textDecorationLine: 'line-through',
  },
  expenseName: {
    fontWeight: '600',
    color: '#FF6B35',
  },
  expenseNameResolved: {
    color: '#888',
    fontWeight: '600',
  },
  expenseAmount: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
  },
  expenseAmountResolved: {
    color: '#888',
    textDecorationLine: 'line-through',
  },
  resolveButton: {
    backgroundColor: '#28A745',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  resolveButtonDisabled: {
    opacity: 0.7,
  },
  resolveButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  settledBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 12,
  },
  settledBadgeText: {
    color: '#28A745',
    fontSize: 13,
    fontWeight: '600',
  },
  // Modal styles
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
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
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
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  // Success Modal styles
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
    ...(Platform.OS === 'web' && {
      maxWidth: 380,
    }),
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
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
