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
  BackHandler,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { authGet } from '../utils/apiHelper';

export default function HistoryScreen({ route }) {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completedGroups, setCompletedGroups] = useState([]);

  const fetchHistory = async () => {
    try {
      const response = await authGet('/groups/history');
      const data = await response.json();
      if (data.success) {
        setCompletedGroups(data.data || []);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  }, []);

  const handleBack = useCallback(() => {
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
  }, [navigation, route?.params?.fromSidePanel]);

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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Calculate total amount from expenses
  const getTotalAmount = (expenses) => {
    if (!expenses || !Array.isArray(expenses)) return 0;
    return expenses.reduce((sum, exp) => sum + (exp.totalAmount || exp.amount || 0), 0);
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

        {/* Content - Fixed card with scrollable content inside */}
        <View style={styles.content}>
          {loading ? (
            <View style={styles.card}>
              <View style={styles.loadingState}>
                <ActivityIndicator size="large" color="#FF6B35" />
                <Text style={styles.loadingText}>Loading history...</Text>
              </View>
            </View>
          ) : completedGroups.length === 0 ? (
            <View style={styles.card}>
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📜</Text>
                <Text style={styles.emptyTitle}>No History Yet</Text>
                <Text style={styles.emptySubtext}>
                  Completed groups will appear here once all payments are settled
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              {/* Summary Header */}
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryTitle}>Completed Groups</Text>
                <Text style={styles.summaryCount}>{completedGroups.length}</Text>
              </View>

              {/* Scrollable Groups List */}
              <ScrollView 
                style={styles.groupsList}
                contentContainerStyle={styles.groupsListContent}
                showsVerticalScrollIndicator={true}
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
                {completedGroups.map((group) => (
                  <View key={group.id} style={styles.groupCard}>
                    <View style={styles.groupHeader}>
                      <View style={styles.groupIcon}>
                        <Text style={styles.groupIconText}>
                          {group.name.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.groupInfo}>
                        <Text style={styles.groupName}>{group.name}</Text>
                        <Text style={styles.groupDate}>
                          Completed {formatDate(group.updatedAt)}
                        </Text>
                      </View>
                      <View style={styles.completedBadge}>
                        <Text style={styles.completedBadgeText}>✓</Text>
                      </View>
                    </View>

                    {/* Group Stats */}
                    <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Total</Text>
                        <Text style={styles.statValue}>
                          ₹{getTotalAmount(group.expenses).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Expenses</Text>
                        <Text style={styles.statValue}>
                          {group.expenses?.length || 0}
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Settlements</Text>
                        <Text style={styles.statValue}>
                          {group.consolidatedExpenses?.length || 0}
                        </Text>
                      </View>
                    </View>

                    {/* Settlement Summary - Show all settlements */}
                    {group.consolidatedExpenses && group.consolidatedExpenses.length > 0 && (
                      <View style={styles.settlementsSection}>
                        <Text style={styles.settlementsTitle}>Settlements</Text>
                        {group.consolidatedExpenses.map((edge, index) => (
                          <View key={index} style={styles.settlementRow}>
                            <View style={styles.settlementNamesContainer}>
                              <Text style={styles.settlementName}>{edge.fromName || edge.from?.split('@')[0]}</Text>
                              <Text style={styles.settlementArrow}> → </Text>
                              <Text style={styles.settlementName}>{edge.toName || edge.to?.split('@')[0]}</Text>
                            </View>
                            <Text style={styles.settlementAmount}>₹{edge.amount?.toFixed(2)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
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
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
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
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  summaryCount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#28A745',
  },
  groupsList: {
    flex: 1,
  },
  groupsListContent: {
    paddingBottom: 10,
  },
  groupCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#6C757D',
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
  groupDate: {
    fontSize: 13,
    color: '#888',
  },
  completedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#28A745',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedBadgeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#888',
    marginBottom: 4,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  settlementsSection: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  settlementsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  settlementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
    flexWrap: 'wrap',
  },
  settlementNamesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
    marginRight: 12,
  },
  settlementArrow: {
    fontSize: 13,
    color: '#666',
  },
  settlementName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  settlementAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#28A745',
    flexShrink: 0,
  },
  moreSettlementsRow: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  moreSettlements: {
    fontSize: 13,
    color: '#28A745',
    fontWeight: '600',
  },
});
