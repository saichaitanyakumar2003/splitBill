import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Platform, Dimensions, Animated, Easing, ActivityIndicator, Alert, Modal, AppState, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const navigationRef = createNavigationContainerRef();
let initialNotificationScreen = null;

Notifications.getLastNotificationResponseAsync().then(response => {
  if (response) {
    initialNotificationScreen = response.notification.request.content.data?.screen;
  }
});
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ENV from './src/config/env';
import { api } from './src/api/client';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import HelpCenterScreen from './src/screens/HelpCenterScreen';
import GroupsScreen from './src/screens/GroupsScreen';
import AwaitingScreen from './src/screens/AwaitingScreen';
import LoginScreen from './src/screens/LoginScreen';
import NetworkErrorScreen from './src/screens/NetworkErrorScreen';
import SplitOptionsScreen from './src/screens/SplitOptionsScreen';
import CreateGroupScreen from './src/screens/CreateGroupScreen';
import SelectGroupScreen from './src/screens/SelectGroupScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import GroupPreviewScreen from './src/screens/GroupPreviewScreen';
import BillSplitPreviewScreen from './src/screens/BillSplitPreviewScreen';
import SplitSummaryScreen from './src/screens/SplitSummaryScreen';
import PendingExpensesScreen from './src/screens/PendingExpensesScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import BillScanScreen from './src/screens/BillScanScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NetworkProvider, useNetwork } from './src/context/NetworkContext';
import { StoreProvider, useStore } from './src/context/StoreContext';

const Stack = createNativeStackNavigator();

// URL Linking Configuration - will be set dynamically based on auth state
const getLinkedScreens = (isAuthenticated) => ({
  prefixes: ['http://localhost:8081', 'splitbill://'],
  config: {
    screens: {
      Login: isAuthenticated ? 'login' : '',  // Root path goes to Login when not authenticated
      Home: isAuthenticated ? '' : 'home',     // Root path goes to Home when authenticated
      Profile: 'profile',
      Settings: 'settings',
      HelpCenter: 'help',
      Groups: 'groups',
      Awaiting: 'awaiting',
      PendingExpenses: 'pending-expenses',
      History: 'history',
      SplitOptions: 'split-options',
      SelectGroup: 'select-group',
      CreateGroup: 'create-group',
      AddExpense: 'add-expense',
      // BillScan and GroupPreview not linked - refreshing redirects to Home
      // These screens require state that can't be serialized to URL
    },
  },
  // Custom state parser to handle invalid/missing routes
  getStateFromPath: (path, options) => {
    // If path contains BillScan or has very long query params, redirect to home
    if (path.includes('BillScan') || path.length > 500) {
      return {
        routes: [{ name: isAuthenticated ? 'Home' : 'Login' }],
      };
    }
    // Use default parsing for other paths
    const { getStateFromPath } = require('@react-navigation/native');
    return getStateFromPath(path, options);
  },
});

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');


// Animated floating emojis
function FloatingEmojis() {
  const emojis = [
    { emoji: '💳', delay: 0, duration: 4000, startX: '10%', startY: '20%' },
    { emoji: '💰', delay: 500, duration: 3500, startX: '80%', startY: '30%' },
    { emoji: '🧾', delay: 1000, duration: 4500, startX: '15%', startY: '70%' },
    { emoji: '📱', delay: 1500, duration: 3000, startX: '75%', startY: '75%' },
    { emoji: '✅', delay: 2000, duration: 4000, startX: '50%', startY: '10%' },
    { emoji: '👥', delay: 2500, duration: 3500, startX: '85%', startY: '50%' },
  ];

  return (
    <View style={styles.floatingContainer} pointerEvents="none">
      {emojis.map((item, index) => (
        <FloatingEmoji key={index} {...item} />
      ))}
    </View>
  );
}

function FloatingEmoji({ emoji, delay, duration, startX, startY }) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(floatAnim, {
              toValue: 1,
              duration: duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(floatAnim, {
              toValue: 0,
              duration: duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: 0.5,
              duration: duration,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.2,
              duration: duration,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, []);

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -30],
  });

  const translateX = floatAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 10, 0],
  });

  return (
    <Animated.Text
      style={[
        styles.floatingEmoji,
        {
          left: startX,
          top: startY,
          opacity: opacityAnim,
          transform: [{ translateY }, { translateX }],
        },
      ]}
    >
      {emoji}
    </Animated.Text>
  );
}

// Animated decorative circles
function DecorativeCircles() {
  const scaleAnim1 = useRef(new Animated.Value(1)).current;
  const scaleAnim2 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim1, {
          toValue: 1.1,
          duration: 5000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim1, {
          toValue: 1,
          duration: 5000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim2, {
          toValue: 1.15,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim2, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.circlesContainer} pointerEvents="none">
      <Animated.View style={[styles.circle, styles.circle1, { transform: [{ scale: scaleAnim1 }] }]} />
      <Animated.View style={[styles.circle, styles.circle2, { transform: [{ scale: scaleAnim2 }] }]} />
      <View style={[styles.circle, styles.circle3]} />
    </View>
  );
}

// Logo Component with pulse
function Logo({ isMobile = false, hideText = false }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={[styles.logoContainer, isMobile && styles.logoContainerMobile]}>
      <View style={[styles.logoGlow, isMobile && styles.logoGlowMobile]} />
      
      <Animated.View style={[styles.logoCircle, isMobile && styles.logoCircleMobile, { transform: [{ scale: pulseAnim }] }]}>
        <Text style={[styles.logoText, isMobile && styles.logoTextMobile]}>
          <Text style={styles.logoS}>S</Text>
          <Text style={styles.logoB}>B</Text>
        </Text>
      </Animated.View>
      
      {/* Only hide "SplitBill" text, keep tagline and flow icons */}
      {!hideText && (
        <Text style={[styles.title, isMobile && styles.titleMobile]}>Split<Text style={styles.titleBold}>Bill</Text></Text>
      )}
      
      <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>Split smart. Pay fair.</Text>
      
      <View style={styles.taglineRow}>
        <Text style={[styles.taglineIcon, isMobile && styles.taglineIconMobile]}>🧾</Text>
        <Text style={styles.taglineArrow}>→</Text>
        <Text style={[styles.taglineIcon, isMobile && styles.taglineIconMobile]}>👥</Text>
        <Text style={styles.taglineArrow}>→</Text>
        <Text style={[styles.taglineIcon, isMobile && styles.taglineIconMobile]}>✅</Text>
      </View>
    </View>
  );
}


