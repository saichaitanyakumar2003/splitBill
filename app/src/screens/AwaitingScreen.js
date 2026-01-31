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
  RefreshControl,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { authGet, authPost } from '../utils/apiHelper';
import { useAuth } from '../context/AuthContext';
import WebPullToRefresh from '../components/WebPullToRefresh';

// Check if mobile web
const isMobileWeb = () => Platform.OS === 'web' && Dimensions.get('window').width < 768;

// Collapsible Group Component
function CollapsibleGroup({ group, onNotify, notifyingUser }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const groupTotal = (group.awaitingEdges || []).reduce((sum, edge) => sum + (edge.amount || 0), 0);
  
  return (
    <View style={styles.groupSection}>
      {/* Group Header - Clickable to expand/collapse */}
      <TouchableOpacity 
        style={styles.groupHeader}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}
      >
        <View style={styles.groupIcon}>
          <Text style={styles.groupIconText}>
            {group.groupName.substring(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={styles.groupInfo}>
          <Text style={styles.groupName} numberOfLines={1}>{group.groupName}</Text>
          <Text style={styles.groupStatus}>
            {group.awaitingEdges?.length || 0} awaiting • ₹{groupTotal.toFixed(2)}
          </Text>
        </View>
        <View style={styles.expandButton}>
          <Ionicons 
            name={isExpanded ? "chevron-up" : "chevron-down"} 
            size={20} 
            color="#888" 
          />
        </View>
      </TouchableOpacity>

      {/* Awaiting Edges - Only shown when expanded */}
      {isExpanded && (
        <View style={styles.expandedContent}>
          {group.awaitingEdges?.map((edge, index) => {
            const isNotifying = notifyingUser === `${group.groupId}-${edge.from}`;
            return (
              <View key={`awaiting-${index}`} style={styles.expenseRow}>
                <View style={styles.expenseLeft}>
                  <View style={styles.avatarFrom}>
                    <Text style={styles.avatarText}>
                      {(edge.fromName || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.expenseInfo}>
                    <Text style={styles.expenseText} numberOfLines={1}>
                      <Text style={styles.expenseName}>{edge.fromName}</Text>
                    </Text>
                    <Text style={styles.expenseAmount}>₹{edge.amount.toFixed(2)}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.notifyButton, isNotifying && styles.notifyButtonDisabled]}
                  onPress={() => onNotify(group.groupId, group.groupName, edge.from, edge.fromName, edge.amount)}
                  disabled={isNotifying}
                  activeOpacity={0.7}
                >
                  {isNotifying ? (
                    <ActivityIndicator size="small" color="#FF6B35" />
                  ) : (
                    <>
                      <Ionicons name="notifications-outline" size={14} color="#FF6B35" />
                      <Text style={styles.notifyButtonText}>Remind</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function AwaitingScreen({ route }) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [awaitingPayments, setAwaitingPayments] = useState([]);
  const [notifyingUser, setNotifyingUser] = useState(null);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  
  // Detect mobile web
  const isMobileWeb = Platform.OS === 'web' && screenWidth < 768;
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  const fetchAwaitingPayments = async () => {
    try {
      const response = await authGet('/groups/awaiting');
      const data = await response.json();
      if (data.success) {
        setAwaitingPayments(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching awaiting payments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAwaitingPayments();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAwaitingPayments();
    setRefreshing(false);
  };

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

  const handleNotify = async (groupId, groupName, debtorEmail, debtorName, amount) => {
    setNotifyingUser(`${groupId}-${debtorEmail}`);
    try {
      const response = await authPost('/groups/send-reminder', {
        debtorEmail,
        amount,
        groupName,
      });
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to send reminder');
      }
      // Silently succeed - the loading indicator provides feedback
    } catch (error) {
      console.error('Error sending reminder:', error);
      // Silently fail - just log the error
    } finally {
      setNotifyingUser(null);
    }
  };

  const totalAwaiting = awaitingPayments.reduce(
    (sum, group) => sum + (group.awaitingEdges?.length || 0),
    0
  );

  const totalAmount = awaitingPayments.reduce(
    (sum, group) => sum + (group.awaitingEdges || []).reduce((s, e) => s + (e.amount || 0), 0),
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
          <Text style={styles.headerTitle}>Awaiting Payments</Text>
          <View style={styles.headerRight} />
        </View>

        {/* White Background Card */}
        <View style={styles.content}>
          <View style={styles.card}>
            {/* Card Header with Refresh - Always visible */}
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Awaiting Payments</Text>
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
                <Text style={styles.loadingText}>Loading awaiting payments...</Text>
              </View>
            ) : awaitingPayments.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>💰</Text>
                <Text style={styles.emptyTitle}>No Pending Receivables</Text>
                <Text style={styles.emptySubtext}>
                  No one owes you money right now. All payments have been settled.
                </Text>
              </View>
            ) : (
              <View style={styles.cardContent}>
                {/* Summary Header */}
                <View style={styles.summaryHeader}>
                  <View style={styles.summaryLeft}>
                    <Text style={styles.summaryTitle}>You'll Receive</Text>
                    <Text style={styles.summaryAmount}>₹{totalAmount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryBadge}>
                    <Text style={styles.summaryBadgeText}>
                      {totalAwaiting} payment{totalAwaiting !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                {/* Scrollable Awaiting List */}
                {isMobileWeb ? (
                  <WebPullToRefresh
                    onRefresh={handleRefresh}
                    refreshing={refreshing}
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollViewContent}
                    scrollViewProps={{
                      showsVerticalScrollIndicator: true,
                      bounces: true,
                      nestedScrollEnabled: true,
                      keyboardShouldPersistTaps: "handled",
                    }}
                  >
                    {awaitingPayments.map((group) => (
                      <CollapsibleGroup
                        key={group.groupId}
                        group={group}
                        onNotify={handleNotify}
                        notifyingUser={notifyingUser}
                      />
                    ))}
                  </WebPullToRefresh>
                ) : (
                  <ScrollView 
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollViewContent}
                    showsVerticalScrollIndicator={true}
                    bounces={true}
                    nestedScrollEnabled={true}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={
                      <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor="#FF6B35"
                        colors={['#FF6B35']}
                      />
                    }
                  >
                    {awaitingPayments.map((group) => (
                      <CollapsibleGroup
                        key={group.groupId}
                        group={group}
                        onNotify={handleNotify}
                        notifyingUser={notifyingUser}
                      />
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
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
  cardContent: {
    flex: 1,
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
  },
  summaryLeft: {
    flex: 1,
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
  summaryTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888',
  },
  summaryAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#28A745',
    marginTop: 2,
  },
  summaryBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  summaryBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#28A745',
  },
  scrollView: {
    flex: 1,
    marginTop: 8,
  },
  scrollViewContent: {
    paddingBottom: 20,
  },
  groupSection: {
    marginTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 4,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
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
  expandButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedContent: {
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarFrom: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
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
    color: '#333',
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#28A745',
    marginTop: 2,
  },
  notifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#FF6B35',
    gap: 4,
    minWidth: 85,
    justifyContent: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  notifyButtonDisabled: {
    opacity: 0.7,
  },
  notifyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B35',
  },
});
