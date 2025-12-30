import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Dimensions, Animated, Easing, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import HelpCenterScreen from './src/screens/HelpCenterScreen';
import LoginScreen from './src/screens/LoginScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';

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
    },
  },
});

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Animated Rolling Receipt on Left Side
function RollingBill() {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Floating animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Subtle rotation
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-12deg', '-8deg'],
  });

  return (
    <Animated.View style={[styles.billContainer, { transform: [{ translateY }, { rotate }] }]}>
      <View style={styles.bill}>
        <View style={styles.billHeader}>
          <Text style={styles.billRestaurant}>🍽️ RESTAURANT</Text>
          <Text style={styles.billDate}>Dec 29, 2024</Text>
        </View>
        
        <Text style={styles.dottedLine}>- - - - - - - - - - - - -</Text>
        
        <View style={styles.billItem}>
          <Text style={styles.billItemName}>Pizza</Text>
          <Text style={styles.billItemPrice}>$18.99</Text>
        </View>
        <View style={styles.billItem}>
          <Text style={styles.billItemName}>Pasta</Text>
          <Text style={styles.billItemPrice}>$14.50</Text>
        </View>
        <View style={styles.billItem}>
          <Text style={styles.billItemName}>Drinks x2</Text>
          <Text style={styles.billItemPrice}>$8.00</Text>
        </View>
        <View style={styles.billItem}>
          <Text style={styles.billItemName}>Dessert</Text>
          <Text style={styles.billItemPrice}>$9.99</Text>
        </View>
        
        <Text style={styles.dottedLine}>- - - - - - - - - - - - -</Text>
        
        <View style={styles.billItem}>
          <Text style={styles.billSubtotal}>Subtotal</Text>
          <Text style={styles.billSubtotal}>$51.48</Text>
        </View>
        <View style={styles.billItem}>
          <Text style={styles.billTax}>Tax</Text>
          <Text style={styles.billTax}>$4.63</Text>
        </View>
        
        <View style={styles.billTotalRow}>
          <Text style={styles.billTotal}>TOTAL</Text>
          <Text style={styles.billTotalAmount}>$56.11</Text>
        </View>
        
        <View style={styles.receiptTear}>
          <Text style={styles.tearPattern}>▼ ▼ ▼ ▼ ▼ ▼ ▼</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// Animated UPI Payment Success Phone on Right Side
function UPISuccess() {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Floating animation (opposite phase)
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Subtle rotation
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 3500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Pulse animation for success
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 15],
  });

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['12deg', '8deg'],
  });

  return (
    <Animated.View style={[styles.phoneContainer, { transform: [{ translateY }, { rotate }] }]}>
      <View style={styles.phone}>
        <View style={styles.phoneNotch} />
        
        <View style={styles.phoneScreen}>
          <Animated.View style={[styles.successCircle, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.successCheck}>✓</Text>
          </Animated.View>
          
          <Text style={styles.successText}>Payment</Text>
          <Text style={styles.successText}>Successful!</Text>
          
          <Text style={styles.successAmount}>₹ 1,400.00</Text>
          
          <View style={styles.upiLogo}>
            <Text style={styles.upiText}>UPI</Text>
          </View>
          
          <View style={styles.transactionDetails}>
            <Text style={styles.transactionText}>To: Restaurant</Text>
            <Text style={styles.transactionId}>ID: UPI123456</Text>
          </View>
          
          <Text style={styles.confetti1}>🎉</Text>
          <Text style={styles.confetti2}>✨</Text>
          <Text style={styles.confetti3}>🎊</Text>
        </View>
        
        <View style={styles.phoneHomeButton} />
      </View>
    </Animated.View>
  );
}

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
function Logo() {
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
    <View style={styles.logoContainer}>
      <View style={styles.logoGlow} />
      
      <Animated.View style={[styles.logoCircle, { transform: [{ scale: pulseAnim }] }]}>
        <Text style={styles.logoText}>
          <Text style={styles.logoS}>S</Text>
          <Text style={styles.logoB}>B</Text>
        </Text>
      </Animated.View>
      
      <Text style={styles.title}>Split<Text style={styles.titleBold}>Bill</Text></Text>
      <Text style={styles.subtitle}>Split smart. Pay fair.</Text>
      
      <View style={styles.taglineRow}>
        <Text style={styles.taglineIcon}>🧾</Text>
        <Text style={styles.taglineArrow}>→</Text>
        <Text style={styles.taglineIcon}>👥</Text>
        <Text style={styles.taglineArrow}>→</Text>
        <Text style={styles.taglineIcon}>✅</Text>
      </View>
    </View>
  );
}

