import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import WebPullToRefresh from '../components/WebPullToRefresh';

const AVATAR_COLORS = [
  '#FF6B35', '#4FFFB0', '#FFD93D', '#6B5BFF', '#FF8C42', '#00D9FF',
];

// Demo members for assignment
const DEMO_MEMBERS = [
  { id: 'p1', name: 'You' },
  { id: 'p2', name: 'Alex' },
  { id: 'p3', name: 'Jordan' },
  { id: 'p4', name: 'Sam' },
];

export default function BillDetailScreen({ route, navigation }) {
  const { bill: initialBill } = route.params;
  const [bill, setBill] = useState(initialBill);
  const [selectedItems, setSelectedItems] = useState({});
  const [members] = useState(DEMO_MEMBERS);

  // Pull to refresh state for mobile web
  const [refreshing, setRefreshing] = useState(false);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);

  // Detect mobile web
  const isMobileWeb = Platform.OS === 'web' && screenWidth < 768;

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (bill?.items) {
      const initial = {};
      bill.items.forEach(item => {
        initial[item.id] = item.assignedTo || [];
      });
      setSelectedItems(initial);
    }
  }, []);

  const togglePersonForItem = (itemId, personId) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setSelectedItems(prev => {
      const currentAssignees = prev[itemId] || [];
      const isAssigned = currentAssignees.includes(personId);
      
      return {
        ...prev,
        [itemId]: isAssigned
          ? currentAssignees.filter(id => id !== personId)
          : [...currentAssignees, personId],
      };
    });
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isItemAssigned = (itemId) => {
    return (selectedItems[itemId] || []).length > 0;
  };

  const getAssignedCount = () => {
    return bill?.items?.filter(item => isItemAssigned(item.id)).length || 0;
  };

  const handleSplit = () => {
    const unassignedItems = bill?.items?.filter(item => !isItemAssigned(item.id)) || [];
    
    if (unassignedItems.length > 0) {
      Alert.alert(
        'Unassigned Items',
        `${unassignedItems.length} item(s) haven't been assigned. Split them equally?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Split Equally', 
            onPress: () => {
              const updated = { ...selectedItems };
              unassignedItems.forEach(item => {
                updated[item.id] = members.map(m => m.id);
              });
              setSelectedItems(updated);
              proceedToSplit(updated);
            }
          },
        ]
      );
      return;
    }
    
    proceedToSplit(selectedItems);
  };

  const proceedToSplit = (assignments) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    navigation.navigate('Split', {
      bill: {
        ...bill,
        items: bill.items.map(item => ({
          ...item,
          assignedTo: assignments[item.id] || [],
        })),
      },
      members,
    });
  };

  if (!bill) {
    return (
      <LinearGradient
        colors={[theme.colors.backgroundGradientStart, theme.colors.backgroundGradientEnd]}
        style={styles.container}
      >
        <Text style={styles.errorText}>Bill not found</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[theme.colors.backgroundGradientStart, theme.colors.backgroundGradientEnd]}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assign Items</Text>
        <View style={styles.backButton} />
      </View>

      {isMobileWeb ? (
        <WebPullToRefresh
          onRefresh={handleRefresh}
          refreshing={refreshing}
          contentContainerStyle={styles.scrollContent}
          scrollViewProps={{
            style: styles.scrollView,
            showsVerticalScrollIndicator: false,
          }}
        >
          {/* Bill Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.billName}>{bill.name}</Text>
            <Text style={styles.billTotal}>${bill.total?.toFixed(2)}</Text>
            <Text style={styles.summaryLabel}>
              {bill.items?.length || 0} items • {getAssignedCount()} assigned
            </Text>
          </View>

          {/* Members Legend */}
          <View style={styles.membersLegend}>
            <Text style={styles.legendTitle}>Tap to assign people</Text>
            <View style={styles.membersRow}>
              {members.map((member, idx) => (
                <View key={member.id} style={styles.memberChip}>
                  <View
                    style={[styles.memberDot, { backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }]}
                  />
                  <Text style={styles.memberChipText}>{member.name}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Items List */}
          <View style={styles.itemsSection}>
            {bill.items?.map((item, index) => (
              <View key={item.id || index} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemPrice}>
                      ${item.totalPrice?.toFixed(2) || item.price?.toFixed(2)}
                    </Text>
                  </View>
                  {isItemAssigned(item.id) && (
                    <View style={styles.checkBadge}>
                      <Ionicons name="checkmark" size={14} color={theme.colors.cardBg} />
                    </View>
                  )}
                </View>
                
                <View style={styles.assignRow}>
                  {members.map((member, idx) => {
                    const isSelected = (selectedItems[item.id] || []).includes(member.id);
                    return (
                      <TouchableOpacity
                        key={member.id}
                        style={[
                          styles.assignAvatar,
                          isSelected && { 
                            backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
                            borderColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
                          },
                        ]}
                        onPress={() => togglePersonForItem(item.id, member.id)}
                      >
                        <Text style={[
                          styles.assignAvatarText,
                          isSelected && styles.assignAvatarTextSelected,
                        ]}>
                          {getInitials(member.name)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={styles.totalsCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>${bill.subtotal?.toFixed(2) || '0.00'}</Text>
            </View>
            {bill.tax > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax</Text>
                <Text style={styles.totalValue}>${bill.tax?.toFixed(2)}</Text>
              </View>
            )}
            {bill.tip > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tip</Text>
                <Text style={styles.totalValue}>${bill.tip?.toFixed(2)}</Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>${bill.total?.toFixed(2) || '0.00'}</Text>
            </View>
          </View>
        </WebPullToRefresh>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Bill Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.billName}>{bill.name}</Text>
            <Text style={styles.billTotal}>${bill.total?.toFixed(2)}</Text>
            <Text style={styles.summaryLabel}>
              {bill.items?.length || 0} items • {getAssignedCount()} assigned
            </Text>
          </View>

          {/* Members Legend */}
          <View style={styles.membersLegend}>
            <Text style={styles.legendTitle}>Tap to assign people</Text>
            <View style={styles.membersRow}>
              {members.map((member, idx) => (
                <View key={member.id} style={styles.memberChip}>
                  <View
                    style={[styles.memberDot, { backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }]}
                  />
                  <Text style={styles.memberChipText}>{member.name}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Items List */}
          <View style={styles.itemsSection}>
            {bill.items?.map((item, index) => (
              <View key={item.id || index} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemPrice}>
                      ${item.totalPrice?.toFixed(2) || item.price?.toFixed(2)}
                    </Text>
                  </View>
                  {isItemAssigned(item.id) && (
                    <View style={styles.checkBadge}>
                      <Ionicons name="checkmark" size={14} color={theme.colors.cardBg} />
                    </View>
                  )}
                </View>
                
                <View style={styles.assignRow}>
                  {members.map((member, idx) => {
                    const isSelected = (selectedItems[item.id] || []).includes(member.id);
                    return (
                      <TouchableOpacity
                        key={member.id}
                        style={[
                          styles.assignAvatar,
                          isSelected && { 
                            backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
                            borderColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
                          },
                        ]}
                        onPress={() => togglePersonForItem(item.id, member.id)}
                      >
                        <Text style={[
                          styles.assignAvatarText,
                          isSelected && styles.assignAvatarTextSelected,
                        ]}>
                          {getInitials(member.name)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={styles.totalsCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>${bill.subtotal?.toFixed(2) || '0.00'}</Text>
            </View>
            {bill.tax > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax</Text>
                <Text style={styles.totalValue}>${bill.tax?.toFixed(2)}</Text>
              </View>
            )}
            {bill.tip > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tip</Text>
                <Text style={styles.totalValue}>${bill.tip?.toFixed(2)}</Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>${bill.total?.toFixed(2) || '0.00'}</Text>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Bottom Action */}
      <View style={styles.bottomAction}>
        <TouchableOpacity style={styles.splitButton} onPress={handleSplit}>
          <Text style={styles.splitButtonText}>Calculate Split</Text>
          <Ionicons name="calculator" size={20} color={theme.colors.background} />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 140,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 16,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
  summaryCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
    ...theme.shadows.lg,
  },
  billName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.cardTextSecondary,
    marginBottom: theme.spacing.sm,
  },
  billTotal: {
    fontSize: 48,
    fontWeight: '800',
    color: theme.colors.background,
    marginBottom: theme.spacing.sm,
  },
  summaryLabel: {
    fontSize: 14,
    color: theme.colors.cardTextSecondary,
  },
  membersLegend: {
    marginBottom: theme.spacing.lg,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  membersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    gap: theme.spacing.sm,
  },
  memberDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  memberChipText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  itemsSection: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  itemCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.cardText,
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.background,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assignRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  assignAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  assignAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999',
  },
  assignAvatarTextSelected: {
    color: '#FFFFFF',
  },
  totalsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  totalLabel: {
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  totalValue: {
    fontSize: 15,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.md,
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  grandTotalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  splitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    gap: theme.spacing.sm,
    ...theme.shadows.lg,
  },
  splitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.background,
  },
});