// Web Side Panel Component - Has all tabs (Groups, Awaiting, Settle Up, History)
function WebSidePanel({ visible, onClose, onGroups, onAwaiting, onPendingExpenses, onHistory }) {
  if (!visible) return null;

  return (
    <>
      <Pressable style={styles.sidePanelOverlay} onPress={onClose} />
      <View style={styles.sidePanel}>
        <View style={styles.sidePanelHeader}>
          <Text style={styles.sidePanelTitle}>Info</Text>
          <TouchableOpacity onPress={onClose} style={styles.sidePanelClose}>
            <Text style={styles.sidePanelCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.sidePanelMenu}>
          <TouchableOpacity 
            style={styles.sidePanelMenuItem}
            onPress={onGroups}
            activeOpacity={0.7}
          >
            <Text style={styles.sidePanelMenuIcon}>👥</Text>
            <Text style={styles.sidePanelMenuText}>Groups</Text>
            <Text style={styles.sidePanelMenuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.sidePanelMenuItem}
            onPress={onAwaiting}
            activeOpacity={0.7}
          >
            <Text style={styles.sidePanelMenuIcon}>⏳</Text>
            <Text style={styles.sidePanelMenuText}>Awaiting</Text>
            <Text style={styles.sidePanelMenuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.sidePanelMenuItem}
            onPress={onPendingExpenses}
            activeOpacity={0.7}
          >
            <Text style={styles.sidePanelMenuIcon}>✅</Text>
            <Text style={styles.sidePanelMenuText}>Settle Up</Text>
            <Text style={styles.sidePanelMenuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.sidePanelMenuItem}
            onPress={onHistory}
            activeOpacity={0.7}
          >
            <Text style={styles.sidePanelMenuIcon}>📜</Text>
            <Text style={styles.sidePanelMenuText}>History</Text>
            <Text style={styles.sidePanelMenuArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

// Web Profile Menu Dropdown Component
function WebProfileMenu({ visible, onClose, onViewProfile, onHelpCenter, onLogout }) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.8);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      <TouchableOpacity 
        style={styles.menuOverlay} 
        activeOpacity={1} 
        onPress={onClose}
      />
      <Animated.View 
        style={[
          styles.menuDropdown,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.menuArrow} />
        
        <TouchableOpacity 
          style={styles.menuItem} 
          onPress={onViewProfile}
          activeOpacity={0.7}
        >
          <View style={styles.menuIconContainer}>
            <Text style={styles.menuIcon}>👤</Text>
          </View>
          <Text style={styles.menuText}>View Profile</Text>
          <Text style={styles.menuChevron}>›</Text>
        </TouchableOpacity>
        
        <View style={styles.menuDivider} />
        
        <TouchableOpacity 
          style={styles.menuItem} 
          onPress={onHelpCenter}
          activeOpacity={0.7}
        >
          <View style={styles.menuIconContainer}>
            <Text style={styles.menuIcon}>📞</Text>
          </View>
          <Text style={styles.menuText}>Help Center</Text>
          <Text style={styles.menuChevron}>›</Text>
        </TouchableOpacity>
        
        <View style={styles.menuDivider} />
        
        <TouchableOpacity 
          style={[styles.menuItem, styles.logoutItem]} 
          onPress={onLogout}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconContainer, styles.logoutIconContainer]}>
            <Text style={styles.powerIcon}>⏻</Text>
          </View>
          <Text style={[styles.menuText, styles.logoutMenuText]}>Logout</Text>
          <Text style={[styles.menuChevron, styles.logoutMenuText]}>›</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}


// Mobile Settings Panel Component (Right) - View Profile, Help Center, and Logout
function MobileSettingsPanel({ visible, onClose, onViewProfile, onHelpCenter, onLogout }) {
  if (!visible) return null;

  return (
    <>
      <Pressable style={styles.sidePanelOverlay} onPress={onClose} />
      <View style={[styles.sidePanel, styles.settingsPanel]}>
        <View style={styles.sidePanelHeader}>
          <Text style={styles.sidePanelTitle}>Settings</Text>
          <TouchableOpacity onPress={onClose} style={styles.sidePanelClose}>
            <Text style={styles.sidePanelCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.sidePanelMenu}>
          <TouchableOpacity 
            style={styles.sidePanelMenuItem}
            onPress={onViewProfile}
            activeOpacity={0.7}
          >
            <Text style={styles.sidePanelMenuIcon}>👤</Text>
            <Text style={styles.sidePanelMenuText}>View Profile</Text>
            <Text style={styles.sidePanelMenuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.sidePanelMenuItem}
            onPress={onHelpCenter}
            activeOpacity={0.7}
          >
            <Text style={styles.sidePanelMenuIcon}>📞</Text>
            <Text style={styles.sidePanelMenuText}>Help Center</Text>
            <Text style={styles.sidePanelMenuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.sidePanelMenuItem, styles.logoutMenuItem]}
            onPress={onLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={24} color="#DC3545" style={styles.logoutIcon} />
            <Text style={[styles.sidePanelMenuText, styles.logoutText]}>Logout</Text>
            <Text style={styles.sidePanelMenuArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

// Logout Confirmation Modal
function LogoutModal({ visible, onCancel, onConfirm }) {
  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.logoutModal}>
        <Text style={styles.logoutModalTitle}>Logout</Text>
        <Text style={styles.logoutModalMessage}>Are you sure you want to logout?</Text>
        <View style={styles.logoutModalButtons}>
          <TouchableOpacity 
            style={[styles.logoutModalButton, styles.logoutModalCancel]}
            onPress={onCancel}
          >
            <Text style={styles.logoutModalCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.logoutModalButton, styles.logoutModalConfirm]}
            onPress={onConfirm}
          >
            <Text style={styles.logoutModalConfirmText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// Mobile Bottom Tab Bar Component
function MobileBottomTabBar({ navigation, onScanImage }) {
  return (
    <View style={styles.bottomTabBar}>
      <TouchableOpacity 
        style={styles.bottomTab}
        onPress={() => navigation.navigate('Groups')}
      >
        <Ionicons name="people" size={24} color="#FF6B35" />
        <Text style={styles.bottomTabTextOrange}>Groups</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.bottomTab}
        onPress={() => navigation.navigate('Awaiting')}
      >
        <Ionicons name="time" size={24} color="#FF6B35" />
        <Text style={styles.bottomTabTextOrange}>Awaiting</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.bottomTabCenter}
        onPress={onScanImage}
      >
        <View style={styles.bottomTabCenterButton}>
          <Ionicons name="qr-code" size={28} color="#FFF" />
        </View>
        <Text style={styles.bottomTabCenterText}>Scan</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.bottomTab}
        onPress={() => navigation.navigate('PendingExpenses')}
      >
        <Ionicons name="checkmark-circle" size={24} color="#FF6B35" />
        <Text style={styles.bottomTabTextOrange}>Settle Up</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.bottomTab}
        onPress={() => navigation.navigate('History')}
      >
        <Ionicons name="receipt" size={24} color="#FF6B35" />
        <Text style={styles.bottomTabTextOrange}>History</Text>
      </TouchableOpacity>
    </View>
  );
}

