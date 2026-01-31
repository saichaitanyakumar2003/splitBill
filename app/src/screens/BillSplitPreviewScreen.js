import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { authPost } from '../utils/apiHelper';
import WebPullToRefresh from '../components/WebPullToRefresh';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 80;
const isAndroid = Platform.OS === 'android';

export default function BillSplitPreviewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, token } = useAuth();
  const scrollViewRef = useRef(null);
  
  // Get data from navigation params
  const params = route.params || {};
  const { groupId, groupName, expenseTitle, amount, paidBy, selectedMembers, billData } = params;
  
  // Check if adding to existing group
  const isExistingGroup = !!groupId;
  
  // Validate params
  const paramsValid = Boolean(groupName && billData && selectedMembers?.length > 0 && paidBy);
  
  // Build all members list (payer + selected members)
  const allMembers = React.useMemo(() => {
    if (!paramsValid) return [];
    const membersMap = new Map();
    membersMap.set(paidBy.mailId, { ...paidBy, isPayer: true });
    selectedMembers.forEach(m => {
      if (!membersMap.has(m.mailId)) {
        membersMap.set(m.mailId, { ...m, isPayer: false });
      }
    });
    return Array.from(membersMap.values());
  }, [paramsValid, paidBy, selectedMembers]);
  
  // Flatten all items from categories
  const allItems = React.useMemo(() => {
    if (!billData?.items) return [];
    const items = [];
    
    // Add category label to each item
    if (billData.items.veg) {
      billData.items.veg.forEach(item => items.push({ ...item, category: 'Veg' }));
    }
    if (billData.items.nonVeg) {
      billData.items.nonVeg.forEach(item => items.push({ ...item, category: 'Non-Veg' }));
    }
    if (billData.items.general) {
      billData.items.general.forEach(item => items.push({ ...item, category: 'General' }));
    }
    
    return items;
  }, [billData]);
  
  // State for item selections - each item has an array of selected member mailIds
  const [itemSelections, setItemSelections] = useState({});
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  
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
  
  // Initialize all items with all members selected
  useEffect(() => {
    if (allItems.length > 0 && allMembers.length > 0) {
      const initialSelections = {};
      allItems.forEach((item, index) => {
        initialSelections[index] = allMembers.map(m => m.mailId);
      });
      setItemSelections(initialSelections);
    }
  }, [allItems.length, allMembers.length]);
  
  // Redirect if params missing
  useEffect(() => {
    if (!paramsValid && !isRedirecting) {
      setIsRedirecting(true);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = '/';
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      }
    }
  }, [paramsValid, isRedirecting, navigation]);
  
  if (!paramsValid || isRedirecting) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FF6B35' }}>
        <Text style={{ color: '#FFF', fontSize: 16 }}>Redirecting...</Text>
      </View>
    );
  }
  
  const handleBack = () => {
    navigation.goBack();
  };
  
  // Toggle member selection for an item
  const toggleMemberForItem = (itemIndex, mailId) => {
    setItemSelections(prev => {
      const currentSelection = prev[itemIndex] || [];
      const isSelected = currentSelection.includes(mailId);
      
      // Don't allow deselecting if only one person is selected
      if (isSelected && currentSelection.length === 1) {
        return prev;
      }
      
      const newSelection = isSelected
        ? currentSelection.filter(id => id !== mailId)
        : [...currentSelection, mailId];
      
      return { ...prev, [itemIndex]: newSelection };
    });
  };
  
  // Calculate amount per person for an item
  const getAmountPerPerson = (itemIndex) => {
    const item = allItems[itemIndex];
    const selectedCount = (itemSelections[itemIndex] || []).length;
    if (!item || selectedCount === 0) return 0;
    return item.price / selectedCount;
  };
  
  // Calculate tax amount per person (equally split among all selected members for any item)
  const getTaxPerPerson = () => {
    const totalTax = billData.total - (billData.subtotal || calculateSubtotal());
    // Get unique members who are selected in at least one item
    const activeMembers = new Set();
    Object.values(itemSelections).forEach(selections => {
      selections.forEach(mailId => activeMembers.add(mailId));
    });
    if (activeMembers.size === 0) return 0;
    return totalTax / activeMembers.size;
  };
  
  const calculateSubtotal = () => {
    return allItems.reduce((sum, item) => sum + (item.price || 0), 0);
  };
  
  // Calculate total contribution for each member
  const getMemberTotals = () => {
    const totals = {};
    allMembers.forEach(m => {
      totals[m.mailId] = 0;
    });
    
    // Add item amounts
    allItems.forEach((item, index) => {
      const selectedMembers = itemSelections[index] || [];
      const amountPerPerson = item.price / selectedMembers.length;
      selectedMembers.forEach(mailId => {
        totals[mailId] = (totals[mailId] || 0) + amountPerPerson;
      });
    });
    
    // Add tax share
    const taxPerPerson = getTaxPerPerson();
    const activeMembers = new Set();
    Object.values(itemSelections).forEach(selections => {
      selections.forEach(mailId => activeMembers.add(mailId));
    });
    activeMembers.forEach(mailId => {
      totals[mailId] = (totals[mailId] || 0) + taxPerPerson;
    });
    
    return totals;
  };
  
  // Navigate to previous/next item
  const goToPrevItem = () => {
    if (currentItemIndex > 0) {
      setCurrentItemIndex(currentItemIndex - 1);
      scrollViewRef.current?.scrollTo({
        x: (currentItemIndex - 1) * CARD_WIDTH,
        animated: true,
      });
    }
  };
  
  const goToNextItem = () => {
    if (currentItemIndex < allItems.length - 1) {
      setCurrentItemIndex(currentItemIndex + 1);
      scrollViewRef.current?.scrollTo({
        x: (currentItemIndex + 1) * CARD_WIDTH,
        animated: true,
      });
    }
  };
  
  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / CARD_WIDTH);
    if (index !== currentItemIndex && index >= 0 && index < allItems.length) {
      setCurrentItemIndex(index);
    }
  };
  
  const handleCheckout = async () => {
    setIsCreating(true);
    setError(null);
    
    try {
      // Build splits from item selections
      const memberTotals = getMemberTotals();
      const splits = {};
      Object.entries(memberTotals).forEach(([mailId, amount]) => {
        splits[mailId] = amount.toFixed(2);
      });
      
      const checkoutPayload = {
        groupName: groupName,
        members: [user.mailId, ...selectedMembers.map(m => m.mailId)],
        expenses: [{
          title: expenseTitle,
          totalAmount: billData.total,
          paidBy: paidBy.mailId,
          splits: splits,
        }],
        billData: {
          items: allItems.map((item, index) => ({
            ...item,
            selectedMembers: itemSelections[index] || [],
          })),
          taxes: billData.taxes,
          subtotal: billData.subtotal,
          total: billData.total,
        },
      };
      
      // Add groupId if adding to existing group
      if (isExistingGroup) {
        checkoutPayload.groupId = groupId;
      }
      
      const response = await authPost('/groups/checkout', checkoutPayload);
      
      const data = await response.json();
      
      if (data.success) {
        navigation.navigate('SplitSummary', {
          groupId: data.data.groupId,
          groupName: data.data.groupName,
          consolidatedExpenses: data.data.consolidatedExpenses,
          // Pass the expense that was added
          expenses: [{
            title: expenseTitle,
            totalAmount: billData.total,
            paidByName: paidBy.name,
            memberCount: allMembers.length,
          }],
        });
      } else {
        setError(data.message || 'Failed to create group');
      }
    } catch (e) {
      console.error('Checkout error:', e);
      setError('Network error. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };
  
  const memberTotals = getMemberTotals();
  const taxAmount = billData.total - (billData.subtotal || calculateSubtotal());
  
  // Get category color
  const getCategoryColor = (category) => {
    switch (category) {
      case 'Veg': return '#4CAF50';
      case 'Non-Veg': return '#E53935';
      default: return '#FF9800';
    }
  };
  
  // Inner content (without card wrapper)
  const innerContent = (
    <>
      {/* Summary Section */}
      <View style={styles.summarySection}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Group</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>{groupName}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Expense</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>{expenseTitle}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Paid By</Text>
                <View style={styles.payerBadge}>
                  <Text style={styles.payerBadgeText}>
                    {paidBy.mailId === user?.mailId ? `${paidBy.name} (You)` : paidBy.name}
                  </Text>
                </View>
              </View>
              <View style={[styles.summaryRow, styles.summaryRowLast]}>
                <Text style={styles.summaryLabel}>Total Amount</Text>
                <Text style={styles.summaryAmount}>₹{billData.total.toFixed(2)}</Text>
              </View>
            </View>
            {/* Items Carousel Section */}
            <View style={styles.carouselSection}>
              <Text style={styles.sectionTitle}>
                ITEMS ({currentItemIndex + 1} of {allItems.length})
              </Text>
              
              <View style={styles.carouselContainer}>
                {/* Left Arrow */}
                {currentItemIndex > 0 ? (
                  <TouchableOpacity style={styles.navArrow} onPress={goToPrevItem}>
                    <Ionicons name="chevron-back" size={20} color="#FFF" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.navArrowPlaceholder} />
                )}
                
                {/* Items ScrollView */}
                <ScrollView
                  ref={scrollViewRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
                  style={styles.carouselScroll}
                  contentContainerStyle={styles.carouselContent}
                >
                  {allItems.map((item, index) => (
                    <View key={index} style={[styles.itemCard, { width: SCREEN_WIDTH - 120 }]}>
                      {/* Item Header */}
                      <View style={styles.itemHeader}>
                        <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.category) }]}>
                          <Text style={styles.categoryBadgeText}>{item.category}</Text>
                        </View>
                        <Text style={styles.itemPrice}>₹{item.price.toFixed(2)}</Text>
                      </View>
                      
                      <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                      {item.quantity > 1 && (
                        <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
                      )}
                      
                      {/* Members Selection */}
                      <View style={styles.membersSection}>
                        <Text style={styles.membersTitle}>
                          Split between ({(itemSelections[index] || []).length} selected)
                        </Text>
                        
                        <ScrollView 
                          style={styles.membersList}
                          showsVerticalScrollIndicator={true}
                          nestedScrollEnabled={true}
                        >
                          {allMembers.map(member => {
                            const isSelected = (itemSelections[index] || []).includes(member.mailId);
                            const amountForMember = isSelected ? getAmountPerPerson(index) : 0;
                            
                            return (
                              <TouchableOpacity
                                key={member.mailId}
                                style={[
                                  styles.memberItem,
                                  isSelected && styles.memberItemSelected,
                                ]}
                                onPress={() => toggleMemberForItem(index, member.mailId)}
                                activeOpacity={0.7}
                              >
                                <View style={styles.memberCheckbox}>
                                  <Ionicons
                                    name={isSelected ? 'checkbox' : 'square-outline'}
                                    size={24}
                                    color={isSelected ? '#FF6B35' : '#CCC'}
                                  />
                                </View>
                                <View style={styles.memberInfo}>
                                  <Text style={[
                                    styles.memberName,
                                    isSelected && styles.memberNameSelected,
                                  ]} numberOfLines={1}>
                                    {member.name}
                                    {member.isPayer && ' (Payer)'}
                                  </Text>
                                </View>
                                <Text style={[
                                  styles.memberAmount,
                                  isSelected && styles.memberAmountSelected,
                                ]}>
                                  ₹{amountForMember.toFixed(2)}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    </View>
                  ))}
                </ScrollView>
                
                {/* Right Arrow */}
                {currentItemIndex < allItems.length - 1 ? (
                  <TouchableOpacity style={styles.navArrow} onPress={goToNextItem}>
                    <Ionicons name="chevron-forward" size={20} color="#FFF" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.navArrowPlaceholder} />
                )}
              </View>
              
              {/* Dots Indicator */}
              <View style={styles.dotsContainer}>
                {allItems.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      currentItemIndex === index && styles.dotActive,
                    ]}
                  />
                ))}
              </View>
            </View>
            
            {/* Taxes Section */}
            {taxAmount > 0 && (
              <View style={styles.taxSection}>
                <View style={styles.taxHeader}>
                  <Text style={styles.taxTitle}>TAXES & CHARGES</Text>
                  <Text style={styles.taxTotal}>₹{taxAmount.toFixed(2)}</Text>
                </View>
                
                {billData.taxes && billData.taxes.length > 0 && (
                  <View style={styles.taxBreakdown}>
                    {billData.taxes.map((tax, index) => (
                      <View key={index} style={styles.taxRow}>
                        <Text style={styles.taxName}>{tax.name}</Text>
                        <Text style={styles.taxAmountText}>₹{(tax.amount || 0).toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>
                )}
                
                <View style={styles.taxNote}>
                  <Ionicons name="information-circle-outline" size={16} color="#888" />
                  <Text style={styles.taxNoteText}>
                    Taxes are split equally among all participants
                  </Text>
                </View>
              </View>
            )}
            
            {/* Final Split Summary */}
            <View style={styles.splitSummarySection}>
              <Text style={styles.splitSummaryTitle}>FINAL SPLIT</Text>
              
              {allMembers.map(member => {
                const totalAmount = memberTotals[member.mailId] || 0;
                const isCurrentUser = member.mailId === user?.mailId;
                
                return (
                  <View key={member.mailId} style={styles.splitRow}>
                    <View style={styles.splitMemberInfo}>
                      <View style={[styles.avatar, member.isPayer && styles.avatarPayer]}>
                        <Text style={[styles.avatarText, member.isPayer && styles.avatarTextPayer]}>
                          {member.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.splitMemberName} numberOfLines={1}>
                          {member.name}
                          {isCurrentUser && ' (You)'}
                        </Text>
                        {member.isPayer && (
                          <Text style={styles.splitPayerLabel}>Paid the bill</Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.splitAmountContainer}>
                      <Text style={[
                        styles.splitAmount,
                        member.isPayer && styles.splitAmountPayer,
                      ]}>
                        {member.isPayer 
                          ? `Gets ₹${(billData.total - totalAmount).toFixed(2)}`
                          : `₹${totalAmount.toFixed(2)}`
                        }
                      </Text>
                      {!member.isPayer && (
                        <Text style={styles.splitOwesText}>owes</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
            
            {/* Error */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            )}
            
            {/* Checkout Button - Inside Card */}
            <TouchableOpacity
              style={[styles.checkoutButton, isCreating && styles.checkoutButtonDisabled]}
              onPress={handleCheckout}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
<Text style={styles.checkoutButtonText}>Checkout</Text>
                <Ionicons name="cart" size={22} color="#FFF" />
                </>
              )}
            </TouchableOpacity>
    </>
  );

  // Main content - wrapped in card for Web/iOS, unwrapped for Android
  const mainContent = isAndroid ? (
    innerContent
  ) : (
    <View style={styles.mainContentCard}>
      {innerContent}
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
            <Pressable onPress={handleBack} style={androidStyles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#E85A24" />
            </Pressable>
            <Text style={androidStyles.headerTitle}>Split Preview</Text>
            <View style={androidStyles.headerRight} />
          </View>
          
          {/* Decorative Icon */}
          <View style={androidStyles.decorativeIconContainer}>
            <View style={androidStyles.decorativeIconCircle}>
              <Ionicons name="git-network-outline" size={26} color="#E85A24" />
            </View>
          </View>
          
          {/* White Content Area with Curved Top */}
          <View style={androidStyles.whiteContentArea}>
            {isMobileWeb ? (
              <WebPullToRefresh
                onRefresh={handleRefresh}
                refreshing={refreshing}
                contentContainerStyle={androidStyles.mainScrollContent}
                scrollViewProps={{
                  style: androidStyles.mainScroll,
                  showsVerticalScrollIndicator: false,
                }}
              >
                {mainContent}
              </WebPullToRefresh>
            ) : (
              <ScrollView 
                style={androidStyles.mainScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={androidStyles.mainScrollContent}
              >
                {mainContent}
              </ScrollView>
            )}
          </View>
        </LinearGradient>
      </View>
    );
  }
  
  // Web/iOS - Original design unchanged
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
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Split Bill</Text>
          <View style={styles.headerRight} />
        </View>
        
        {isMobileWeb ? (
          <WebPullToRefresh
            onRefresh={handleRefresh}
            refreshing={refreshing}
            contentContainerStyle={styles.mainScrollContent}
            scrollViewProps={{
              style: styles.mainScroll,
              showsVerticalScrollIndicator: false,
            }}
          >
            {mainContent}
          </WebPullToRefresh>
        ) : (
          <ScrollView 
            style={styles.mainScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.mainScrollContent}
          >
            {mainContent}
          </ScrollView>
        )}
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
    paddingBottom: 15,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  headerRight: {
    width: 44,
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  // Summary Section (inside main card)
  summarySection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  summaryRowLast: {
    borderBottomWidth: 0,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  payerBadge: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  payerBadgeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  summaryAmount: {
    fontSize: 22,
    color: '#FF6B35',
    fontWeight: '700',
  },
  // Main Content Card - Contains everything
  mainContentCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  // Carousel Section
  carouselSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 0.5,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  carouselContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: -10,
  },
  navArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  navArrowPlaceholder: {
    width: 32,
  },
  carouselScroll: {
    flex: 1,
  },
  carouselContent: {
    paddingHorizontal: 0,
  },
  itemCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    minHeight: 300,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  itemPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF6B35',
  },
  itemName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  itemQty: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
  },
  membersSection: {
    flex: 1,
    marginTop: 8,
  },
  membersTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  membersList: {
    maxHeight: 180,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  memberItemSelected: {
    backgroundColor: '#FFF5F0',
    borderColor: '#FF6B35',
  },
  memberCheckbox: {
    marginRight: 10,
    marginTop: 2,
  },
  memberInfo: {
    flex: 1,
    marginRight: 8,
  },
  memberName: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    flexWrap: 'wrap',
    lineHeight: 20,
  },
  memberNameSelected: {
    color: '#333',
    fontWeight: '600',
  },
  memberAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CCC',
    flexShrink: 0,
    marginTop: 2,
  },
  memberAmountSelected: {
    color: '#FF6B35',
  },
  // Dots
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 14,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  dotActive: {
    backgroundColor: '#FF6B35',
    width: 20,
  },
  // Tax Section (inside card)
  taxSection: {
    paddingTop: 20,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  taxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  taxTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  taxTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF6B35',
  },
  taxBreakdown: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  taxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  taxName: {
    fontSize: 14,
    color: '#666',
  },
  taxAmountText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  taxNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taxNoteText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  // Split Summary Section (inside card)
  splitSummarySection: {
    paddingTop: 20,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  splitSummaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 0.5,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  splitMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarPayer: {
    backgroundColor: '#FF6B35',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#666',
  },
  avatarTextPayer: {
    color: '#FFF',
  },
  splitMemberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  splitPayerLabel: {
    fontSize: 11,
    color: '#FF6B35',
    fontWeight: '500',
    marginTop: 2,
  },
  splitAmountContainer: {
    alignItems: 'flex-end',
  },
  splitAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  splitAmountPayer: {
    color: '#4CAF50',
  },
  splitOwesText: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  // Error
  errorContainer: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE69C',
  },
  errorText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    fontWeight: '500',
  },
  // Checkout Button - Orange with White Text - Increased touch area
  checkoutButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    minHeight: 60,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  checkoutButtonDisabled: {
    opacity: 0.7,
  },
  checkoutButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
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
    paddingTop: Platform.OS === 'android' ? 50 : 65,
    paddingHorizontal: 20,
    paddingBottom: 15,
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
    color: '#FFF',
  },
  headerRight: {
    width: 44,
  },
  decorativeIconContainer: {
    alignItems: 'center',
    marginTop: 5,
    marginBottom: -25,
    zIndex: 20,
  },
  decorativeIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  whiteContentArea: {
    flex: 1,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: 0,
    paddingTop: 40,
    overflow: 'hidden',
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
});

