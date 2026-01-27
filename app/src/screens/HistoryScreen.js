import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { authGet } from '../utils/apiHelper';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function HistoryScreen({ route }) {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const slideAnim = useState(new Animated.Value(SCREEN_HEIGHT))[0];

  const fetchHistory = async () => {
    try {
      const response = await authGet('/groups/history');
      const data = await response.json();
      if (data.success) {
        setHistoryRecords(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };

  // Handle Android hardware back button
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const backAction = () => {
      if (modalVisible) {
        closeModal();
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
  }, [navigation, modalVisible]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTotalSettled = (settledEdges) => {
    if (!settledEdges || !Array.isArray(settledEdges)) return 0;
    return settledEdges.reduce((sum, edge) => sum + (edge.amount || 0), 0);
  };

  const openModal = (record) => {
    // For completed or deleted groups, navigate to the group screen
    if (record.groupStatus === 'completed' || record.groupStatus === 'deleted') {
      navigation.navigate('Groups', { 
        selectedGroupId: record.groupId,
        groupName: record.groupName
      });
      return;
    }
    
    // For active groups, show the modal
    setSelectedRecord(record);
    setModalVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const closeModal = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      setSelectedRecord(null);
    });
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
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>History</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.card}>
            {/* Card Header with Refresh - Always visible */}
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Settlement History</Text>
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

            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="large" color="#FF6B35" />
                <Text style={styles.loadingText}>Loading history...</Text>
              </View>
            ) : historyRecords.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📜</Text>
                <Text style={styles.emptyTitle}>No History Yet</Text>
                <Text style={styles.emptySubtext}>
                  Settled payments will appear here once you complete transactions
                </Text>
              </View>
            ) : (
              <>
                {/* Summary Info */}
                <View style={styles.summaryInfo}>
                  <Text style={styles.summaryCount}>
                    {historyRecords.length} group{historyRecords.length !== 1 ? 's' : ''}
                  </Text>
                </View>

                {/* Scrollable History List */}
                <ScrollView 
                  style={styles.groupsList}
                  contentContainerStyle={styles.groupsListContent}
                  showsVerticalScrollIndicator={true}
                >
                {historyRecords.map((record) => (
                  <View key={record.id} style={styles.historyItem}>
                    <View style={styles.historyItemLeft}>
                      <View style={styles.groupIcon}>
                        <Text style={styles.groupIconText}>
                          {record.groupName.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.groupInfo}>
                        <View style={styles.groupNameRow}>
                          <Text style={styles.groupName} numberOfLines={1}>{record.groupName}</Text>
                          {record.groupStatus && (
                            <View style={[
                              styles.statusBadge,
                              record.groupStatus === 'active' && styles.statusBadgeActive,
                              record.groupStatus === 'completed' && styles.statusBadgeCompleted,
                              record.groupStatus === 'deleted' && styles.statusBadgeDeleted,
                            ]}>
                              <Text style={[
                                styles.statusBadgeText,
                                record.groupStatus === 'active' && styles.statusBadgeTextActive,
                                record.groupStatus === 'completed' && styles.statusBadgeTextCompleted,
                                record.groupStatus === 'deleted' && styles.statusBadgeTextDeleted,
                              ]}>
                                {record.groupStatus === 'active' ? 'Active' : 
                                 record.groupStatus === 'completed' ? 'Completed' : 'Deleted'}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.settledCount}>
                          {record.settledEdges?.length || 0} settlement{(record.settledEdges?.length || 0) !== 1 ? 's' : ''} • ₹{getTotalSettled(record.settledEdges).toFixed(0)}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity 
                      style={styles.viewButton}
                      onPress={() => openModal(record)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.viewButtonText}>View settlements</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
              </>
            )}
          </View>
        </View>
      </LinearGradient>

      {/* Bottom Sheet Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeModal} />
          <Animated.View 
            style={[
              styles.modalContent,
              { transform: [{ translateY: slideAnim }] }
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>
                {selectedRecord?.groupName || 'Settlements'}
              </Text>
              <TouchableOpacity onPress={closeModal} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Stats */}
            {selectedRecord && (
              <View style={styles.modalStats}>
                <View style={styles.modalStatItem}>
                  <Text style={styles.modalStatValue}>
                    {selectedRecord.settledEdges?.length || 0}
                  </Text>
                  <Text style={styles.modalStatLabel}>Settlements</Text>
                </View>
                <View style={styles.modalStatDivider} />
                <View style={styles.modalStatItem}>
                  <Text style={styles.modalStatValue}>
                    ₹{getTotalSettled(selectedRecord.settledEdges).toFixed(2)}
                  </Text>
                  <Text style={styles.modalStatLabel}>Total Amount</Text>
                </View>
              </View>
            )}

            {/* Settlements List */}
            <ScrollView 
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={true}
            >
              {selectedRecord?.settledEdges?.map((edge, index) => (
                <View key={index} style={styles.settlementItem}>
                  <View style={styles.settlementLeft}>
                    <View style={styles.settlementAvatars}>
                      <View style={styles.avatarFrom}>
                        <Text style={styles.avatarText}>
                          {(edge.fromName || edge.from || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.avatarArrow}>
                        <Text style={styles.avatarArrowText}>→</Text>
                      </View>
                      <View style={styles.avatarTo}>
                        <Text style={styles.avatarText}>
                          {(edge.toName || edge.to || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.settlementNames}>
                      <Text style={styles.settlementFromName} numberOfLines={1}>
                        {edge.fromName || edge.from?.split('@')[0] || 'Unknown'}
                      </Text>
                      <Text style={styles.settlementToText}> paid </Text>
                      <Text style={styles.settlementToName} numberOfLines={1}>
                        {edge.toName || edge.to?.split('@')[0] || 'Unknown'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.settlementRight}>
                    <Text style={styles.settlementAmount}>₹{edge.amount?.toFixed(2)}</Text>
                    {edge.settledAt && (
                      <Text style={styles.settlementDate}>{formatDate(edge.settledAt)}</Text>
                    )}
                  </View>
                </View>
              ))}
              
              {(!selectedRecord?.settledEdges || selectedRecord.settledEdges.length === 0) && (
                <View style={styles.noSettlements}>
                  <Text style={styles.noSettlementsText}>No settlements yet</Text>
                </View>
              )}
            </ScrollView>
          </Animated.View>
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
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
  summaryInfo: {
    marginBottom: 12,
  },
  summaryCount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#28A745',
  },
  groupsList: {
    flex: 1,
  },
  groupsListContent: {
    paddingBottom: 10,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupIcon: {
    width: Platform.OS === 'web' ? 44 : 40,
    height: Platform.OS === 'web' ? 44 : 40,
    borderRadius: 12,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Platform.OS === 'web' ? 12 : 10,
    flexShrink: 0,
  },
  groupIconText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  groupInfo: {
    flex: 1,
    marginRight: Platform.OS === 'web' ? 12 : 8,
    minWidth: 0, // Allow text truncation
  },
  groupNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Platform.OS === 'web' ? 6 : 4,
    marginBottom: 2,
  },
  groupName: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    fontWeight: '600',
    color: '#333',
    flexShrink: 1,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  statusBadgeActive: {
    backgroundColor: '#E8F5E9',
  },
  statusBadgeCompleted: {
    backgroundColor: '#E3F2FD',
  },
  statusBadgeDeleted: {
    backgroundColor: '#FFEBEE',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#888',
  },
  statusBadgeTextActive: {
    color: '#28A745',
  },
  statusBadgeTextCompleted: {
    color: '#1976D2',
  },
  statusBadgeTextDeleted: {
    color: '#DC3545',
  },
  settledCount: {
    fontSize: Platform.OS === 'web' ? 13 : 12,
    color: '#888',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    flexShrink: 0,
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  viewButtonText: {
    fontSize: Platform.OS === 'web' ? 14 : 12,
    fontWeight: '600',
    color: '#FF6B35',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.7,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalHandle: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 4,
    backgroundColor: '#DDD',
    borderRadius: 2,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginTop: 8,
  },
  modalCloseButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  modalCloseText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  modalStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#F8F8F8',
  },
  modalStatItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#28A745',
  },
  modalStatLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  modalStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E0E0E0',
  },
  modalScrollView: {
    paddingHorizontal: 20,
    maxHeight: SCREEN_HEIGHT * 0.45,
  },
  settlementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  settlementLeft: {
    flex: 1,
  },
  settlementAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  avatarFrom: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#28A745',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  avatarArrow: {
    paddingHorizontal: 8,
  },
  avatarArrowText: {
    fontSize: 14,
    color: '#888',
  },
  settlementNames: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  settlementFromName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  settlementToText: {
    fontSize: 14,
    color: '#888',
  },
  settlementToName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  settlementRight: {
    alignItems: 'flex-end',
  },
  settlementAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#28A745',
  },
  settlementDate: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  noSettlements: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  noSettlementsText: {
    fontSize: 16,
    color: '#888',
  },
});