// Home Screen Component
function HomeScreen({ navigation, route }) {
  // Mobile-specific states
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // Web-specific states
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  // OCR processing states
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [processingError, setProcessingError] = useState(null);
  
  const { user, logout, token, isAuthenticated } = useAuth();
  const isNativeMobile = Platform.OS === 'ios' || Platform.OS === 'android';
  
  // Track screen width for responsive layout (especially for mobile web)
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);
  
  // Use mobile layout for native mobile OR small web screens (< 768px)
  const isMobileLayout = isNativeMobile || screenWidth < 768;

  // Redirect to Login if not authenticated (handles logout)
  useEffect(() => {
    if (!isAuthenticated) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  }, [isAuthenticated, navigation]);

  // Check if we should open the side panel (when coming back from a screen)
  useEffect(() => {
    if (route.params?.openSidePanel && !isNativeMobile) {
      setShowSidePanel(true);
      // Clear the param so it doesn't re-trigger
      navigation.setParams({ openSidePanel: undefined });
    }
  }, [route.params?.openSidePanel]);

  const handleCustomSplit = () => {
    navigation.navigate('SplitOptions');
  };

  // Handle image upload and OCR processing directly from home
  const handleUploadImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to upload bill images.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });

      if (result.canceled || !result.assets || !result.assets[0]) {
        return; // User cancelled
      }

      const imageUri = result.assets[0].uri;
      
      // Show processing modal
      setIsProcessingImage(true);
      setProcessingError(null);

      try {
        // Process image with client-side OCR (calls Gemini directly)
        console.log('📸 Processing image with client-side OCR...');
        const data = await api.scanBill(imageUri);

        if (!data.success) {
          throw new Error(data.error || 'Failed to scan bill');
        }

        // Store bill data in sessionStorage (web) to avoid URL length issues
        if (Platform.OS === 'web') {
          try {
            sessionStorage.setItem('pendingBillData', JSON.stringify(data.bill));
          } catch (e) {
            console.warn('Failed to store bill data:', e);
          }
          // Navigate without params on web to avoid long URLs
          setIsProcessingImage(false);
          navigation.navigate('BillScan');
        } else {
          // On mobile, pass data through params (no URL issue)
          setIsProcessingImage(false);
          navigation.navigate('BillScan', { billData: data.bill });
        }

      } catch (err) {
        console.error('OCR Error:', err);
        setProcessingError(err.message || 'Failed to process bill');
        setIsProcessingImage(false);
      }

    } catch (err) {
      console.error('Image picker error:', err);
      setIsProcessingImage(false);
    }
  };

  // Handle camera scan for bills (Android only) - Uses ImagePicker camera
  const handleScanImage = async () => {
    try {
      // Request camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Please allow access to your camera to scan bill images.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });

      if (result.canceled || !result.assets || !result.assets[0]) {
        return; // User cancelled
      }

      const imageUri = result.assets[0].uri;
      
      // Show processing modal
      setIsProcessingImage(true);
      setProcessingError(null);

      try {
        // Process image with client-side OCR (calls Gemini directly)
        console.log('📷 Processing camera image with client-side OCR...');
        const data = await api.scanBill(imageUri);

        if (!data.success) {
          throw new Error(data.error || 'Failed to scan bill');
        }

        // On mobile, pass data through params
        setIsProcessingImage(false);
        navigation.navigate('BillScan', { billData: data.bill });

      } catch (err) {
        console.error('OCR Error:', err);
        setProcessingError(err.message || 'Failed to process bill');
        setIsProcessingImage(false);
      }

    } catch (err) {
      console.error('Camera error:', err);
      Alert.alert('Error', 'Failed to open camera. Please try again.');
    }
  };

  const handleViewProfile = () => {
    setShowProfileMenu(false);
    navigation.navigate('Profile');
  };

  const handleHelpCenter = () => {
    setShowSettingsPanel(false);
    setShowProfileMenu(false);
    navigation.navigate('HelpCenter');
  };

  // Mobile view profile handler
  const handleMobileViewProfile = () => {
    setShowSettingsPanel(false);
    navigation.navigate('Profile');
  };

  // Mobile logout with confirmation modal
  const handleLogoutPress = () => {
    setShowSettingsPanel(false);
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = async () => {
    setShowLogoutModal(false);
    // Just call logout - the useEffect above will handle navigation
    // when isAuthenticated becomes false
    await logout();
  };

  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  // Web logout with confirmation modal
  const handleWebLogout = () => {
    setShowProfileMenu(false);
    setShowLogoutModal(true);
  };

  // Get user initials for profile icon (max 2 characters) - Web only
  const getUserInitials = () => {
    if (user?.name) {
      const parts = user.name.trim().split(' ').filter(p => p.length > 0);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return user.name.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  // Insights state for Android dashboard
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthDropdownVisible, setMonthDropdownVisible] = useState(false);
  const [selectedRange, setSelectedRange] = useState(2);
  const [rangeDropdownVisible, setRangeDropdownVisible] = useState(false);

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

  // Range options for Analysis dropdown
  const rangeOptions = [
    { label: 'Past 2 months', value: 2 },
    { label: 'Past 3 months', value: 3 },
    { label: 'Past 4 months', value: 4 },
    { label: 'Past 5 months', value: 5 },
    { label: 'Past 6 months', value: 6 },
  ];

  const selectedMonthLabel = getLastSixMonths().find(m => m.value === selectedMonth)?.label || 'Select Month';

  // Android Only - New Dashboard Layout
  if (Platform.OS === 'android') {
    return (
      <View style={[styles.container, { backgroundColor: '#FF6B35' }]}>
        {/* Orange Header Section */}
        <LinearGradient
          colors={['#FF8C5A', '#FF6B35', '#FF5722']}
          style={styles.androidHeader}
        >
          <StatusBar style="light" />
          {/* Top Bar */}
          <View style={styles.androidTopBar}>
            <Text style={styles.androidAppTitle}>SplitBill</Text>
            <TouchableOpacity 
              style={styles.androidProfileButton}
              onPress={() => setShowSettingsPanel(true)}
            >
              <Text style={styles.androidProfileInitials}>{getUserInitials()}</Text>
            </TouchableOpacity>
          </View>
          
          {/* Logo - without text */}
          <View style={styles.androidLogoContainer}>
            <Logo isMobile={true} hideText={true} />
          </View>
        </LinearGradient>

        {/* Native Mobile: Settings Panel */}
        <MobileSettingsPanel
          visible={showSettingsPanel}
          onClose={() => setShowSettingsPanel(false)}
          onViewProfile={handleMobileViewProfile}
          onHelpCenter={handleHelpCenter}
          onLogout={handleLogoutPress}
        />

        {/* Logout Confirmation Modal */}
        <LogoutModal
          visible={showLogoutModal}
          onCancel={handleLogoutCancel}
          onConfirm={handleLogoutConfirm}
        />

        {/* Image Processing Modal */}
        <Modal
          visible={isProcessingImage || !!processingError}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            if (processingError) {
              setProcessingError(null);
            }
          }}
        >
          <View style={styles.processingModalOverlay}>
            <View style={styles.processingModalContent}>
              {isProcessingImage && !processingError && (
                <>
                  <ActivityIndicator size="large" color="#FF6B35" />
                  <Text style={styles.processingModalTitle}>Please wait a moment</Text>
                  <Text style={styles.processingModalText}>The image is processing....</Text>
                </>
              )}
              {processingError && (
                <>
                  <Ionicons name="warning-outline" size={48} color="#E53935" />
                  <Text style={styles.processingModalTitle}>Processing Failed</Text>
                  <Text style={styles.processingModalText}>{processingError}</Text>
                  <TouchableOpacity 
                    style={styles.processingModalButton}
                    onPress={() => setProcessingError(null)}
                  >
                    <Text style={styles.processingModalButtonText}>OK</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Month Selection Modal */}
        <Modal
          visible={monthDropdownVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMonthDropdownVisible(false)}
        >
          <Pressable 
            style={styles.androidModalOverlay} 
            onPress={() => setMonthDropdownVisible(false)}
          >
            <View style={styles.androidDropdownModal}>
              <Text style={styles.androidDropdownModalTitle}>Select Month</Text>
              {getLastSixMonths().map((month) => (
                <TouchableOpacity
                  key={month.value}
                  style={[
                    styles.androidDropdownOption,
                    selectedMonth === month.value && styles.androidDropdownOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedMonth(month.value);
                    setMonthDropdownVisible(false);
                  }}
                >
                  <Text style={[
                    styles.androidDropdownOptionText,
                    selectedMonth === month.value && styles.androidDropdownOptionTextSelected
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

        {/* Range Selection Modal for Analysis */}
        <Modal
          visible={rangeDropdownVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setRangeDropdownVisible(false)}
        >
          <Pressable 
            style={styles.androidModalOverlay} 
            onPress={() => setRangeDropdownVisible(false)}
          >
            <View style={styles.androidDropdownModal}>
              <Text style={styles.androidDropdownModalTitle}>Select Duration</Text>
              {rangeOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.androidDropdownOption,
                    selectedRange === option.value && styles.androidDropdownOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedRange(option.value);
                    setRangeDropdownVisible(false);
                  }}
                >
                  <Text style={[
                    styles.androidDropdownOptionText,
                    selectedRange === option.value && styles.androidDropdownOptionTextSelected
                  ]}>
                    {option.label}
                  </Text>
                  {selectedRange === option.value && (
                    <Ionicons name="checkmark" size={20} color="#FF6B35" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>

        {/* White Panel with Scrollable Content */}
        <View style={styles.androidWhitePanel}>
          <ScrollView 
            style={styles.androidScrollView}
            contentContainerStyle={styles.androidScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Action Buttons Row */}
            <View style={styles.androidActionButtonsRow}>
              <TouchableOpacity style={styles.androidActionButton} onPress={handleCustomSplit}>
                <View style={styles.androidActionIconContainer}>
                  <Ionicons name="calculator-outline" size={28} color="#FF6B35" />
                </View>
                <Text style={styles.androidActionButtonText}>Custom</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.androidActionButton} onPress={handleUploadImage}>
                <View style={styles.androidActionIconContainer}>
                  <Ionicons name="camera-outline" size={28} color="#FF6B35" />
                </View>
                <Text style={styles.androidActionButtonText}>Upload Photo</Text>
              </TouchableOpacity>
            </View>

            {/* Expense Insights Section */}
            <View style={styles.androidSectionCard}>
              <View style={styles.androidSectionHeader}>
                <Text style={styles.androidSectionTitle}>Expense Insights</Text>
                <TouchableOpacity 
                  style={styles.androidDropdown}
                  onPress={() => setMonthDropdownVisible(true)}
                >
                  <Text style={styles.androidDropdownText} numberOfLines={1}>
                    {selectedMonthLabel.split(' ')[0].substring(0, 3)} {selectedMonthLabel.split(' ')[1]}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#666" />
                </TouchableOpacity>
              </View>
              
              {/* Pie Chart with Categories */}
              <View style={styles.androidPieChartSection}>
                {/* Donut Chart */}
                <View style={styles.androidDonutChart}>
                  {/* Colored segments - placeholder ring */}
                  <View style={styles.androidDonutOuter}>
                    <View style={[styles.androidDonutSegment, { backgroundColor: '#FF6B35', transform: [{ rotate: '0deg' }] }]} />
                    <View style={[styles.androidDonutSegment, { backgroundColor: '#4CAF50', transform: [{ rotate: '72deg' }] }]} />
                    <View style={[styles.androidDonutSegment, { backgroundColor: '#2196F3', transform: [{ rotate: '144deg' }] }]} />
                    <View style={[styles.androidDonutSegment, { backgroundColor: '#9C27B0', transform: [{ rotate: '216deg' }] }]} />
                    <View style={[styles.androidDonutSegment, { backgroundColor: '#607D8B', transform: [{ rotate: '288deg' }] }]} />
                  </View>
                  {/* Center circle with total */}
                  <View style={styles.androidDonutCenter}>
                    <Text style={styles.androidDonutTotalLabel}>Total</Text>
                    <Text style={styles.androidDonutTotalAmount}>₹0</Text>
                  </View>
                </View>

                {/* Category Legend */}
                <View style={styles.androidCategoryLegend}>
                  <View style={styles.androidLegendItem}>
                    <View style={[styles.androidLegendDot, { backgroundColor: '#FF6B35' }]} />
                    <Text style={styles.androidLegendText}>Food</Text>
                  </View>
                  <View style={styles.androidLegendItem}>
                    <View style={[styles.androidLegendDot, { backgroundColor: '#4CAF50' }]} />
                    <Text style={styles.androidLegendText}>Travel</Text>
                  </View>
                  <View style={styles.androidLegendItem}>
                    <View style={[styles.androidLegendDot, { backgroundColor: '#2196F3' }]} />
                    <Text style={styles.androidLegendText}>Entertainment</Text>
                  </View>
                  <View style={styles.androidLegendItem}>
                    <View style={[styles.androidLegendDot, { backgroundColor: '#9C27B0' }]} />
                    <Text style={styles.androidLegendText}>Shopping</Text>
                  </View>
                  <View style={styles.androidLegendItem}>
                    <View style={[styles.androidLegendDot, { backgroundColor: '#607D8B' }]} />
                    <Text style={styles.androidLegendText}>Other</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.androidNoDataText}>No data</Text>
            </View>

            {/* Analysis Section */}
            <View style={styles.androidSectionCard}>
              <View style={styles.androidSectionHeader}>
                <Text style={styles.androidSectionTitle}>Analysis</Text>
                <TouchableOpacity 
                  style={styles.androidDropdown}
                  onPress={() => setRangeDropdownVisible(true)}
                >
                  <Text style={styles.androidDropdownText}>Past {selectedRange} months</Text>
                  <Ionicons name="chevron-down" size={16} color="#666" />
                </TouchableOpacity>
              </View>
              
              {/* Bar Chart Placeholder */}
              <View style={styles.androidChartContainer}>
                <View style={styles.androidBarChartPlaceholder}>
                  <View style={[styles.androidBar, { height: 40 }]} />
                  <View style={[styles.androidBar, { height: 60 }]} />
                  <View style={[styles.androidBar, { height: 30 }]} />
                  <View style={[styles.androidBar, { height: 50 }]} />
                  <View style={[styles.androidBar, { height: 45 }]} />
                </View>
                <Text style={styles.androidNoDataText}>No data</Text>
              </View>
            </View>

            {/* Summary Section */}
            <View style={styles.androidSectionCard}>
              <Text style={styles.androidSectionTitle}>Summary</Text>
              <View style={styles.androidSummaryContent}>
                <Ionicons name="analytics-outline" size={32} color="#CCC" />
                <Text style={styles.androidNoDataText}>No data</Text>
                <Text style={styles.androidSummaryHint}>
                  Your spending insights will appear here once you start tracking expenses
                </Text>
              </View>
            </View>

            {/* Bottom spacing for tab bar */}
            <View style={{ height: 100 }} />
          </ScrollView>
        </View>

        {/* Native Mobile: Bottom Tab Bar */}
        <MobileBottomTabBar 
          navigation={navigation}
          onScanImage={handleScanImage}
        />
      </View>
    );
  }

  // Web Layout (desktop and mobile web)
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FF8C5A', '#FF6B35', '#FF5722', '#E64A19']}
        locations={[0, 0.3, 0.7, 1]}
        style={styles.gradient}
      >
        <StatusBar style="light" />
        
        {/* Header Bar - Menu on Left (Web only), Profile/Settings on Right */}
        <View style={styles.headerBar}>
          {/* Hamburger Menu - Left (Web including mobile web) */}
          {!isNativeMobile ? (
            <TouchableOpacity
              style={styles.menuIconButton}
              onPress={() => setShowSidePanel(true)}
              activeOpacity={0.8}
            >
              <View style={styles.menuIconCircle}>
                <View style={styles.menuIcon}>
                  <View style={styles.menuBar} />
                  <View style={styles.menuBar} />
                  <View style={styles.menuBar} />
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerPlaceholder} />
          )}
          
          {/* Right Icon - Profile with initials (Native Mobile) or Profile dropdown (Web) */}
          {isNativeMobile ? (
            <TouchableOpacity
              style={styles.profileIconButton}
              onPress={() => setShowSettingsPanel(true)}
              activeOpacity={0.8}
            >
              <View style={styles.profileIconCircle}>
                <Text style={styles.profileIconText}>{getUserInitials()}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.profileIconButton}
              onPress={() => setShowProfileMenu(!showProfileMenu)}
              activeOpacity={0.8}
            >
              <View style={styles.profileIconCircle}>
                <Text style={styles.profileIconText}>{getUserInitials()}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>


        {/* Native Mobile: Settings Panel (Right) - Contains Profile, Help Center, Logout */}
        {isNativeMobile && (
          <MobileSettingsPanel
            visible={showSettingsPanel}
            onClose={() => setShowSettingsPanel(false)}
            onViewProfile={handleMobileViewProfile}
            onHelpCenter={handleHelpCenter}
            onLogout={handleLogoutPress}
          />
        )}

        {/* Logout Confirmation Modal (both Web and Mobile) */}
        <LogoutModal
          visible={showLogoutModal}
          onCancel={handleLogoutCancel}
          onConfirm={handleLogoutConfirm}
        />

        {/* Image Processing Modal */}
        <Modal
          visible={isProcessingImage || !!processingError}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            if (processingError) {
              setProcessingError(null);
            }
          }}
        >
          <View style={styles.processingModalOverlay}>
            <View style={styles.processingModalContent}>
              {isProcessingImage && !processingError && (
                <>
                  <ActivityIndicator size="large" color="#FF6B35" />
                  <Text style={styles.processingModalTitle}>Please wait a moment</Text>
                  <Text style={styles.processingModalText}>The image is processing....</Text>
                </>
              )}
              {processingError && (
                <>
                  <Ionicons name="warning-outline" size={48} color="#E53935" />
                  <Text style={styles.processingModalTitle}>Processing Failed</Text>
                  <Text style={styles.processingModalText}>{processingError}</Text>
                  <TouchableOpacity 
                    style={styles.processingModalButton}
                    onPress={() => setProcessingError(null)}
                  >
                    <Text style={styles.processingModalButtonText}>OK</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Web: Side Panel with all tabs (including mobile web) */}
        {!isNativeMobile && (
          <WebSidePanel
            visible={showSidePanel}
            onClose={() => setShowSidePanel(false)}
            onGroups={() => {
              setShowSidePanel(false);
              navigation.navigate('Groups', { fromSidePanel: true });
            }}
            onAwaiting={() => {
              setShowSidePanel(false);
              navigation.navigate('Awaiting', { fromSidePanel: true });
            }}
            onPendingExpenses={() => {
              setShowSidePanel(false);
              navigation.navigate('PendingExpenses', { fromSidePanel: true });
            }}
            onHistory={() => {
              setShowSidePanel(false);
              navigation.navigate('History', { fromSidePanel: true });
            }}
          />
        )}

        {/* Web: Profile Dropdown Menu (including mobile web) */}
        {!isNativeMobile && (
          <WebProfileMenu
            visible={showProfileMenu}
            onClose={() => setShowProfileMenu(false)}
            onViewProfile={handleViewProfile}
            onHelpCenter={handleHelpCenter}
            onLogout={handleWebLogout}
          />
        )}
        
        {/* Animated Background elements */}
        <DecorativeCircles />
        <FloatingEmojis />
        
        {/* Main content */}
        <View style={[styles.content, isMobileLayout && styles.contentMobile]}>
          <Logo isMobile={isMobileLayout} />
          
          <View style={[styles.optionsContainer, isMobileLayout && styles.optionsContainerMobile]}>
            <TouchableOpacity 
              style={[styles.optionCard, isMobileLayout && styles.optionCardMobile]} 
              onPress={handleCustomSplit}
              activeOpacity={0.9}
            >
              <View style={[styles.optionIcon, isMobileLayout && styles.optionIconMobile]}>
                <Text style={[styles.iconText, isMobileLayout && styles.iconTextMobile]}>🧮</Text>
              </View>
              <Text style={[styles.optionTitle, isMobileLayout && styles.optionTitleMobile]}>Add Custom Split</Text>
              <Text style={[styles.optionDesc, isMobileLayout && styles.optionDescMobile]} numberOfLines={1}>Enter expense amount manually</Text>
              <View style={[styles.cardArrow, isMobileLayout && styles.cardArrowMobile]}>
                <Text style={styles.arrowText}>›</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.optionCard, isMobileLayout && styles.optionCardMobile]} 
              onPress={handleUploadImage}
              activeOpacity={0.9}
            >
              <View style={[styles.optionIcon, isMobileLayout && styles.optionIconMobile]}>
                <Text style={[styles.iconText, isMobileLayout && styles.iconTextMobile]}>📷</Text>
              </View>
              <Text style={[styles.optionTitle, isMobileLayout && styles.optionTitleMobile]}>Upload Image</Text>
              <Text style={[styles.optionDesc, isMobileLayout && styles.optionDescMobile]} numberOfLines={1}>Import a bill photo</Text>
              <View style={[styles.cardArrow, isMobileLayout && styles.cardArrowMobile]}>
                <Text style={styles.arrowText}>›</Text>
              </View>
            </TouchableOpacity>
          </View>
          
          {/* Bottom tagline */}
          <View style={[styles.bottomTagline, isMobileLayout && styles.bottomTaglineMobile]}>
            <Text style={[styles.bottomText, isMobileLayout && styles.bottomTextMobile]}>No more awkward calculations 🎉</Text>
          </View>
        </View>

        {/* Native Mobile: Bottom Tab Bar - rendered last to be on top */}
        {isNativeMobile && (
          <MobileBottomTabBar 
            navigation={navigation}
            onScanImage={handleScanImage}
          />
        )}
      </LinearGradient>
    </View>
  );
}

