import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Modal,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Image,
  PixelRatio,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import Logo from '../components/Logo';
import { api } from '../api/client';
import WebPullToRefresh from '../components/WebPullToRefresh';
import { useAuth } from '../context/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isMobileWeb = isWeb && SCREEN_WIDTH < 768;

// Normalize size based on screen dimensions for consistent spacing across devices
// Base design is for 375 width (iPhone) - scales proportionally
const scale = SCREEN_WIDTH / 375;
const normalize = (size) => Math.round(PixelRatio.roundToNearestPixel(size * scale));

// Calculate bottom padding based on screen height percentage (more consistent across devices)
const BOTTOM_BAR_PADDING = Math.max(normalize(40), SCREEN_HEIGHT * 0.06);

// Helper function to get initials (max 2 characters)
const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.trim().split(' ').filter(p => p.length > 0);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Get last 6 months for dropdown
const getLastSixMonths = () => {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    });
  }
  return months;
};

export default function MainScreen({ navigation }) {
  const { user } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Insights state
  const [selectedMonth, setSelectedMonth] = useState(getLastSixMonths()[0].value);
  const [monthDropdownVisible, setMonthDropdownVisible] = useState(false);
  
  // Analysis state
  const [selectedRange, setSelectedRange] = useState(2); // Default: past 2 months

  // Pull to refresh handler for web
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Brief delay to show refresh indicator
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  }, []);

  const pickImage = async () => {
    setMenuVisible(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      processImage(result.assets[0].uri);
    }
  };

  const processImage = async (imageUri) => {
    setScanning(true);
    setCapturedImage(imageUri);
    
    try {
      const result = await api.scanBill(imageUri);
      navigateToSplit(result);
    } catch (error) {
      console.error('OCR Error:', error);
      // Demo fallback
      const mockResult = {
        success: true,
        bill: {
          merchantName: 'Restaurant',
          items: [
            { name: 'Burger', price: 12.99, quantity: 1, totalPrice: 12.99 },
            { name: 'Fries', price: 4.99, quantity: 2, totalPrice: 9.98 },
            { name: 'Drink', price: 2.99, quantity: 2, totalPrice: 5.98 },
          ],
          subtotal: 28.95,
          tax: 2.61,
          total: 31.56,
        },
      };
      navigateToSplit(mockResult);
    } finally {
      setScanning(false);
      setCapturedImage(null);
    }
  };

  const navigateToSplit = (result) => {
    navigation.navigate('BillDetail', {
      bill: {
        id: Date.now().toString(),
        name: result.bill?.merchantName || 'Scanned Bill',
        items: (result.bill?.items || []).map((item, idx) => ({
          ...item,
          id: `item-${idx}`,
          assignedTo: [],
        })),
        subtotal: result.bill?.subtotal || 0,
        tax: result.bill?.tax || 0,
        tip: result.bill?.tip || 0,
        total: result.bill?.total || 0,
        createdAt: new Date().toISOString(),
        status: 'pending',
      }
    });
  };

  const handleCustomSplit = () => {
    setMenuVisible(false);
    navigation.navigate('CustomSplit');
  };

  const toggleMenu = () => {
    setMenuVisible(!menuVisible);
  };

  // Web view - show options directly
  if (isWeb) {
    const webContent = (
      <View style={styles.webContent}>
        <Logo size="large" />
        
        <View style={styles.webOptions}>
          <TouchableOpacity style={styles.webOptionCard} onPress={handleCustomSplit}>
            <View style={styles.webOptionIcon}>
              <Ionicons name="calculator" size={32} color={theme.colors.background} />
            </View>
            <Text style={styles.webOptionTitle}>Add Custom Split</Text>
            <Text style={styles.webOptionDesc}>Enter items manually</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.webOptionCard} onPress={pickImage}>
            <View style={styles.webOptionIcon}>
              <Ionicons name="image" size={32} color={theme.colors.background} />
            </View>
            <Text style={styles.webOptionTitle}>Upload Image</Text>
            <Text style={styles.webOptionDesc}>Import a bill photo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
    
    return (
      <LinearGradient
        colors={[theme.colors.backgroundGradientStart, theme.colors.backgroundGradientEnd]}
        style={styles.container}
      >
        {isMobileWeb ? (
          <WebPullToRefresh
            onRefresh={onRefresh}
            refreshing={refreshing}
            contentContainerStyle={styles.webScrollContent}
            scrollViewProps={{
              showsVerticalScrollIndicator: false,
            }}
          >
            {webContent}
          </WebPullToRefresh>
        ) : (
          <ScrollView
            contentContainerStyle={styles.webScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {webContent}
          </ScrollView>
        )}
      </LinearGradient>
    );
  }

  // Get selected month label
  const selectedMonthLabel = getLastSixMonths().find(m => m.value === selectedMonth)?.label || 'Select Month';

  // Android - New Dashboard Layout
  return (
    <View style={styles.container}>
      {/* Orange Header Section */}
      <LinearGradient
        colors={['#FF8C5A', '#FF6B35', '#FF5722']}
        style={styles.headerGradient}
      >
        {/* Top Bar */}
        <View style={styles.topBar}>
          <Text style={styles.appTitle}>SplitBill</Text>
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.profileInitials}>{getInitials(user?.name)}</Text>
          </TouchableOpacity>
        </View>
        
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Logo size="medium" />
        </View>
      </LinearGradient>

      {/* White Panel with Scrollable Content */}
      <View style={styles.whitePanel}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Action Buttons Row */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity style={styles.actionButton} onPress={handleCustomSplit}>
              <View style={styles.actionIconContainer}>
                <Ionicons name="calculator-outline" size={28} color="#FF6B35" />
              </View>
              <Text style={styles.actionButtonText}>Custom</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
              <View style={styles.actionIconContainer}>
                <Ionicons name="camera-outline" size={28} color="#FF6B35" />
              </View>
              <Text style={styles.actionButtonText}>Upload Photo</Text>
            </TouchableOpacity>
          </View>

          {/* Expense Insights Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Expense Insights</Text>
              {/* Month Dropdown */}
              <TouchableOpacity 
                style={styles.dropdown}
                onPress={() => setMonthDropdownVisible(true)}
              >
                <Text style={styles.dropdownText} numberOfLines={1}>
                  {selectedMonthLabel.split(' ')[0].substring(0, 3)} {selectedMonthLabel.split(' ')[1]}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#666" />
              </TouchableOpacity>
            </View>
            
            {/* Pie Chart Placeholder */}
            <View style={styles.chartContainer}>
              <View style={styles.pieChartPlaceholder}>
                <View style={styles.pieChartCircle} />
              </View>
              <Text style={styles.noDataText}>No data</Text>
            </View>
          </View>

          {/* Analysis Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Analysis</Text>
              {/* Range Selector */}
              <TouchableOpacity 
                style={styles.dropdown}
                onPress={() => {
                  // Cycle through options: 2 -> 3 -> 4 -> 5 -> 6 -> 2
                  setSelectedRange(prev => prev >= 6 ? 2 : prev + 1);
                }}
              >
                <Text style={styles.dropdownText}>Past {selectedRange} months</Text>
                <Ionicons name="chevron-down" size={16} color="#666" />
              </TouchableOpacity>
            </View>
            
            {/* Bar Chart Placeholder */}
            <View style={styles.chartContainer}>
              <View style={styles.barChartPlaceholder}>
                <View style={[styles.bar, { height: 40 }]} />
                <View style={[styles.bar, { height: 60 }]} />
                <View style={[styles.bar, { height: 30 }]} />
                <View style={[styles.bar, { height: 50 }]} />
                <View style={[styles.bar, { height: 45 }]} />
              </View>
              <Text style={styles.noDataText}>No data</Text>
            </View>
          </View>

          {/* Summary Section */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <View style={styles.summaryContent}>
              <Ionicons name="analytics-outline" size={32} color="#CCC" />
              <Text style={styles.noDataText}>No data</Text>
              <Text style={styles.summaryHint}>
                Your spending insights will appear here once you start tracking expenses
              </Text>
            </View>
          </View>

          {/* Bottom spacing for tab bar */}
          <View style={{ height: 20 }} />
        </ScrollView>
      </View>

      {/* Month Selection Modal */}
      <Modal
        visible={monthDropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMonthDropdownVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setMonthDropdownVisible(false)}
        >
          <View style={styles.dropdownModal}>
            <Text style={styles.dropdownModalTitle}>Select Month</Text>
            {getLastSixMonths().map((month) => (
              <TouchableOpacity
                key={month.value}
                style={[
                  styles.dropdownOption,
                  selectedMonth === month.value && styles.dropdownOptionSelected
                ]}
                onPress={() => {
                  setSelectedMonth(month.value);
                  setMonthDropdownVisible(false);
                }}
              >
                <Text style={[
                  styles.dropdownOptionText,
                  selectedMonth === month.value && styles.dropdownOptionTextSelected
                ]}>
                  {month.label}
                </Text>
                {selectedMonth === month.value && (
                  <Ionicons name="checkmark" size={20} color="#FF6B35" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Scanning overlay */}
      {scanning && (
        <View style={styles.scanningOverlay}>
          {capturedImage && (
            <Image source={{ uri: capturedImage }} style={styles.capturedPreview} />
          )}
          <View style={styles.scanningContent}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.scanningText}>Analyzing receipt...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Web styles
  webScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  webContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  webOptions: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.xxl,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  webOptionCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    width: 200,
    ...theme.shadows.lg,
  },
  webOptionIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  webOptionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.cardText,
    marginBottom: theme.spacing.xs,
  },
  webOptionDesc: {
    fontSize: 14,
    color: theme.colors.cardTextSecondary,
    textAlign: 'center',
  },

  // Android Header styles
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 5,
  },

  // White Panel styles
  whitePanel: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    marginTop: -20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 25,
  },

  // Action Buttons
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 15,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },

  // Section Card styles
  sectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },

  // Dropdown styles
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  dropdownText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },

  // Chart placeholder styles
  chartContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  pieChartPlaceholder: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  pieChartCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 20,
    borderColor: '#E0E0E0',
  },
  barChartPlaceholder: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 80,
    gap: 15,
    marginBottom: 15,
  },
  bar: {
    width: 30,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
  },
  noDataText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },

  // Summary styles
  summaryContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  summaryHint: {
    fontSize: 13,
    color: '#AAA',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
    lineHeight: 18,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownModal: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 10,
    width: '100%',
    maxWidth: 320,
  },
  dropdownModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dropdownOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
  },
  dropdownOptionSelected: {
    backgroundColor: '#FFF5F0',
  },
  dropdownOptionText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownOptionTextSelected: {
    color: '#FF6B35',
    fontWeight: '600',
  },

  // Scanning overlay
  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  capturedPreview: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.3,
  },
  scanningContent: {
    alignItems: 'center',
  },
  scanningText: {
    marginTop: theme.spacing.lg,
    fontSize: 18,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
