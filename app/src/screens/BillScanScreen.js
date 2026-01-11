import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  BackHandler,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

// Helper function to detect non-veg items by name
const isNonVegByName = (name) => {
  const nameLower = name.toLowerCase();
  
  // Items with these words are ALWAYS vegetarian
  const vegKeywords = ['paneer', 'gobi', 'aloo', 'dal', 'chole', 'rajma', 'palak', 'mushroom', 'corn', 'tofu', 'soya'];
  if (vegKeywords.some(keyword => nameLower.includes(keyword))) return false;
  
  // Explicitly marked as veg
  const isExplicitlyVeg = nameLower.includes('veg ') || nameLower.startsWith('veg');
  if (isExplicitlyVeg) return false;
  
  // Non-veg keywords - only MEAT items, not ambiguous words like biryani/tikka/fry
  const nonVegKeywords = [
    'chicken', 'mutton', 'fish', 'egg', 'prawn', 'meat', 'keema', 'gosht', 
    'lamb', 'beef', 'pork', 'crab', 'lobster', 'shrimp', 'squid', 'apollo', 
    'lollypop', 'lollipop', 'seekh kebab', 'butter chicken', 'tandoori chicken'
  ];
  
  return nonVegKeywords.some(keyword => nameLower.includes(keyword));
};

// Transform bill data from API to display format
const transformBillData = (bill) => {
  if (!bill) return null;
  
  const categorizedItems = bill.categorizedItems || {};
  const isFoodBill = bill.billType === 'restaurant';
  
  // Separate items by category
  const vegItems = [];
  const nonVegItems = [];
  const beverageItems = [];
  const generalItems = [];

  // Process categorized items from API response
  for (const [category, items] of Object.entries(categorizedItems)) {
    if (!items || items.length === 0) continue;
    
    for (const item of items) {
      const processedItem = {
        name: item.name,
        quantity: item.quantity || 1,
        price: item.totalPrice || item.price || 0,
      };
      
      // For non-food bills, put everything in general items
      if (!isFoodBill) {
        generalItems.push(processedItem);
        continue;
      }
      
      // For food bills, categorize items
      const itemNameLower = item.name.toLowerCase();
      const isWater = itemNameLower.includes('water') || itemNameLower.includes('mineral');
      
      if (isWater) {
        generalItems.push(processedItem);
      } else if (isNonVegByName(item.name)) {
        // Fallback: detect non-veg by item name (handles miscategorized items)
        nonVegItems.push(processedItem);
      } else if (category.includes('Veg') && !category.includes('Non')) {
        vegItems.push(processedItem);
      } else if (category.includes('Non-Veg') || category.includes('🍖')) {
        nonVegItems.push(processedItem);
      } else if (category.includes('Beverage') || category.includes('🥤')) {
        beverageItems.push(processedItem);
      } else {
        generalItems.push(processedItem);
      }
    }
  }

  // If no categorized items, process from items array directly
  if (vegItems.length === 0 && nonVegItems.length === 0 && generalItems.length === 0 && bill.items) {
    for (const item of bill.items) {
      const processedItem = {
        name: item.name,
        quantity: item.quantity || 1,
        price: item.totalPrice || item.price || 0,
      };
      
      // For non-food bills, put everything in general items
      if (!isFoodBill) {
        generalItems.push(processedItem);
        continue;
      }
      
      // For food bills, categorize items - check name first, then category
      if (isNonVegByName(item.name)) {
        nonVegItems.push(processedItem);
      } else {
        const cat = item.category?.toLowerCase() || '';
        if (cat.includes('veg') && !cat.includes('non')) {
          vegItems.push(processedItem);
        } else if (cat.includes('non') || cat.includes('🍖')) {
          nonVegItems.push(processedItem);
        } else if (cat.includes('beverage') || cat.includes('🥤')) {
          beverageItems.push(processedItem);
        } else {
          generalItems.push(processedItem);
        }
      }
    }
  }

  // Combine beverages with general items for display
  const allGeneral = [...beverageItems, ...generalItems];

  // Calculate subtotal
  const allItems = [...vegItems, ...nonVegItems, ...allGeneral];
  const subtotal = bill.subtotal || allItems.reduce((sum, item) => sum + item.price, 0);

  // Process taxes
  const taxes = bill.taxes || [];
  const totalTaxAmount = taxes.reduce((sum, tax) => sum + (tax.amount || 0), 0);

  return {
    isFoodBill: isFoodBill,
    billType: bill.billType || 'restaurant',
    items: {
      veg: vegItems,
      nonVeg: nonVegItems,
      general: allGeneral,
    },
    taxes: taxes,
    subtotal: subtotal,
    total: bill.total || (subtotal + totalTaxAmount),
    restaurantName: bill.merchantName || (isFoodBill ? 'Restaurant Bill' : 'Bill'),
    date: bill.date || new Date().toLocaleDateString(),
    ocrEngine: bill.ocrEngine || 'openrouter',
  };
};

