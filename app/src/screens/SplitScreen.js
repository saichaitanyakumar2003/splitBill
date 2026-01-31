import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
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

export default function SplitScreen({ route, navigation }) {
  const { bill, members } = route.params;
  const [splits, setSplits] = useState({});
  const [tipMode, setTipMode] = useState('proportional');

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

  useEffect(() => {
    calculateSplits();
  }, [tipMode]);

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setRefreshing(false);
  }, []);

  const calculateSplits = () => {
    const personTotals = {};
    
    members.forEach(member => {
      personTotals[member.id] = {
        name: member.name,
        items: 0,
        itemsList: [],
        tax: 0,
        tip: 0,
        total: 0,
      };
    });

    bill.items.forEach(item => {
      const assignees = item.assignedTo || [];
      if (assignees.length === 0) return;

      const sharePerPerson = (item.totalPrice || item.price) / assignees.length;
      
      assignees.forEach(personId => {
        if (personTotals[personId]) {
          personTotals[personId].items += sharePerPerson;
          personTotals[personId].itemsList.push({
            name: item.name,
            share: sharePerPerson,
            shared: assignees.length > 1,
            sharedWith: assignees.length,
          });
        }
      });
    });

    const subtotal = bill.subtotal || Object.values(personTotals).reduce((sum, p) => sum + p.items, 0);
    const tax = bill.tax || 0;
    const tip = bill.tip || 0;

    const activeMembers = Object.entries(personTotals).filter(([_, p]) => p.items > 0);
    
    activeMembers.forEach(([personId, person]) => {
      if (tipMode === 'proportional' && subtotal > 0) {
        const proportion = person.items / subtotal;
        person.tax = tax * proportion;
        person.tip = tip * proportion;
      } else {
        person.tax = tax / activeMembers.length;
        person.tip = tip / activeMembers.length;
      }

      person.total = person.items + person.tax + person.tip;
      
      person.items = Math.round(person.items * 100) / 100;
      person.tax = Math.round(person.tax * 100) / 100;
      person.tip = Math.round(person.tip * 100) / 100;
      person.total = Math.round(person.total * 100) / 100;
    });

    setSplits(personTotals);
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getMemberIndex = (memberId) => {
    return members.findIndex(m => m.id === memberId);
  };

  const handleShare = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    let message = `💰 Bill Split - ${bill.name}\n\n`;
    
    Object.entries(splits)
      .filter(([_, person]) => person.total > 0)
      .forEach(([_, person]) => {
        message += `${person.name}: $${person.total.toFixed(2)}\n`;
      });
    
    message += `\n📋 Total: $${bill.total?.toFixed(2)}`;
    message += `\n\nSplit with SplitBill 📱`;

    try {
      await Share.share({ message });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleDone = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    navigation.popToTop();
  };

  const activeMembers = Object.entries(splits).filter(([_, p]) => p.total > 0);

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
        <Text style={styles.headerTitle}>Split Summary</Text>
        <TouchableOpacity style={styles.shareHeaderBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {isMobileWeb ? (
        <WebPullToRefresh
          onRefresh={handleRefresh}
          refreshing={refreshing}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          scrollViewProps={{
            showsVerticalScrollIndicator: false,
          }}
        >
          {/* Header Card */}
          <View style={styles.summaryCard}>
            <Text style={styles.billName}>{bill.name}</Text>
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeLabel}>Total Bill</Text>
              <Text style={styles.totalBadgeValue}>${bill.total?.toFixed(2)}</Text>
            </View>
          </View>

          {/* Tip Mode Toggle */}
          <View style={styles.tipModeContainer}>
            <Text style={styles.tipModeLabel}>Tax & Tip Split:</Text>
            <View style={styles.tipModeButtons}>
              <TouchableOpacity
                style={[styles.tipModeButton, tipMode === 'equal' && styles.tipModeButtonActive]}
                onPress={() => setTipMode('equal')}
              >
                <Text style={[styles.tipModeButtonText, tipMode === 'equal' && styles.tipModeButtonTextActive]}>
                  Equal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tipModeButton, tipMode === 'proportional' && styles.tipModeButtonActive]}
                onPress={() => setTipMode('proportional')}
              >
                <Text style={[styles.tipModeButtonText, tipMode === 'proportional' && styles.tipModeButtonTextActive]}>
                  Proportional
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Person Cards */}
          {activeMembers.map(([personId, person], index) => {
            const memberIdx = getMemberIndex(personId);
            const color = AVATAR_COLORS[memberIdx % AVATAR_COLORS.length];
            
            return (
              <View key={personId} style={styles.personCard}>
                <View style={styles.personHeader}>
                  <View style={[styles.personAvatar, { backgroundColor: color }]}>
                    <Text style={styles.personAvatarText}>{getInitials(person.name)}</Text>
                  </View>
                  <View style={styles.personInfo}>
                    <Text style={styles.personName}>{person.name}</Text>
                    <Text style={styles.personItemCount}>
                      {person.itemsList.length} item{person.itemsList.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.personTotal}>
                    <Text style={styles.personTotalLabel}>Owes</Text>
                    <Text style={[styles.personTotalValue, { color }]}>
                      ${person.total.toFixed(2)}
                    </Text>
                  </View>
                </View>

                <View style={styles.itemBreakdown}>
                  {person.itemsList.map((item, idx) => (
                    <View key={idx} style={styles.breakdownRow}>
                      <View style={styles.breakdownLeft}>
                        <Text style={styles.breakdownName} numberOfLines={1}>{item.name}</Text>
                        {item.shared && (
                          <Text style={styles.sharedBadge}>÷{item.sharedWith}</Text>
                        )}
                      </View>
                      <Text style={styles.breakdownValue}>${item.share.toFixed(2)}</Text>
                    </View>
                  ))}
                  
                  {person.tax > 0 && (
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownNameMuted}>Tax</Text>
                      <Text style={styles.breakdownValueMuted}>${person.tax.toFixed(2)}</Text>
                    </View>
                  )}
                  
                  {person.tip > 0 && (
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownNameMuted}>Tip</Text>
                      <Text style={styles.breakdownValueMuted}>${person.tip.toFixed(2)}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {/* Quick Summary */}
          <View style={styles.quickSummary}>
            <Text style={styles.quickSummaryTitle}>Quick Summary</Text>
            <View style={styles.quickSummaryGrid}>
              {activeMembers.map(([personId, person]) => {
                const memberIdx = getMemberIndex(personId);
                const color = AVATAR_COLORS[memberIdx % AVATAR_COLORS.length];
                return (
                  <View key={personId} style={styles.quickSummaryItem}>
                    <Text style={styles.quickSummaryName}>{person.name}</Text>
                    <Text style={[styles.quickSummaryAmount, { color }]}>
                      ${person.total.toFixed(2)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </WebPullToRefresh>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Card */}
          <View style={styles.summaryCard}>
            <Text style={styles.billName}>{bill.name}</Text>
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeLabel}>Total Bill</Text>
              <Text style={styles.totalBadgeValue}>${bill.total?.toFixed(2)}</Text>
            </View>
          </View>

          {/* Tip Mode Toggle */}
          <View style={styles.tipModeContainer}>
            <Text style={styles.tipModeLabel}>Tax & Tip Split:</Text>
            <View style={styles.tipModeButtons}>
              <TouchableOpacity
                style={[styles.tipModeButton, tipMode === 'equal' && styles.tipModeButtonActive]}
                onPress={() => setTipMode('equal')}
              >
                <Text style={[styles.tipModeButtonText, tipMode === 'equal' && styles.tipModeButtonTextActive]}>
                  Equal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tipModeButton, tipMode === 'proportional' && styles.tipModeButtonActive]}
                onPress={() => setTipMode('proportional')}
              >
                <Text style={[styles.tipModeButtonText, tipMode === 'proportional' && styles.tipModeButtonTextActive]}>
                  Proportional
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Person Cards */}
          {activeMembers.map(([personId, person], index) => {
            const memberIdx = getMemberIndex(personId);
            const color = AVATAR_COLORS[memberIdx % AVATAR_COLORS.length];
            
            return (
              <View key={personId} style={styles.personCard}>
                <View style={styles.personHeader}>
                  <View style={[styles.personAvatar, { backgroundColor: color }]}>
                    <Text style={styles.personAvatarText}>{getInitials(person.name)}</Text>
                  </View>
                  <View style={styles.personInfo}>
                    <Text style={styles.personName}>{person.name}</Text>
                    <Text style={styles.personItemCount}>
                      {person.itemsList.length} item{person.itemsList.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.personTotal}>
                    <Text style={styles.personTotalLabel}>Owes</Text>
                    <Text style={[styles.personTotalValue, { color }]}>
                      ${person.total.toFixed(2)}
                    </Text>
                  </View>
                </View>

                <View style={styles.itemBreakdown}>
                  {person.itemsList.map((item, idx) => (
                    <View key={idx} style={styles.breakdownRow}>
                      <View style={styles.breakdownLeft}>
                        <Text style={styles.breakdownName} numberOfLines={1}>{item.name}</Text>
                        {item.shared && (
                          <Text style={styles.sharedBadge}>÷{item.sharedWith}</Text>
                        )}
                      </View>
                      <Text style={styles.breakdownValue}>${item.share.toFixed(2)}</Text>
                    </View>
                  ))}
                  
                  {person.tax > 0 && (
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownNameMuted}>Tax</Text>
                      <Text style={styles.breakdownValueMuted}>${person.tax.toFixed(2)}</Text>
                    </View>
                  )}
                  
                  {person.tip > 0 && (
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownNameMuted}>Tip</Text>
                      <Text style={styles.breakdownValueMuted}>${person.tip.toFixed(2)}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {/* Quick Summary */}
          <View style={styles.quickSummary}>
            <Text style={styles.quickSummaryTitle}>Quick Summary</Text>
            <View style={styles.quickSummaryGrid}>
              {activeMembers.map(([personId, person]) => {
                const memberIdx = getMemberIndex(personId);
                const color = AVATAR_COLORS[memberIdx % AVATAR_COLORS.length];
                return (
                  <View key={personId} style={styles.quickSummaryItem}>
                    <Text style={styles.quickSummaryName}>{person.name}</Text>
                    <Text style={[styles.quickSummaryAmount, { color }]}>
                      ${person.total.toFixed(2)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneButtonText}>Done</Text>
          <Ionicons name="checkmark" size={20} color={theme.colors.background} />
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
  shareHeaderBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 140,
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
    marginBottom: theme.spacing.md,
  },
  totalBadge: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
  },
  totalBadgeLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  totalBadgeValue: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  tipModeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  tipModeLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  tipModeButtons: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.full,
    padding: 4,
  },
  tipModeButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
  },
  tipModeButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  tipModeButtonText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  tipModeButtonTextActive: {
    color: theme.colors.background,
  },
  personCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  personHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  personAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  personAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  personInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  personName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.cardText,
  },
  personItemCount: {
    fontSize: 14,
    color: theme.colors.cardTextSecondary,
  },
  personTotal: {
    alignItems: 'flex-end',
  },
  personTotalLabel: {
    fontSize: 12,
    color: theme.colors.cardTextSecondary,
  },
  personTotalValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  itemBreakdown: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: theme.spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.sm,
  },
  breakdownName: {
    fontSize: 14,
    color: theme.colors.cardText,
    flex: 1,
  },
  breakdownNameMuted: {
    fontSize: 14,
    color: theme.colors.cardTextSecondary,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.cardText,
  },
  breakdownValueMuted: {
    fontSize: 14,
    color: theme.colors.cardTextSecondary,
  },
  sharedBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.background,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  quickSummary: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  quickSummaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  quickSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  quickSummaryItem: {
    alignItems: 'center',
  },
  quickSummaryName: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  quickSummaryAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary,
    ...theme.shadows.lg,
  },
  doneButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.background,
  },
});