// Loading Screen Component with Spinning Logo
function LoadingScreen() {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Spinning animation
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Scale pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.loadingContainer}>
      <LinearGradient
        colors={['#FF8C5A', '#FF6B35', '#FF5722', '#E64A19']}
        locations={[0, 0.3, 0.7, 1]}
        style={styles.gradient}
      >
        <View style={styles.loadingContent}>
          <Animated.View 
            style={[
              styles.logoCircle,
              { 
                transform: [
                  { rotate: spin },
                  { scale: scaleAnim }
                ] 
              }
            ]}
          >
            <Text style={styles.logoText}>
              <Text style={styles.logoS}>S</Text>
              <Text style={styles.logoB}>B</Text>
            </Text>
          </Animated.View>
          <Text style={styles.loadingAppName}>SplitBill</Text>
          <View style={styles.loadingDotsContainer}>
            <LoadingDots />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

// Animated Loading Dots
function LoadingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot, delay) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay(600 - delay),
        ])
      ).start();
    };

    animateDot(dot1, 0);
    animateDot(dot2, 200);
    animateDot(dot3, 400);
  }, []);

  return (
    <View style={styles.loadingDots}>
      <Animated.View style={[styles.loadingDot, { opacity: dot1, transform: [{ scale: Animated.add(1, Animated.multiply(dot1, 0.3)) }] }]} />
      <Animated.View style={[styles.loadingDot, { opacity: dot2, transform: [{ scale: Animated.add(1, Animated.multiply(dot2, 0.3)) }] }]} />
      <Animated.View style={[styles.loadingDot, { opacity: dot3, transform: [{ scale: Animated.add(1, Animated.multiply(dot3, 0.3)) }] }]} />
    </View>
  );
}