// Profile Menu Dropdown Component
function ProfileMenu({ visible, onClose, onViewProfile, onHelpCenter, onLogout }) {
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

  const handleMenuPress = (action) => {
    action();
  };

  return (
    <>
      {/* Overlay to close menu */}
      <TouchableOpacity 
        style={styles.menuOverlay} 
        activeOpacity={1} 
        onPress={onClose}
      />
      
      {/* Dropdown Menu */}
      <Animated.View 
        style={[
          styles.menuDropdown,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Arrow pointer */}
        <View style={styles.menuArrow} />
        
        <TouchableOpacity 
          style={styles.menuItem} 
          onPress={() => handleMenuPress(onViewProfile)}
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
          onPress={() => handleMenuPress(onHelpCenter)}
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
          onPress={() => handleMenuPress(onLogout)}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconContainer, styles.logoutIconContainer]}>
            <Text style={styles.powerIcon}>⏻</Text>
          </View>
          <Text style={[styles.menuText, styles.logoutText]}>Logout</Text>
          <Text style={[styles.menuChevron, styles.logoutText]}>›</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

// Home Screen Component
function HomeScreen({ navigation }) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();

  const handleCustomSplit = () => {
    alert('Custom Split - Coming in Step 2!');
  };

  const handleUploadImage = () => {
    alert('Upload Image - Coming in Step 2!');
  };

  const handleViewProfile = () => {
    setShowProfileMenu(false);
    navigation.navigate('Profile');
  };

  const handleHelpCenter = () => {
    setShowProfileMenu(false);
    navigation.navigate('HelpCenter');
  };

  const handleLogout = async () => {
    setShowProfileMenu(false);
    await logout();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  // Get user initials for profile icon (max 2 characters)
  // "Sai Chaitanya Kumar" → "SK" (first + last name initial)
  const getUserInitials = () => {
    if (user?.name) {
      const parts = user.name.trim().split(' ').filter(p => p.length > 0);
      if (parts.length >= 2) {
        // First letter of first name + first letter of last name
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      // Just first 2 letters of the name
      return user.name.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FF8C5A', '#FF6B35', '#FF5722', '#E64A19']}
        locations={[0, 0.3, 0.7, 1]}
        style={styles.gradient}
      >
        <StatusBar style="light" />
        
        {/* Profile Icon - Top Right */}
        <View style={styles.headerBar}>
          <View style={styles.headerLeft} />
          <TouchableOpacity
            style={styles.profileIconButton}
            onPress={() => setShowProfileMenu(!showProfileMenu)}
            activeOpacity={0.8}
          >
            <View style={styles.profileIconCircle}>
              <Text style={styles.profileIconText}>{getUserInitials()}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Profile Dropdown Menu */}
        <ProfileMenu
          visible={showProfileMenu}
          onClose={() => setShowProfileMenu(false)}
          onViewProfile={handleViewProfile}
          onHelpCenter={handleHelpCenter}
          onLogout={handleLogout}
        />
        
        {/* Animated Background elements */}
        <DecorativeCircles />
        <FloatingEmojis />
        
        {/* Animated Rolling Bill on Left */}
        <RollingBill />
        
        {/* Animated UPI Success on Right */}
        <UPISuccess />
        
        {/* Main content */}
        <View style={styles.content}>
          <Logo />
          
          <View style={styles.optionsContainer}>
            <TouchableOpacity 
              style={styles.optionCard} 
              onPress={handleCustomSplit}
              activeOpacity={0.9}
            >
              <View style={styles.optionIcon}>
                <Text style={styles.iconText}>🧮</Text>
              </View>
              <Text style={styles.optionTitle}>Add Custom Split</Text>
              <Text style={styles.optionDesc}>Enter items manually</Text>
              <View style={styles.cardArrow}>
                <Text style={styles.arrowText}>→</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.optionCard} 
              onPress={handleUploadImage}
              activeOpacity={0.9}
            >
              <View style={styles.optionIcon}>
                <Text style={styles.iconText}>📷</Text>
              </View>
              <Text style={styles.optionTitle}>Upload Image</Text>
              <Text style={styles.optionDesc}>Import a bill photo</Text>
              <View style={styles.cardArrow}>
                <Text style={styles.arrowText}>→</Text>
              </View>
            </TouchableOpacity>
          </View>
          
          <View style={styles.bottomTagline}>
            <Text style={styles.bottomText}>No more awkward calculations 🎉</Text>
          </View>
        </View>
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

  if (isLoading) {
    return <LoadingScreen />;
  }

  // Get dynamic linking config based on auth state
  const linking = getLinkedScreens(isAuthenticated);

  return (
    <NavigationContainer linking={linking}>
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Main App with Auth Provider
export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
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

  // Header Bar with Profile Icon
  headerBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 100,
  },
  headerLeft: {
    width: 44,
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
  
  // Rolling Bill Styles (Left side)
  billContainer: {
    position: 'absolute',
    left: Platform.OS === 'web' ? 20 : -20,
    top: '12%',
    zIndex: 2,
  },
  bill: {
    width: 180,
    backgroundColor: '#FFFEF7',
    borderRadius: 4,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    opacity: 0.95,
  },
  billHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  billRestaurant: {
    fontSize: 12,
    fontWeight: '800',
    color: '#333',
    letterSpacing: 1,
  },
  billDate: {
    fontSize: 8,
    color: '#666',
    marginTop: 2,
  },
  dottedLine: {
    fontSize: 8,
    color: '#CCC',
    textAlign: 'center',
    marginVertical: 6,
    letterSpacing: 2,
  },
  billItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  billItemName: {
    fontSize: 10,
    color: '#444',
  },
  billItemPrice: {
    fontSize: 10,
    color: '#444',
    fontWeight: '600',
  },
  billSubtotal: {
    fontSize: 9,
    color: '#666',
  },
  billTax: {
    fontSize: 9,
    color: '#888',
  },
  billTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#DDD',
  },
  billTotal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#222',
  },
  billTotalAmount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FF6B35',
  },
  receiptTear: {
    marginTop: 8,
    alignItems: 'center',
  },
  tearPattern: {
    fontSize: 8,
    color: '#DDD',
    letterSpacing: 2,
  },
  
  // UPI Phone Styles (Right side)
  phoneContainer: {
    position: 'absolute',
    right: Platform.OS === 'web' ? 20 : -10,
    bottom: '15%',
    zIndex: 2,
  },
  phone: {
    width: 140,
    height: 280,
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 15,
    opacity: 0.95,
  },
  phoneNotch: {
    width: 50,
    height: 6,
    backgroundColor: '#000',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 4,
  },
  phoneScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  successCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  successCheck: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  successText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  successAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4CAF50',
    marginTop: 8,
  },
  upiLogo: {
    marginTop: 8,
    backgroundColor: '#5F259F',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  upiText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  transactionDetails: {
    marginTop: 10,
    alignItems: 'center',
  },
  transactionText: {
    fontSize: 8,
    color: '#666',
  },
  transactionId: {
    fontSize: 7,
    color: '#999',
    marginTop: 2,
  },
  confetti1: {
    position: 'absolute',
    top: 10,
    left: 10,
    fontSize: 12,
  },
  confetti2: {
    position: 'absolute',
    top: 15,
    right: 15,
    fontSize: 10,
  },
  confetti3: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    fontSize: 11,
  },
  phoneHomeButton: {
    width: 40,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    alignSelf: 'center',
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
  logoGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    top: -20,
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
  logoText: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -3,
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
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  taglineIcon: {
    fontSize: 20,
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
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: Platform.OS === 'web' ? 200 : '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
    position: 'relative',
    overflow: 'hidden',
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
  iconText: {
    fontSize: 32,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  cardArrow: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
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
  bottomText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
});
