import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Switch,
  Animated,
  Easing,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import WebPullToRefresh from '../components/WebPullToRefresh';

const isAndroid = Platform.OS === 'android';

export default function SettingsScreen() {
  const navigation = useNavigation();
  // Settings state
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [autoScan, setAutoScan] = useState(true);
  const [saveHistory, setSaveHistory] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [biometricLogin, setBiometricLogin] = useState(false);

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

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.back),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const SettingItem = ({ icon, title, subtitle, value, onValueChange, isSwitch = true }) => {
    const currentStyles = isAndroid ? androidStyles : styles;
    return (
      <View style={currentStyles.settingItem}>
        <View style={currentStyles.settingLeft}>
          <View style={currentStyles.settingIconContainer}>
            <Text style={currentStyles.settingIcon}>{icon}</Text>
          </View>
          <View style={currentStyles.settingInfo}>
            <Text style={currentStyles.settingTitle}>{title}</Text>
            {subtitle && <Text style={currentStyles.settingSubtitle}>{subtitle}</Text>}
          </View>
        </View>
        {isSwitch ? (
          <Switch
            value={value}
            onValueChange={onValueChange}
            trackColor={{ false: '#E0E0E0', true: '#FFCCBC' }}
            thumbColor={value ? '#FF6B35' : '#FFF'}
            ios_backgroundColor="#E0E0E0"
          />
        ) : (
          <Text style={currentStyles.settingArrow}>›</Text>
        )}
      </View>
    );
  };

  // Content sections to be shared between WebPullToRefresh and ScrollView
  const currentStyles = isAndroid ? androidStyles : styles;
  const scrollContent = (
    <>
      {/* Notifications Section */}
      <Animated.View
        style={[
          currentStyles.section,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={currentStyles.sectionTitle}>Notifications</Text>
        <View style={currentStyles.sectionCard}>
          <SettingItem
            icon="🔔"
            title="Push Notifications"
            subtitle="Get notified about bill splits"
            value={notifications}
            onValueChange={setNotifications}
          />
          <View style={currentStyles.divider} />
          <SettingItem
            icon="🔊"
            title="Sound Effects"
            subtitle="Play sounds on actions"
            value={soundEffects}
            onValueChange={setSoundEffects}
          />
        </View>
      </Animated.View>

      {/* Appearance Section */}
      <Animated.View
        style={[
          currentStyles.section,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={currentStyles.sectionTitle}>Appearance</Text>
        <View style={currentStyles.sectionCard}>
          <SettingItem
            icon="🌙"
            title="Dark Mode"
            subtitle="Switch to dark theme"
            value={darkMode}
            onValueChange={setDarkMode}
          />
        </View>
      </Animated.View>

      {/* Scanner Section */}
      <Animated.View
        style={[
          currentStyles.section,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={currentStyles.sectionTitle}>Scanner</Text>
        <View style={currentStyles.sectionCard}>
          <SettingItem
            icon="📷"
            title="Auto Scan"
            subtitle="Automatically scan when camera opens"
            value={autoScan}
            onValueChange={setAutoScan}
          />
          <View style={currentStyles.divider} />
          <SettingItem
            icon="📜"
            title="Save Scan History"
            subtitle="Keep a record of scanned bills"
            value={saveHistory}
            onValueChange={setSaveHistory}
          />
        </View>
      </Animated.View>

      {/* Security Section */}
      <Animated.View
        style={[
          currentStyles.section,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={currentStyles.sectionTitle}>Security</Text>
        <View style={currentStyles.sectionCard}>
          <SettingItem
            icon="🔐"
            title="Biometric Login"
            subtitle="Use Face ID / Fingerprint"
            value={biometricLogin}
            onValueChange={setBiometricLogin}
          />
          <View style={currentStyles.divider} />
          <TouchableOpacity style={currentStyles.settingItem}>
            <View style={currentStyles.settingLeft}>
              <View style={currentStyles.settingIconContainer}>
                <Text style={currentStyles.settingIcon}>🔑</Text>
              </View>
              <View style={currentStyles.settingInfo}>
                <Text style={currentStyles.settingTitle}>Change Password</Text>
                <Text style={currentStyles.settingSubtitle}>Update your password</Text>
              </View>
            </View>
            <Text style={currentStyles.settingArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* About Section */}
      <Animated.View
        style={[
          currentStyles.section,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={currentStyles.sectionTitle}>About</Text>
        <View style={currentStyles.sectionCard}>
          <TouchableOpacity style={currentStyles.settingItem}>
            <View style={currentStyles.settingLeft}>
              <View style={currentStyles.settingIconContainer}>
                <Text style={currentStyles.settingIcon}>📄</Text>
              </View>
              <View style={currentStyles.settingInfo}>
                <Text style={currentStyles.settingTitle}>Terms of Service</Text>
              </View>
            </View>
            <Text style={currentStyles.settingArrow}>›</Text>
          </TouchableOpacity>
          <View style={currentStyles.divider} />
          <TouchableOpacity style={currentStyles.settingItem}>
            <View style={currentStyles.settingLeft}>
              <View style={currentStyles.settingIconContainer}>
                <Text style={currentStyles.settingIcon}>🔒</Text>
              </View>
              <View style={currentStyles.settingInfo}>
                <Text style={currentStyles.settingTitle}>Privacy Policy</Text>
              </View>
            </View>
            <Text style={currentStyles.settingArrow}>›</Text>
          </TouchableOpacity>
          <View style={currentStyles.divider} />
          <View style={currentStyles.settingItem}>
            <View style={currentStyles.settingLeft}>
              <View style={currentStyles.settingIconContainer}>
                <Text style={currentStyles.settingIcon}>ℹ️</Text>
              </View>
              <View style={currentStyles.settingInfo}>
                <Text style={currentStyles.settingTitle}>Version</Text>
              </View>
            </View>
            <Text style={currentStyles.versionText}>1.0.0</Text>
          </View>
        </View>
      </Animated.View>

      {/* Danger Zone */}
      <Animated.View
        style={[
          currentStyles.section,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={[currentStyles.sectionTitle, currentStyles.dangerTitle]}>Danger Zone</Text>
        <View style={[currentStyles.sectionCard, currentStyles.dangerCard]}>
          <TouchableOpacity style={currentStyles.settingItem}>
            <View style={currentStyles.settingLeft}>
              <View style={[currentStyles.settingIconContainer, currentStyles.dangerIconContainer]}>
                <Text style={currentStyles.settingIcon}>🗑️</Text>
              </View>
              <View style={currentStyles.settingInfo}>
                <Text style={[currentStyles.settingTitle, currentStyles.dangerText]}>Delete Account</Text>
                <Text style={currentStyles.settingSubtitle}>Permanently delete your account</Text>
              </View>
            </View>
            <Text style={[currentStyles.settingArrow, currentStyles.dangerText]}>›</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <View style={currentStyles.footer}>
        <Text style={currentStyles.footerText}>Made with ❤️ by SplitBill Team</Text>
      </View>
    </>
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
          <Animated.View
            style={[
              androidStyles.header,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Pressable 
              style={({ pressed }) => [
                androidStyles.backButton,
                pressed && androidStyles.backButtonPressed,
              ]} 
              onPress={() => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Home' }],
                });
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {({ pressed }) => (
                <Ionicons 
                  name="arrow-back" 
                  size={24} 
                  color="#E85A24" 
                  style={pressed && { opacity: 0.7 }}
                />
              )}
            </Pressable>
            <Text style={androidStyles.headerTitle}>Settings</Text>
            <View style={androidStyles.headerRight} />
          </Animated.View>

          {/* Decorative icon */}
          <View style={androidStyles.decorativeIconContainer}>
            <View style={androidStyles.decorativeIconCircle}>
              <Ionicons name="settings-outline" size={40} color="#E85A24" />
            </View>
          </View>

          {/* White content area */}
          <View style={androidStyles.whiteContentArea}>
            {isMobileWeb ? (
              <WebPullToRefresh
                onRefresh={handleRefresh}
                refreshing={refreshing}
                contentContainerStyle={androidStyles.scrollContent}
                scrollViewProps={{
                  style: androidStyles.scrollView,
                  showsVerticalScrollIndicator: false,
                }}
              >
                {scrollContent}
              </WebPullToRefresh>
            ) : (
              <ScrollView
                style={androidStyles.scrollView}
                contentContainerStyle={androidStyles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {scrollContent}
              </ScrollView>
            )}
          </View>
        </LinearGradient>
      </View>
    );
  }

  // Original layout for Web/iOS
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FF8C5A', '#FF6B35', '#FF5722', '#E64A19']}
        locations={[0, 0.3, 0.7, 1]}
        style={styles.gradient}
      >
        <StatusBar style="light" />

        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Pressable 
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]} 
            onPress={() => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {({ pressed }) => (
              <Text style={[styles.backIcon, pressed && { opacity: 0.7 }]}>{Platform.OS === 'web' ? '←' : '<'}</Text>
            )}
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.headerRight} />
        </Animated.View>

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
            {scrollContent}
          </WebPullToRefresh>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {scrollContent}
          </ScrollView>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    }),
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 65 : (Platform.OS === 'web' ? 20 : 55),
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  backButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    transform: [{ scale: 0.95 }],
  },
  backIcon: {
    fontSize: 24,
    color: '#FFF',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  headerRight: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingIcon: {
    fontSize: 20,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  settingArrow: {
    fontSize: 24,
    color: '#CCC',
    fontWeight: '300',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 70,
  },
  versionText: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  dangerTitle: {
    color: 'rgba(255, 200, 200, 0.9)',
  },
  dangerCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  dangerIconContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  dangerText: {
    color: '#FF3B30',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  footerText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
});

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
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonPressed: {
    backgroundColor: '#F5F5F5',
    transform: [{ scale: 0.95 }],
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
    marginTop: -20,
    marginBottom: 20,
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
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  whiteContentArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingIcon: {
    fontSize: 20,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  settingArrow: {
    fontSize: 24,
    color: '#CCC',
    fontWeight: '300',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 70,
  },
  versionText: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  dangerTitle: {
    color: '#FF6B6B',
  },
  dangerCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  dangerIconContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  dangerText: {
    color: '#FF3B30',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  footerText: {
    fontSize: 13,
    color: '#888',
  },
});