// Auth-aware Login Screen wrapper
// Redirects to Home if already authenticated
function AuthAwareLoginScreen({ navigation }) {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // User is authenticated, redirect to Home
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    }
  }, [isAuthenticated, isLoading, navigation]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  // If authenticated, show loading while redirecting
  if (isAuthenticated) {
    return <LoadingScreen />;
  }

  return <LoginScreen navigation={navigation} />;
}

// Navigation Container with Auth Logic
function AppNavigator() {
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    if (initialNotificationScreen && navigationRef.isReady()) {
      navigationRef.navigate(initialNotificationScreen);
      initialNotificationScreen = null;
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const screen = response.notification.request.content.data?.screen;
      if (screen && navigationRef.isReady()) {
        navigationRef.navigate(screen);
      }
    });

    return () => subscription.remove();
  }, [isAuthenticated]);

  const handleNavReady = () => {
    if (isAuthenticated && initialNotificationScreen) {
      setTimeout(() => {
        if (navigationRef.isReady()) {
          navigationRef.navigate(initialNotificationScreen);
          initialNotificationScreen = null;
        }
      }, 100);
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  const linking = getLinkedScreens(isAuthenticated);

  return (
    <NavigationContainer 
      ref={navigationRef} 
      linking={linking}
      onReady={handleNavReady}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
        initialRouteName={isAuthenticated ? 'Home' : 'Login'}
      >
        <Stack.Screen name="Login" component={AuthAwareLoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
        <Stack.Screen name="Groups" component={GroupsScreen} />
        <Stack.Screen name="Awaiting" component={AwaitingScreen} />
        <Stack.Screen name="PendingExpenses" component={PendingExpensesScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="BillScan" component={BillScanScreen} />
        <Stack.Screen name="SplitOptions" component={SplitOptionsScreen} />
        <Stack.Screen name="SelectGroup" component={SelectGroupScreen} />
        <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
        <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
        <Stack.Screen name="GroupPreview" component={GroupPreviewScreen} />
        <Stack.Screen name="BillSplitPreview" component={BillSplitPreviewScreen} />
        <Stack.Screen name="SplitSummary" component={SplitSummaryScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Update Banner Component - shows when an update is available
function UpdateBanner({ visible, onUpdate, isUpdating }) {
  if (!visible) return null;
  
  return (
    <TouchableOpacity 
      style={styles.updateBanner}
      onPress={onUpdate}
      disabled={isUpdating}
      activeOpacity={0.9}
    >
      <View style={styles.updateBannerContent}>
        <Text style={styles.updateBannerIcon}>{isUpdating ? '⏳' : '🎉'}</Text>
        <View style={styles.updateBannerTextContainer}>
          <Text style={styles.updateBannerTitle}>
            {isUpdating ? 'Updating...' : 'Update Available!'}
          </Text>
          <Text style={styles.updateBannerSubtitle}>
            {isUpdating ? 'Please wait...' : 'Tap to get the latest version'}
          </Text>
        </View>
        {!isUpdating && (
          <View style={styles.updateBannerButton}>
            <Text style={styles.updateBannerButtonText}>Update</Text>
          </View>
        )}
        {isUpdating && (
          <ActivityIndicator size="small" color="#FF6B35" />
        )}
      </View>
    </TouchableOpacity>
  );
}

// Network-aware App Content
function AppContent() {
  const { isConnected } = useNetwork();
  const { isAuthenticated } = useAuth();
  const { clearStore } = useStore();
  const prevAuthRef = React.useRef(isAuthenticated);
  const appState = useRef(AppState.currentState);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Clear store cache on logout
  React.useEffect(() => {
    if (prevAuthRef.current && !isAuthenticated) {
      // User logged out - clear cached data
      clearStore();
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, clearStore]);
  
  // Check for OTA updates
  const checkForUpdates = async () => {
    // Skip update checks in development or on web
    if (__DEV__ || Platform.OS === 'web') return;
    
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        // Fetch the update in the background
        await Updates.fetchUpdateAsync();
        setUpdateAvailable(true);
      }
    } catch (error) {
      // Silently fail - don't interrupt user experience
      console.log('Update check failed:', error.message);
    }
  };
  
  // Handle update button press
  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await Updates.reloadAsync();
    } catch (error) {
      console.log('Update reload failed:', error.message);
      setIsUpdating(false);
    }
  };
  
  // Check for updates on app foreground and periodically
  useEffect(() => {
    // Check on initial mount
    checkForUpdates();
    
    // Check when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        checkForUpdates();
      }
      appState.current = nextAppState;
    });
    
    // Also check periodically (every 1 minute while app is active)
    const interval = setInterval(checkForUpdates, 1 * 60 * 1000);
    
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, []);
  
  // Keep AppNavigator mounted to preserve navigation state
  // Overlay NetworkErrorScreen when disconnected
  return (
    <View style={{ flex: 1 }}>
      <AppNavigator />
      {!isConnected && (
        <View style={StyleSheet.absoluteFill}>
          <NetworkErrorScreen />
        </View>
      )}
      {/* Update Banner - shows at top when update is available */}
      <UpdateBanner 
        visible={updateAvailable} 
        onUpdate={handleUpdate}
        isUpdating={isUpdating}
      />
    </View>
  );
}

// Bridge component to connect Auth and Network contexts
function AuthNetworkBridge({ children }) {
  const { initializeAuth } = useAuth();
  const { setAuthReinitCallback } = useNetwork();
  
  useEffect(() => {
    // Register the auth reinitialize callback with NetworkContext
    setAuthReinitCallback(initializeAuth);
    return () => setAuthReinitCallback(null);
  }, [initializeAuth, setAuthReinitCallback]);
  
  return children;
}

// Main App with Network and Auth Providers
export default function App() {
  return (
    <NetworkProvider>
      <AuthProvider>
        <AuthNetworkBridge>
          <StoreProvider>
            <AppContent />
          </StoreProvider>
        </AuthNetworkBridge>
      </AuthProvider>
    </NetworkProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: '100%',
    minWidth: '100%',
    ...(Platform.OS === 'web' && {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
    }),
  },
  gradient: {
    flex: 1,
    minHeight: '100%',
    minWidth: '100%',
    ...(Platform.OS === 'web' && {
      width: '100vw',
      height: '100vh',
    }),
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 10,
  },
  contentMobile: {
    paddingTop: 60,
    paddingBottom: 20,
    justifyContent: 'flex-start',
  },

  // Header Bar with Profile Icon
  headerBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : (Platform.OS === 'web' ? 20 : 50),
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 100,
  },
  menuIconButton: {
    position: 'relative',
  },
  menuIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  menuIcon: {
    width: 20,
    alignItems: 'center',
  },
  menuBar: {
    width: 20,
    height: 2,
    backgroundColor: '#FF6B35',
    borderRadius: 1,
    marginVertical: 2,
  },
  // Side Panel Styles
  sidePanelOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 200,
  },
  sidePanel: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 0 : (Platform.OS === 'ios' ? 60 : 50),
    left: 0,
    bottom: 0,
    width: Platform.OS === 'web' ? 300 : SCREEN_WIDTH * 0.65,
    maxWidth: Platform.OS === 'web' ? 300 : 260,
    backgroundColor: '#FFFFFF',
    zIndex: 201,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 20,
    borderTopRightRadius: Platform.OS === 'web' ? 0 : 20,
  },
  sidePanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 40 : 16,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sidePanelTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  sidePanelClose: {
    padding: 8,
  },
  sidePanelCloseText: {
    fontSize: 28,
    color: '#FF6B35',
    fontWeight: '400',
  },
  sidePanelMenu: {
    paddingVertical: 10,
  },
  sidePanelMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sidePanelMenuIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  sidePanelMenuText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  sidePanelMenuArrow: {
    fontSize: 24,
    color: '#FF6B35',
    fontWeight: '600',
  },
  settingsPanel: {
    right: 0,
    left: 'auto',
    borderTopRightRadius: 0,
    borderTopLeftRadius: Platform.OS === 'web' ? 0 : 20,
    borderBottomLeftRadius: Platform.OS === 'web' ? 0 : 20,
    bottom: Platform.OS === 'web' ? 0 : 90, // Stop above bottom tab bar on mobile
  },
  headerPlaceholder: {
    width: 48,
    height: 48,
  },
  logoutMenuItem: {
    borderBottomWidth: 0,
  },
  logoutIcon: {
    marginRight: 16,
  },
  logoutText: {
    color: '#DC3545',
  },
  // Logout Modal Styles
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  logoutModal: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    width: '80%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    ...(Platform.OS === 'web' && {
      maxWidth: 380,
      padding: 28,
    }),
  },
  logoutModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  logoutModalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  logoutModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  logoutModalButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      minWidth: 120,
    }),
  },
  logoutModalCancel: {
    backgroundColor: '#F5F5F5',
  },
  logoutModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  logoutModalConfirm: {
    backgroundColor: '#FF6B35',
  },
  logoutModalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  // Processing Modal Styles
  processingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingModalContent: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 32,
    width: '80%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  processingModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  processingModalText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  processingModalButton: {
    marginTop: 20,
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  processingModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  // Settings Icon Styles
  settingsIconButton: {
    position: 'relative',
  },
  settingsIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  settingsIconText: {
    fontSize: 22,
  },
  // Bottom Tab Bar Styles
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingBottom: Platform.OS === 'ios' ? 25 : 10,
    paddingTop: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 50,
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTabIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  bottomTabIconOrange: {
    fontSize: 24,
    marginBottom: 4,
  },
  bottomTabText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#666',
  },
  bottomTabTextOrange: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF6B35',
  },
  bottomTabCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -30,
  },
  bottomTabCenterButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomTabCenterIcon: {
    fontSize: 28,
  },
  // QR Code Icon styles
  qrCodeIcon: {
    width: 28,
    height: 28,
    position: 'relative',
  },
  qrCornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 10,
    height: 10,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#FFF',
    borderTopLeftRadius: 2,
  },
  qrCornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: '#FFF',
    borderTopRightRadius: 2,
  },
  qrCornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 10,
    height: 10,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#FFF',
    borderBottomLeftRadius: 2,
  },
  qrCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 8,
    height: 8,
    marginTop: -4,
    marginLeft: -4,
    backgroundColor: '#FFF',
    borderRadius: 2,
  },
  bottomTabCenterText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF6B35',
    marginTop: 4,
  },
  profileIconButton: {
    position: 'relative',
  },
  profileIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  profileIconText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B35',
  },
  profileIconImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
  },

  // Profile Menu Dropdown
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    zIndex: 98,
  },
  menuDropdown: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 108 : 88,
    right: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    minWidth: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
    zIndex: 999,
    paddingVertical: 8,
  },
  menuArrow: {
    position: 'absolute',
    top: -8,
    right: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFF',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuIcon: {
    fontSize: 18,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  menuChevron: {
    fontSize: 20,
    color: '#CCC',
    fontWeight: '300',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F5F5F5',
    marginHorizontal: 16,
    marginVertical: 4,
  },
  logoutItem: {
    marginTop: 4,
  },
  logoutIconContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  powerIcon: {
    fontSize: 20,
    color: '#FF3B30',
    fontWeight: '700',
  },
  logoutText: {
    color: '#FF3B30',
  },
  
  // Floating emojis
  floatingContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  floatingEmoji: {
    position: 'absolute',
    fontSize: 28,
  },
  
  
  // Background circles
  circlesContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  circle: {
    position: 'absolute',
    borderRadius: 1000,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  circle1: {
    width: 400,
    height: 400,
    top: -150,
    right: -150,
  },
  circle2: {
    width: 300,
    height: 300,
    bottom: 50,
    left: -120,
  },
  circle3: {
    width: 200,
    height: 200,
    bottom: -80,
    right: 30,
  },
  
  // Logo styles
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainerMobile: {
    marginTop: 10,
    marginBottom: 16,
  },
  logoGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    top: -20,
  },
  logoGlowMobile: {
    width: 120,
    height: 120,
    borderRadius: 60,
    top: -15,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 15,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  logoCircleMobile: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
  },
  logoText: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -3,
  },
  logoTextMobile: {
    fontSize: 36,
  },
  logoS: {
    color: '#FF6B35',
  },
  logoB: {
    color: '#E64A19',
  },
  title: {
    fontSize: 36,
    color: '#FFFFFF',
    fontWeight: '300',
    marginTop: 20,
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  titleMobile: {
    fontSize: 28,
    marginTop: 12,
  },
  titleBold: {
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 8,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  subtitleMobile: {
    fontSize: 9,
    marginTop: 12,
    letterSpacing: 1.5,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  taglineIcon: {
    fontSize: 20,
  },
  taglineIconMobile: {
    fontSize: 16,
  },
  taglineArrow: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  
  // Options styles
  optionsContainer: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 16,
    width: '100%',
    maxWidth: 500,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsContainerMobile: {
    flexDirection: 'column',
    gap: 12,
    maxWidth: '100%',
    paddingHorizontal: 16,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: Platform.OS === 'web' ? 260 : '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  optionCardMobile: {
    width: '100%',
    padding: 16,
    borderRadius: 20,
    marginBottom: 0,
  },
  optionIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#FF6B35',
  },
  optionIconMobile: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 10,
    borderWidth: 2,
  },
  iconText: {
    fontSize: 32,
  },
  iconTextMobile: {
    fontSize: 26,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  optionTitleMobile: {
    fontSize: 16,
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 30,
  },
  optionDescMobile: {
    fontSize: 12,
    marginBottom: 20,
  },
  cardArrow: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardArrowMobile: {
    width: 24,
    height: 24,
    borderRadius: 12,
    bottom: 8,
    right: 8,
  },
  arrowText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  
  // Bottom tagline
  bottomTagline: {
    marginTop: 32,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
  },
  bottomTaglineMobile: {
    marginTop: 16,
    marginBottom: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bottomText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomTextMobile: {
    fontSize: 13,
  },
  
  // Loading Screen
  loadingContainer: {
    flex: 1,
    minHeight: '100%',
    minWidth: '100%',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingAppName: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 20,
    letterSpacing: 1,
  },
  loadingDotsContainer: {
    marginTop: 30,
  },
  loadingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFF',
  },
  loadingText: {
    color: '#FFF',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '500',
  },
  
  // Update Banner Styles
  updateBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  updateBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  updateBannerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  updateBannerTextContainer: {
    flex: 1,
  },
  updateBannerTitle: {
    color: '#1A1A1A',
    fontSize: 15,
    fontWeight: '700',
  },
  updateBannerSubtitle: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  updateBannerButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  updateBannerButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // Android Dashboard Styles
  androidHeader: {
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 60,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    zIndex: 0,
  },
  androidTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  androidAppTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  androidProfileButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  androidProfileInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B35',
  },
  androidLogoContainer: {
    alignItems: 'center',
    marginTop: 5,
  },
  androidWhitePanel: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginTop: -30,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    zIndex: 10,
    elevation: 10,
  },
  androidScrollView: {
    flex: 1,
  },
  androidScrollContent: {
    padding: 20,
    paddingTop: 20,
    backgroundColor: '#FFFFFF',
  },
  androidActionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 15,
  },
  androidActionButton: {
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
  androidActionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  androidActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  androidSectionCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  androidSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  androidSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  androidDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  androidDropdownText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  androidChartContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  androidPieChartSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 15,
    paddingHorizontal: 10,
  },
  androidDonutChart: {
    width: 130,
    height: 130,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  androidDonutOuter: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  androidDonutSegment: {
    position: 'absolute',
    width: 65,
    height: 130,
    left: 65,
    transformOrigin: 'left center',
  },
  androidDonutCenter: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  androidDonutTotalLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  androidDonutTotalAmount: {
    fontSize: 18,
    color: '#333',
    fontWeight: '700',
    marginTop: 2,
  },
  androidCategoryLegend: {
    flex: 1,
    marginLeft: 20,
  },
  androidLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  androidLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  androidLegendText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  androidBarChartPlaceholder: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 80,
    gap: 15,
    marginBottom: 15,
  },
  androidBar: {
    width: 30,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
  },
  androidNoDataText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
  androidSummaryContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  androidSummaryHint: {
    fontSize: 13,
    color: '#AAA',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  androidModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  androidDropdownModal: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 10,
    width: '100%',
    maxWidth: 320,
  },
  androidDropdownModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  androidDropdownOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
  },
  androidDropdownOptionSelected: {
    backgroundColor: '#FFF5F0',
  },
  androidDropdownOptionText: {
    fontSize: 16,
    color: '#333',
  },
  androidDropdownOptionTextSelected: {
    color: '#FF6B35',
    fontWeight: '600',
  },
});
