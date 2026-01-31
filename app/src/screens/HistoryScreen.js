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
import WebPullToRefresh from '../components/WebPullToRefresh';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const isAndroid = Platform.OS === 'android';

export default function HistoryScreen({ route }) {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  
  // Detect mobile web
  const isMobileWeb = Platform.OS === 'web' && screenWidth < 768;
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);
  
  // Payment History Modal
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const paymentSlideAnim = useState(new Animated.Value(SCREEN_HEIGHT))[0];
  
  // Edit History Modal
  const [editHistory, setEditHistory] = useState([]);
  const [loadingEditHistory, setLoadingEditHistory] = useState(false);
  const [editHistoryModalVisible, setEditHistoryModalVisible] = useState(false);
  const editSlideAnim = useState(new Animated.Value(SCREEN_HEIGHT))[0];
  
  // Dropdown menu state
  const [menuVisible, setMenuVisible] = useState(null); // groupId of open menu

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

  const fetchEditHistory = async (groupId) => {
    setLoadingEditHistory(true);
    try {
      const response = await authGet(`/groups/${groupId}/edit-history`);
      const data = await response.json();
      if (data.success) {
        setEditHistory(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching edit history:', error);
    } finally {
      setLoadingEditHistory(false);
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
      if (paymentModalVisible) {
        closePaymentModal();
        return true;
      }
      if (editHistoryModalVisible) {
        closeEditHistoryModal();
        return true;
      }
      if (menuVisible) {
        setMenuVisible(null);
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
  }, [navigation, paymentModalVisible, editHistoryModalVisible, menuVisible]);

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

  // Navigate to group screen
  const handleGroupPress = (record) => {
    setMenuVisible(null);
    navigation.navigate('Groups', { 
      selectedGroupId: record.groupId,
      groupName: record.groupName,
      fromScreen: 'History'
    });
  };

  // Open Payment History Modal
  const openPaymentModal = (record) => {
    setMenuVisible(null);
    setSelectedRecord(record);
    setPaymentModalVisible(true);
    Animated.spring(paymentSlideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const closePaymentModal = () => {
    Animated.timing(paymentSlideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setPaymentModalVisible(false);
      setSelectedRecord(null);
    });
  };

  // Open Edit History Modal
  const openEditHistoryModal = async (record) => {
    setMenuVisible(null);
    setSelectedRecord(record);
    await fetchEditHistory(record.groupId);
    setEditHistoryModalVisible(true);
    Animated.spring(editSlideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const closeEditHistoryModal = () => {
    Animated.timing(editSlideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setEditHistoryModalVisible(false);
      setSelectedRecord(null);
      setEditHistory([]);
    });
  };

  // Get action icon and color for edit history
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

  const getActionLabel = (action) => {
    switch (action) {
      case 'add_expense': return 'Added Expense';
      case 'edit_expense': return 'Edited Expense';
      case 'delete_expense': return 'Deleted Expense';
      case 'delete_group': return 'Deleted Group';
      default: return 'Action';
    }
  };

  // Render content area (card with history list) - reusable for both platforms
  const renderContent = (contentStyle, cardStyle) => {
    const content = (
      <>
        {/* Card Header with Refresh - Always visible */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Groups History</Text>
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
              Your groups and their history will appear here
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
            {isMobileWeb ? (
              <WebPullToRefresh
                onRefresh={handleRefresh}
                refreshing={refreshing}
                style={styles.groupsList}
                contentContainerStyle={styles.groupsListContent}
                scrollViewProps={{
                  showsVerticalScrollIndicator: true,
                }}
              >
                {historyRecords.map((record) => {
                  const isDeleted = record.groupStatus === 'deleted';
                  const ItemWrapper = isDeleted ? View : TouchableOpacity;
                  const itemWrapperProps = isDeleted 
                    ? { style: styles.historyItemLeft }
                    : { 
                        style: styles.historyItemLeft,
                        onPress: () => handleGroupPress(record),
                        activeOpacity: 0.7
                      };
                  
                  return (
                  <View key={record.id} style={[styles.historyItem, menuVisible === record.id && styles.historyItemActive]}>
                    <ItemWrapper {...itemWrapperProps}>
                      <View style={[styles.groupIcon, isDeleted && styles.groupIconDeleted]}>
                        <Text style={styles.groupIconText}>
                          {record.groupName.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.groupInfo}>
                        <View style={styles.groupNameRow}>
                          <Text style={[styles.groupName, isDeleted && styles.groupNameDeleted]} numberOfLines={1}>{record.groupName}</Text>
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
                        {(record.groupStatus === 'completed' || record.groupStatus === 'deleted') && record.updatedAt && (
                          <Text style={styles.groupTimestamp}>
                            {record.groupStatus === 'completed' ? 'Completed' : 'Deleted'}: {formatDate(record.updatedAt)}
                          </Text>
                        )}
                      </View>
                    </ItemWrapper>
                    
                    {/* Three-dot menu */}
                    <TouchableOpacity 
                      style={styles.menuButton}
                      onPress={() => setMenuVisible(menuVisible === record.id ? null : record.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="ellipsis-vertical" size={20} color="#888" />
                    </TouchableOpacity>
                  </View>
                  );
                })}
              </WebPullToRefresh>
            ) : (
              <ScrollView 
                style={styles.groupsList}
                contentContainerStyle={styles.groupsListContent}
                showsVerticalScrollIndicator={true}
              >
                {historyRecords.map((record) => {
                  const isDeleted = record.groupStatus === 'deleted';
                  const ItemWrapper = isDeleted ? View : TouchableOpacity;
                  const itemWrapperProps = isDeleted 
                    ? { style: styles.historyItemLeft }
                    : { 
                        style: styles.historyItemLeft,
                        onPress: () => handleGroupPress(record),
                        activeOpacity: 0.7
                      };
                  
                  return (
                  <View key={record.id} style={[styles.historyItem, menuVisible === record.id && styles.historyItemActive]}>
                    <ItemWrapper {...itemWrapperProps}>
                      <View style={[styles.groupIcon, isDeleted && styles.groupIconDeleted]}>
                        <Text style={styles.groupIconText}>
                          {record.groupName.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.groupInfo}>
                        <View style={styles.groupNameRow}>
                          <Text style={[styles.groupName, isDeleted && styles.groupNameDeleted]} numberOfLines={1}>{record.groupName}</Text>
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
                        {(record.groupStatus === 'completed' || record.groupStatus === 'deleted') && record.updatedAt && (
                          <Text style={styles.groupTimestamp}>
                            {record.groupStatus === 'completed' ? 'Completed' : 'Deleted'}: {formatDate(record.updatedAt)}
                          </Text>
                        )}
                      </View>
                    </ItemWrapper>
                    
                    {/* Three-dot menu */}
                    <TouchableOpacity 
                      style={styles.menuButton}
                      onPress={() => setMenuVisible(menuVisible === record.id ? null : record.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="ellipsis-vertical" size={20} color="#888" />
                    </TouchableOpacity>
                  </View>
                  );
                })}
              </ScrollView>
            )}
          </>
        )}
      </>
    );

    return (
      <View style={contentStyle}>
        {cardStyle ? (
          <View style={cardStyle}>
            {content}
          </View>
        ) : (
          content
        )}
      </View>
    );
  };
        {/* Card Header with Refresh - Always visible */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Groups History</Text>
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
              Your groups and their history will appear here
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
            {isMobileWeb ? (
              <WebPullToRefresh
                onRefresh={handleRefresh}
                refreshing={refreshing}
                style={styles.groupsList}
                contentContainerStyle={styles.groupsListContent}
                scrollViewProps={{
                  showsVerticalScrollIndicator: true,
                }}
              >
                {historyRecords.map((record) => {
                  const isDeleted = record.groupStatus === 'deleted';
                  const ItemWrapper = isDeleted ? View : TouchableOpacity;
                  const itemWrapperProps = isDeleted 
                    ? { style: styles.historyItemLeft }
                    : { 
                        style: styles.historyItemLeft,
                        onPress: () => handleGroupPress(record),
                        activeOpacity: 0.7
                      };
                  
                  return (
                  <View key={record.id} style={[styles.historyItem, menuVisible === record.id && styles.historyItemActive]}>
                    <ItemWrapper {...itemWrapperProps}>
                      <View style={[styles.groupIcon, isDeleted && styles.groupIconDeleted]}>
                        <Text style={styles.groupIconText}>
                          {record.groupName.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.groupInfo}>
                        <View style={styles.groupNameRow}>
                          <Text style={[styles.groupName, isDeleted && styles.groupNameDeleted]} numberOfLines={1}>{record.groupName}</Text>
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
                        {(record.groupStatus === 'completed' || record.groupStatus === 'deleted') && record.updatedAt && (
                          <Text style={styles.groupTimestamp}>
                            {record.groupStatus === 'completed' ? 'Completed' : 'Deleted'}: {formatDate(record.updatedAt)}
                          </Text>
                        )}
                      </View>
                    </ItemWrapper>
                    
                    {/* Three-dot menu */}
                    <TouchableOpacity 
                      style={styles.menuButton}
                      onPress={() => setMenuVisible(menuVisible === record.id ? null : record.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="ellipsis-vertical" size={20} color="#888" />
                    </TouchableOpacity>
                  </View>
                  );
                })}
              </WebPullToRefresh>
            ) : (
              <ScrollView 
                style={styles.groupsList}
                contentContainerStyle={styles.groupsListContent}
                showsVerticalScrollIndicator={true}
              >
                {historyRecords.map((record) => {
                  const isDeleted = record.groupStatus === 'deleted';
                  const ItemWrapper = isDeleted ? View : TouchableOpacity;
                  const itemWrapperProps = isDeleted 
                    ? { style: styles.historyItemLeft }
                    : { 
                        style: styles.historyItemLeft,
                        onPress: () => handleGroupPress(record),
                        activeOpacity: 0.7
                      };
                  
                  return (
                  <View key={record.id} style={[styles.historyItem, menuVisible === record.id && styles.historyItemActive]}>
                    <ItemWrapper {...itemWrapperProps}>
                      <View style={[styles.groupIcon, isDeleted && styles.groupIconDeleted]}>
                        <Text style={styles.groupIconText}>
                          {record.groupName.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.groupInfo}>
                        <View style={styles.groupNameRow}>
                          <Text style={[styles.groupName, isDeleted && styles.groupNameDeleted]} numberOfLines={1}>{record.groupName}</Text>
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
                        {(record.groupStatus === 'completed' || record.groupStatus === 'deleted') && record.updatedAt && (
                          <Text style={styles.groupTimestamp}>
                            {record.groupStatus === 'completed' ? 'Completed' : 'Deleted'}: {formatDate(record.updatedAt)}
                          </Text>
                        )}
                      </View>
                    </ItemWrapper>
                    
                    {/* Three-dot menu */}
                    <TouchableOpacity 
                      style={styles.menuButton}
                      onPress={() => setMenuVisible(menuVisible === record.id ? null : record.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="ellipsis-vertical" size={20} color="#888" />
                    </TouchableOpacity>
                  </View>
                  );
                })}
              </ScrollView>
            )}
          </>
        )}
      </View>
    </View>
  );

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
            <TouchableOpacity onPress={handleBack} style={androidStyles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#E85A24" />
            </TouchableOpacity>
            <Text style={androidStyles.headerTitle}>History</Text>
            <View style={androidStyles.headerRight} />
          </View>

          {/* Decorative Icon */}
          <View style={androidStyles.decorativeIconContainer}>
            <View style={androidStyles.decorativeIconCircle}>
              <Ionicons name="document-text-outline" size={40} color="#E85A24" />
            </View>
          </View>

          {/* White Content Area with Curved Top */}
          <View style={androidStyles.whiteContentArea}>
            {renderContent(androidStyles.content, null)}
          </View>
        </LinearGradient>

        {/* Dropdown Menu Modal */}
        <Modal
          visible={menuVisible !== null}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setMenuVisible(null)}
        >
          <Pressable 
            style={styles.menuOverlay} 
            onPress={() => setMenuVisible(null)} 
          >
            <View style={styles.dropdownMenuContainer}>
              <View style={styles.dropdownMenu}>
                {/* Group Name Header with Close Button */}
                {menuVisible && (
                  <View style={styles.dropdownHeader}>
                    <Text style={styles.dropdownHeaderText} numberOfLines={1}>
                      {historyRecords.find(r => r.id === menuVisible)?.groupName || 'Group'}
                    </Text>
                    <TouchableOpacity 
                      style={styles.dropdownCloseButton}
                      onPress={() => setMenuVisible(null)}
                    >
                      <Ionicons name="close" size={20} color="#888" />
                    </TouchableOpacity>
                  </View>
                )}
                <TouchableOpacity 
                  style={styles.dropdownItem}
                  onPress={() => {
                    const record = historyRecords.find(r => r.id === menuVisible);
                    if (record) openPaymentModal(record);
                  }}
                >
                  <View style={[styles.dropdownItemIcon, { backgroundColor: '#E8F5E9' }]}>
                    <Ionicons name="wallet-outline" size={18} color="#28A745" />
                  </View>
                  <Text style={styles.dropdownItemText}>View Payment History</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.dropdownItem}
                  onPress={() => {
                    const record = historyRecords.find(r => r.id === menuVisible);
                    if (record) openEditHistoryModal(record);
                  }}
                >
                  <View style={[styles.dropdownItemIcon, { backgroundColor: '#FFF5F0' }]}>
                    <Ionicons name="time-outline" size={18} color="#FF6B35" />
                  </View>
                  <Text style={styles.dropdownItemText}>View Edit History</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Modal>

        {/* Payment History Modal */}
        <Modal
          visible={paymentModalVisible}
          transparent={true}
          animationType="none"
          onRequestClose={closePaymentModal}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={closePaymentModal} />
            <Animated.View 
              style={[
                styles.modalContent,
                { transform: [{ translateY: paymentSlideAnim }] }
              ]}
            >
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>
                  Payment History
                </Text>
                <Text style={styles.modalSubtitle}>
                  {selectedRecord?.groupName}
                </Text>
                <TouchableOpacity onPress={closePaymentModal} style={styles.modalCloseButton}>
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
                    <Text style={styles.noSettlementsIcon}>💰</Text>
                    <Text style={styles.noSettlementsText}>No payments yet</Text>
                    <Text style={styles.noSettlementsSubtext}>Completed payments will appear here</Text>
                  </View>
                )}
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>

        {/* Edit History Modal */}
        <Modal
          visible={editHistoryModalVisible}
          transparent={true}
          animationType="none"
          onRequestClose={closeEditHistoryModal}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={closeEditHistoryModal} />
            <Animated.View 
              style={[
                styles.modalContent,
                { transform: [{ translateY: editSlideAnim }] }
              ]}
            >
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>
                  Edit History
                </Text>
                <Text style={styles.modalSubtitle}>
                  {selectedRecord?.groupName}
                </Text>
                <TouchableOpacity onPress={closeEditHistoryModal} style={styles.modalCloseButton}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Edit History List */}
              <ScrollView 
                style={styles.modalScrollView}
                showsVerticalScrollIndicator={true}
              >
                {loadingEditHistory ? (
                  <View style={styles.loadingHistoryState}>
                    <ActivityIndicator size="large" color="#FF6B35" />
                    <Text style={styles.loadingText}>Loading history...</Text>
                  </View>
                ) : editHistory.length > 0 ? (
                  editHistory.map((item, index) => {
                    const actionStyle = getActionStyle(item.action);
                    return (
                      <View key={item._id || index} style={styles.editHistoryItem}>
                        <View style={[styles.editHistoryIcon, { backgroundColor: actionStyle.bgColor }]}>
                          <Ionicons name={actionStyle.icon} size={18} color={actionStyle.color} />
                        </View>
                        <View style={styles.editHistoryContent}>
                          <View style={styles.editHistoryHeader}>
                            <Text style={[styles.editHistoryAction, { color: actionStyle.color }]}>
                              {getActionLabel(item.action)}
                            </Text>
                            <Text style={styles.editHistoryTime}>
                              {formatDate(item.createdAt)}
                            </Text>
                          </View>
                          <Text style={styles.editHistoryDescription} numberOfLines={2}>
                            {item.details?.changes || item.details?.expenseName || 'No details'}
                          </Text>
                          <Text style={styles.editHistoryUser}>
                            by {item.actionByName || item.actionBy?.split('@')[0] || 'Unknown'}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.noSettlements}>
                    <Text style={styles.noSettlementsIcon}>📋</Text>
                    <Text style={styles.noSettlementsText}>No edit history</Text>
                    <Text style={styles.noSettlementsSubtext}>Actions will be recorded here</Text>
                  </View>
                )}
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>
      </View>
    );
  }

  // Web/iOS layout - original unchanged
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
        {renderContent(styles.content, styles.card)}
      </LinearGradient>

      {/* Dropdown Menu Modal */}
      <Modal
        visible={menuVisible !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(null)}
      >
        <Pressable 
          style={styles.menuOverlay} 
          onPress={() => setMenuVisible(null)} 
        >
          <View style={styles.dropdownMenuContainer}>
            <View style={styles.dropdownMenu}>
              {/* Group Name Header with Close Button */}
              {menuVisible && (
                <View style={styles.dropdownHeader}>
                  <Text style={styles.dropdownHeaderText} numberOfLines={1}>
                    {historyRecords.find(r => r.id === menuVisible)?.groupName || 'Group'}
                  </Text>
                  <TouchableOpacity 
                    style={styles.dropdownCloseButton}
                    onPress={() => setMenuVisible(null)}
                  >
                    <Ionicons name="close" size={20} color="#888" />
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity 
                style={styles.dropdownItem}
                onPress={() => {
                  const record = historyRecords.find(r => r.id === menuVisible);
                  if (record) openPaymentModal(record);
                }}
              >
                <View style={[styles.dropdownItemIcon, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="wallet-outline" size={18} color="#28A745" />
                </View>
                <Text style={styles.dropdownItemText}>View Payment History</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.dropdownItem}
                onPress={() => {
                  const record = historyRecords.find(r => r.id === menuVisible);
                  if (record) openEditHistoryModal(record);
                }}
              >
                <View style={[styles.dropdownItemIcon, { backgroundColor: '#FFF5F0' }]}>
                  <Ionicons name="time-outline" size={18} color="#FF6B35" />
                </View>
                <Text style={styles.dropdownItemText}>View Edit History</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Payment History Modal */}
      <Modal
        visible={paymentModalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={closePaymentModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closePaymentModal} />
          <Animated.View 
            style={[
              styles.modalContent,
              { transform: [{ translateY: paymentSlideAnim }] }
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>
                Payment History
              </Text>
              <Text style={styles.modalSubtitle}>
                {selectedRecord?.groupName}
              </Text>
              <TouchableOpacity onPress={closePaymentModal} style={styles.modalCloseButton}>
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
                  <Text style={styles.noSettlementsIcon}>💰</Text>
                  <Text style={styles.noSettlementsText}>No payments yet</Text>
                  <Text style={styles.noSettlementsSubtext}>Completed payments will appear here</Text>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* Edit History Modal */}
      <Modal
        visible={editHistoryModalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={closeEditHistoryModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeEditHistoryModal} />
          <Animated.View 
            style={[
              styles.modalContent,
              { transform: [{ translateY: editSlideAnim }] }
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>
                Edit History
              </Text>
              <Text style={styles.modalSubtitle}>
                {selectedRecord?.groupName}
              </Text>
              <TouchableOpacity onPress={closeEditHistoryModal} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Edit History List */}
            <ScrollView 
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={true}
            >
              {loadingEditHistory ? (
                <View style={styles.loadingHistoryState}>
                  <ActivityIndicator size="large" color="#FF6B35" />
                  <Text style={styles.loadingText}>Loading history...</Text>
                </View>
              ) : editHistory.length > 0 ? (
                editHistory.map((item, index) => {
                  const actionStyle = getActionStyle(item.action);
                  return (
                    <View key={item._id || index} style={styles.editHistoryItem}>
                      <View style={[styles.editHistoryIcon, { backgroundColor: actionStyle.bgColor }]}>
                        <Ionicons name={actionStyle.icon} size={18} color={actionStyle.color} />
                      </View>
                      <View style={styles.editHistoryContent}>
                        <View style={styles.editHistoryHeader}>
                          <Text style={[styles.editHistoryAction, { color: actionStyle.color }]}>
                            {getActionLabel(item.action)}
                          </Text>
                          <Text style={styles.editHistoryTime}>
                            {formatDate(item.createdAt)}
                          </Text>
                        </View>
                        <Text style={styles.editHistoryDescription} numberOfLines={2}>
                          {item.details?.changes || item.details?.expenseName || 'No details'}
                        </Text>
                        <Text style={styles.editHistoryUser}>
                          by {item.actionByName || item.actionBy?.split('@')[0] || 'Unknown'}
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.noSettlements}>
                  <Text style={styles.noSettlementsIcon}>📋</Text>
                  <Text style={styles.noSettlementsText}>No edit history</Text>
                  <Text style={styles.noSettlementsSubtext}>Actions will be recorded here</Text>
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
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
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
    minWidth: 0,
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
  groupNameDeleted: {
    color: '#888',
  },
  groupIconDeleted: {
    backgroundColor: '#999',
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
  groupTimestamp: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
    fontStyle: 'italic',
  },
  
  // Menu styles
  historyItemActive: {
    backgroundColor: '#F8F8F8',
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenuContainer: {
    width: '80%',
    maxWidth: 300,
  },
  dropdownMenu: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 8,
  },
  dropdownHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    flex: 1,
    paddingHorizontal: 32,
  },
  dropdownCloseButton: {
    position: 'absolute',
    right: 12,
    top: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  dropdownItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginLeft: 12,
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#DDD',
    borderRadius: 2,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
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
  noSettlementsIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  noSettlementsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  noSettlementsSubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  
  // Edit History Modal styles
  loadingHistoryState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  editHistoryItem: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  editHistoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  editHistoryContent: {
    flex: 1,
    minWidth: 0,
  },
  editHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  editHistoryAction: {
    fontSize: 14,
    fontWeight: '700',
  },
  editHistoryTime: {
    fontSize: 11,
    color: '#888',
  },
  editHistoryDescription: {
    fontSize: 13,
    color: '#333',
    marginBottom: 4,
    lineHeight: 18,
  },
  editHistoryUser: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
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
  },
  headerRight: {
    width: 44,
  },
  decorativeIconContainer: {
    alignItems: 'center',
    marginTop: -10,
    marginBottom: 10,
  },
  decorativeIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  whiteContentArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 0,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    minHeight: 300,
  },
});
