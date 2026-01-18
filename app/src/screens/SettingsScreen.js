import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';

export default function SettingsScreen() {
  const navigation = useNavigation();
  // Settings state
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [autoScan, setAutoScan] = useState(true);
  const [saveHistory, setSaveHistory] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [biometricLogin, setBiometricLogin] = useState(false);

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

  const SettingItem = ({ icon, title, subtitle, value, onValueChange, isSwitch = true }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <View style={styles.settingIconContainer}>
          <Text style={styles.settingIcon}>{icon}</Text>
        </View>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
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
        <Text style={styles.settingArrow}>›</Text>
      )}
    </View>
  );

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

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Notifications Section */}
          <Animated.View
            style={[
              styles.section,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.sectionTitle}>Notifications</Text>
            <View style={styles.sectionCard}>
              <SettingItem
                icon="🔔"
                title="Push Notifications"
                subtitle="Get notified about bill splits"
                value={notifications}
                onValueChange={setNotifications}
              />
              <View style={styles.divider} />
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
              styles.section,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.sectionTitle}>Appearance</Text>
            <View style={styles.sectionCard}>
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
              styles.section,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.sectionTitle}>Scanner</Text>
            <View style={styles.sectionCard}>
              <SettingItem
                icon="📷"
                title="Auto Scan"
                subtitle="Automatically scan when camera opens"
                value={autoScan}
                onValueChange={setAutoScan}
              />
              <View style={styles.divider} />
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
              styles.section,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.sectionTitle}>Security</Text>
            <View style={styles.sectionCard}>
              <SettingItem
                icon="🔐"
                title="Biometric Login"
                subtitle="Use Face ID / Fingerprint"
                value={biometricLogin}
                onValueChange={setBiometricLogin}
              />
              <View style={styles.divider} />
              <TouchableOpacity style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <View style={styles.settingIconContainer}>
                    <Text style={styles.settingIcon}>🔑</Text>
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>Change Password</Text>
                    <Text style={styles.settingSubtitle}>Update your password</Text>
                  </View>
                </View>
                <Text style={styles.settingArrow}>›</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* About Section */}
          <Animated.View
            style={[
              styles.section,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.sectionCard}>
              <TouchableOpacity style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <View style={styles.settingIconContainer}>
                    <Text style={styles.settingIcon}>📄</Text>
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>Terms of Service</Text>
                  </View>
                </View>
                <Text style={styles.settingArrow}>›</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <View style={styles.settingIconContainer}>
                    <Text style={styles.settingIcon}>🔒</Text>
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>Privacy Policy</Text>
                  </View>
                </View>
                <Text style={styles.settingArrow}>›</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <View style={styles.settingIconContainer}>
                    <Text style={styles.settingIcon}>ℹ️</Text>
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>Version</Text>
                  </View>
                </View>
                <Text style={styles.versionText}>1.0.0</Text>
              </View>
            </View>
          </Animated.View>

          {/* Danger Zone */}
          <Animated.View
            style={[
              styles.section,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={[styles.sectionTitle, styles.dangerTitle]}>Danger Zone</Text>
            <View style={[styles.sectionCard, styles.dangerCard]}>
              <TouchableOpacity style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIconContainer, styles.dangerIconContainer]}>
                    <Text style={styles.settingIcon}>🗑️</Text>
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingTitle, styles.dangerText]}>Delete Account</Text>
                    <Text style={styles.settingSubtitle}>Permanently delete your account</Text>
                  </View>
                </View>
                <Text style={[styles.settingArrow, styles.dangerText]}>›</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Made with ❤️ by SplitBill Team</Text>
          </View>
        </ScrollView>
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

