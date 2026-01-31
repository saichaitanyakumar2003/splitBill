import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Easing,
  Platform,
  Linking,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import WebPullToRefresh from '../components/WebPullToRefresh';

const isAndroid = Platform.OS === 'android';

export default function HelpCenterScreen() {
  const navigation = useNavigation();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Pull to refresh state for mobile web
  const [refreshing, setRefreshing] = useState(false);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);

  // Detect mobile web
  const isMobileWeb = Platform.OS === 'web' && screenWidth < 768;

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

  const handleCall = () => {
    Linking.openURL('tel:+918688580861');
  };

  const handleEmail = () => {
    Linking.openURL('mailto:chettupallisaichaitanya@gmail.com');
  };

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
            <Text style={androidStyles.headerTitle}>Help Center</Text>
          </Animated.View>

          {/* Decorative Icon */}
          <Animated.View
            style={[
              androidStyles.decorativeIconContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={androidStyles.decorativeIconCircle}>
              <Ionicons name="help-circle-outline" size={40} color="#E85A24" />
            </View>
          </Animated.View>

          {/* White Content Area */}
          <View style={androidStyles.whiteContentArea}>
            <ScrollView
              style={androidStyles.scrollView}
              contentContainerStyle={androidStyles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Customer Care Card */}
              <Animated.View
                style={[
                  androidStyles.section,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                <View style={androidStyles.cardHeader}>
                  <Text style={androidStyles.cardIcon}>📞</Text>
                  <Text style={androidStyles.cardTitle}>Customer Care</Text>
                </View>
                
                <Pressable onPress={handleCall} style={androidStyles.clickableText}>
                  <Text style={androidStyles.phoneNumber}>+91 8688580861</Text>
                </Pressable>
                
                <Text style={androidStyles.availability}>Available Mon-Sat • 9 AM - 6 PM IST</Text>
              </Animated.View>

              {/* Email Support Card */}
              <Animated.View
                style={[
                  androidStyles.section,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                <View style={androidStyles.cardHeader}>
                  <Text style={androidStyles.cardIcon}>📧</Text>
                  <Text style={androidStyles.cardTitle}>Email Support</Text>
                </View>
                
                <Pressable onPress={handleEmail} style={androidStyles.clickableText}>
                  <Text style={androidStyles.emailText}>chettupallisaichaitanya@gmail.com</Text>
                </Pressable>
                
                <Text style={androidStyles.responseTime}>Response within 24 hours</Text>
              </Animated.View>

              {/* FAQ Section */}
              <Animated.View
                style={[
                  androidStyles.section,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                <View style={androidStyles.cardHeader}>
                  <Text style={androidStyles.cardIcon}>❓</Text>
                  <Text style={androidStyles.cardTitle}>Frequently Asked Questions</Text>
                </View>
                
                <View style={androidStyles.faqItem}>
                  <Text style={androidStyles.faqQuestion}>How do I split a bill?</Text>
                  <Text style={androidStyles.faqAnswer}>Simply scan your bill or add items manually, then assign each item to the people who shared it.</Text>
                </View>
                
                <View style={androidStyles.faqDivider} />
                
                <View style={androidStyles.faqItem}>
                  <Text style={androidStyles.faqQuestion}>Is my data secure?</Text>
                  <Text style={androidStyles.faqAnswer}>Yes! We use bank-level encryption to protect all your data and transactions.</Text>
                </View>
                
                <View style={androidStyles.faqDivider} />
                
                <View style={androidStyles.faqItem}>
                  <Text style={androidStyles.faqQuestion}>Can I use SplitBill offline?</Text>
                  <Text style={androidStyles.faqAnswer}>Yes, you can add and split bills offline. They'll sync when you're back online.</Text>
                </View>
              </Animated.View>

              {/* Social Media */}
              <Animated.View
                style={[
                  androidStyles.socialCard,
                  {
                    opacity: fadeAnim,
                  },
                ]}
              >
                <Text style={androidStyles.socialTitle}>Follow Us</Text>
                <View style={androidStyles.socialIcons}>
                  <Pressable style={androidStyles.socialButton}>
                    <Text style={androidStyles.socialIcon}>📘</Text>
                  </Pressable>
                  <Pressable style={androidStyles.socialButton}>
                    <Text style={androidStyles.socialIcon}>🐦</Text>
                  </Pressable>
                  <Pressable style={androidStyles.socialButton}>
                    <Text style={androidStyles.socialIcon}>📸</Text>
                  </Pressable>
                </View>
              </Animated.View>

              {/* Version */}
              <View style={androidStyles.versionContainer}>
                <Text style={androidStyles.versionText}>SplitBill v1.0.0</Text>
              </View>
            </ScrollView>
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
          <Text style={styles.headerTitle}>Help Center</Text>
        </Animated.View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Customer Care Card */}
          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>📞</Text>
              <Text style={styles.cardTitle}>Customer Care</Text>
            </View>
            
            <Pressable onPress={handleCall} style={styles.clickableText}>
              <Text style={styles.phoneNumber}>+91 8688580861</Text>
            </Pressable>
            
            <Text style={styles.availability}>Available Mon-Sat • 9 AM - 6 PM IST</Text>
          </Animated.View>

          {/* Email Support Card */}
          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>📧</Text>
              <Text style={styles.cardTitle}>Email Support</Text>
            </View>
            
            <Pressable onPress={handleEmail} style={styles.clickableText}>
              <Text style={styles.emailText}>chettupallisaichaitanya@gmail.com</Text>
            </Pressable>
            
            <Text style={styles.responseTime}>Response within 24 hours</Text>
          </Animated.View>

          {/* FAQ Section */}
          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>❓</Text>
              <Text style={styles.cardTitle}>Frequently Asked Questions</Text>
            </View>
            
            <View style={styles.faqItem}>
              <Text style={styles.faqQuestion}>How do I split a bill?</Text>
              <Text style={styles.faqAnswer}>Simply scan your bill or add items manually, then assign each item to the people who shared it.</Text>
            </View>
            
            <View style={styles.faqDivider} />
            
            <View style={styles.faqItem}>
              <Text style={styles.faqQuestion}>Is my data secure?</Text>
              <Text style={styles.faqAnswer}>Yes! We use bank-level encryption to protect all your data and transactions.</Text>
            </View>
            
            <View style={styles.faqDivider} />
            
            <View style={styles.faqItem}>
              <Text style={styles.faqQuestion}>Can I use SplitBill offline?</Text>
              <Text style={styles.faqAnswer}>Yes, you can add and split bills offline. They'll sync when you're back online.</Text>
            </View>
          </Animated.View>

          {/* Social Media */}
          <Animated.View
            style={[
              styles.socialCard,
              {
                opacity: fadeAnim,
              },
            ]}
          >
            <Text style={styles.socialTitle}>Follow Us</Text>
            <View style={styles.socialIcons}>
              <Pressable style={styles.socialButton}>
                <Text style={styles.socialIcon}>📘</Text>
              </Pressable>
              <Pressable style={styles.socialButton}>
                <Text style={styles.socialIcon}>🐦</Text>
              </Pressable>
              <Pressable style={styles.socialButton}>
                <Text style={styles.socialIcon}>📸</Text>
              </Pressable>
            </View>
          </Animated.View>

          {/* Version */}
          <View style={styles.versionContainer}>
            <Text style={styles.versionText}>SplitBill v1.0.0</Text>
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
    paddingTop: Platform.OS === 'ios' ? 65 : (Platform.OS === 'web' ? 20 : 50),
    paddingHorizontal: 20,
    paddingBottom: 16,
    zIndex: 100,
    backgroundColor: '#FF6B35',
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
    fontSize: 22,
    color: '#FFF',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  clickableText: {
    alignItems: 'center',
    marginBottom: 16,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  phoneNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FF6B35',
    textAlign: 'center',
    marginBottom: 4,
    textDecorationLine: 'underline',
  },
  phoneSubtext: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 16,
  },
  availability: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B35',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  responseTime: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
  faqItem: {
    paddingVertical: 12,
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  faqDivider: {
    height: 1,
    backgroundColor: '#EEE',
  },
  socialCard: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  socialTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 12,
  },
  socialIcons: {
    flexDirection: 'row',
    gap: 16,
  },
  socialButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  socialIcon: {
    fontSize: 24,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  versionText: {
    fontSize: 12,
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
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    zIndex: 100,
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
    marginLeft: 12,
  },
  decorativeIconContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: -20,
    zIndex: 10,
  },
  decorativeIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  whiteContentArea: {
    flex: 1,
    backgroundColor: '#FFF',
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
    paddingTop: 50,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
    paddingVertical: 8,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  clickableText: {
    alignItems: 'center',
    marginBottom: 16,
  },
  phoneNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FF6B35',
    textAlign: 'center',
    marginBottom: 4,
    textDecorationLine: 'underline',
  },
  availability: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B35',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  responseTime: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
  faqItem: {
    paddingVertical: 12,
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  faqDivider: {
    height: 1,
    backgroundColor: '#EEE',
  },
  socialCard: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  socialTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  socialIcons: {
    flexDirection: 'row',
    gap: 16,
  },
  socialButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialIcon: {
    fontSize: 24,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  versionText: {
    fontSize: 12,
    color: '#888',
  },
});