export default function BillScanScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  
  // Get bill data from route params (mobile) or sessionStorage (web)
  const getRawBillData = () => {
    // First try route params
    if (route.params?.billData) {
      return route.params.billData;
    }
    
    // On web, try sessionStorage (used to avoid long URLs)
    if (Platform.OS === 'web') {
      try {
        const storedData = sessionStorage.getItem('pendingBillData');
        if (storedData) {
          // Clear it after reading to prevent stale data
          sessionStorage.removeItem('pendingBillData');
          return JSON.parse(storedData);
        }
      } catch (e) {
        console.warn('Failed to read bill data from sessionStorage:', e);
      }
    }
    
    return null;
  };
  
  const [rawBillData] = useState(getRawBillData);
  const billData = transformBillData(rawBillData);

  // Handle back navigation
  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };

  // Redirect to home if no bill data (happens on page refresh)
  useEffect(() => {
    if (!rawBillData || !billData) {
      // On web refresh, params are lost - redirect to home
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    }
  }, [rawBillData, billData, navigation]);

  // Handle Android hardware back button
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

  // Get subtotal - prefer OCR's subtotal over calculated
  const getSubtotal = () => {
    if (!billData) return 0;
    // Use OCR's subtotal if available (more accurate for bills with per-item taxes)
    if (billData.subtotal) {
      return billData.subtotal;
    }
    // Fallback: calculate from items
    const vegTotal = billData.items.veg.reduce((sum, item) => sum + item.price, 0);
    const nonVegTotal = billData.items.nonVeg.reduce((sum, item) => sum + item.price, 0);
    const generalTotal = billData.items.general.reduce((sum, item) => sum + item.price, 0);
    return vegTotal + nonVegTotal + generalTotal;
  };

  // Render item row
  const renderItem = (item, index, isLast) => (
    <View key={index} style={[styles.itemRow, isLast && styles.itemRowLast]}>
      <Text style={styles.itemName}>{item.name}</Text>
      <View style={styles.itemRight}>
        <Text style={styles.itemQty}>×{item.quantity}</Text>
        <Text style={styles.itemPrice}>₹{item.price.toFixed(2)}</Text>
      </View>
    </View>
  );

  // Render category section
  const renderCategory = (title, items, icon) => {
    if (!items || items.length === 0) return null;
    
    return (
      <View style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryIcon}>{icon}</Text>
          <Text style={styles.categoryTitle}>{title}</Text>
          <Text style={styles.categoryCount}>{items.length} {items.length === 1 ? 'item' : 'items'}</Text>
        </View>
        <View style={styles.categoryItems}>
          {items.map((item, index) => renderItem(item, index, index === items.length - 1))}
        </View>
      </View>
    );
  };

  // Check if we have any items
  const hasItems = billData && (
    billData.items.veg.length > 0 || 
    billData.items.nonVeg.length > 0 || 
    billData.items.general.length > 0
  );

  // If no bill data, show error state
  if (!billData) {
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
            <Text style={styles.headerTitle}>Bill Summary</Text>
            <View style={styles.headerRight} />
          </View>
          <View style={styles.errorContainer}>
            <Ionicons name="warning-outline" size={64} color="#FFF" />
            <Text style={styles.errorTitle}>No Bill Data</Text>
            <Text style={styles.errorText}>Please upload a bill image first</Text>
            <TouchableOpacity style={styles.goBackButton} onPress={handleBack}>
              <Text style={styles.goBackButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

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
          <Text style={styles.headerTitle}>Bill Summary</Text>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.content}>
          {/* Main Card - Contains Everything */}
          {hasItems ? (
            <View style={styles.mainCard}>
              {/* Scrollable Content */}
              <ScrollView 
                style={styles.cardScrollView}
                contentContainerStyle={styles.cardScrollContent}
                showsVerticalScrollIndicator={true}
                bounces={true}
                nestedScrollEnabled={true}
              >
                {/* Restaurant Header */}
                {billData.restaurantName && (
                  <View style={styles.restaurantHeader}>
                    <Text style={styles.restaurantName}>{billData.restaurantName}</Text>
                    <Text style={styles.billDate}>{billData.date}</Text>
                  </View>
                )}

                {/* Divider */}
                <View style={styles.divider} />

                {/* Items by Category */}
                {billData.isFoodBill ? (
                  <>
                    {renderCategory('Non-Veg Items', billData.items.nonVeg, '🍗')}
                    {renderCategory('Veg Items', billData.items.veg, '🥬')}
                    {billData.items.general.length > 0 && 
                      renderCategory('Other Items', billData.items.general, '📦')}
                  </>
                ) : (
                  renderCategory('Items', billData.items.general, '🛒')
                )}

                {/* Subtotal */}
                <View style={styles.subtotalSection}>
                  <Text style={styles.subtotalLabel}>Subtotal</Text>
                  <Text style={styles.subtotalValue}>₹{getSubtotal().toFixed(2)}</Text>
                </View>

                {/* Individual Tax Rows - Always show if taxes exist */}
                {billData.taxes && billData.taxes.length > 0 && (
                  <View style={styles.taxesSection}>
                    <Text style={styles.taxesTitle}>TAXES & CHARGES</Text>
                    {billData.taxes.map((tax, index) => (
                      <View key={index} style={styles.taxRow}>
                        <Text style={styles.taxName}>{tax.name}</Text>
                        <Text style={styles.taxAmount}>₹{(tax.amount || 0).toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Total Tax Row - Show if subtotal != total */}
                {getSubtotal() !== billData.total && (
                  <View style={styles.taxesTotalSection}>
                    <Text style={styles.taxesTotalLabel}>Total Taxes & Charges</Text>
                    <Text style={styles.taxesTotalValue}>
                      ₹{(billData.total - getSubtotal()).toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* Total */}
                <View style={styles.totalSection}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>₹{billData.total.toFixed(2)}</Text>
                </View>

                {/* Continue Button - Inside Card */}
                <View style={styles.continueButtonWrapper}>
                  <TouchableOpacity 
                    style={styles.continueButton}
                    onPress={() => {
                      // Navigate to SplitOptions with bill data
                      navigation.navigate('SplitOptions', {
                        billData: {
                          ...billData,
                          rawItems: rawBillData?.items || [],
                        }
                      });
                    }}
                  >
                    <Text style={styles.continueButtonText}>Continue</Text>
                    <Ionicons name="chevron-forward" size={22} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          ) : (
            <View style={styles.noItemsCard}>
              <Ionicons name="warning-outline" size={48} color="#FF9800" />
              <Text style={styles.noItemsTitle}>No Items Detected</Text>
              <Text style={styles.noItemsText}>
                We couldn't extract items from this image.{'\n'}
                Please try with a clearer image.
              </Text>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
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
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },

  // Error State
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 20,
  },
  errorText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
  },
  goBackButton: {
    marginTop: 24,
    backgroundColor: '#FFF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  goBackButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B35',
  },

  // Main Card
  mainCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  cardScrollView: {
    flex: 1,
  },
  cardScrollContent: {
    flexGrow: 1,
  },

  // Restaurant Header
  restaurantHeader: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  billDate: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#EFEFEF',
    marginHorizontal: 20,
  },

  // Category Section
  categorySection: {
    marginTop: 0,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryCount: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  categoryItems: {
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 20,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  itemName: {
    fontSize: 15,
    color: '#333',
    flex: 1,
    marginRight: 12,
    flexWrap: 'wrap',
    lineHeight: 22,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexShrink: 0,
    paddingTop: 2,
  },
  itemQty: {
    fontSize: 13,
    color: '#888',
    marginRight: 16,
    fontWeight: '500',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    minWidth: 70,
    textAlign: 'right',
  },

  // Subtotal
  subtotalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
  },
  subtotalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  subtotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },

  // Taxes
  taxesSection: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
  },
  taxesTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    marginBottom: 10,
    letterSpacing: 0.8,
  },
  taxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  taxName: {
    fontSize: 14,
    color: '#666',
  },
  taxAmount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },

  // Taxes Total Row
  taxesTotalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
  },
  taxesTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  taxesTotalValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },

  // Total
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#1A1A1A', // Black background
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },

  // No Items Card
  noItemsCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
  noItemsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  noItemsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Continue Button Wrapper (inside card)
  continueButtonWrapper: {
    padding: 20,
    paddingHorizontal: 40,
    backgroundColor: '#FFF',
    alignItems: 'center',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    paddingVertical: 20,
    minHeight: 60,
    paddingHorizontal: 50,
    borderRadius: 30,
    gap: 8,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
});
