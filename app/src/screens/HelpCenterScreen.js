import React, { useRef, useEffect } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';

export default function HelpCenterScreen() {
  const navigation = useNavigation();

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

  const handleCall = () => {
    Linking.openURL('tel:18007754824');
  };

  const handleEmail = () => {
    Linking.openURL('mailto:support@splitbill.app');
  };

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
              <Text style={styles.phoneNumber}>1800-SPLIT-BILL</Text>
              <Text style={styles.phoneSubtext}>(1800-775-4824)</Text>
            </Pressable>
            
            <Text style={styles.availability}>Available 24/7 • Toll Free</Text>
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
              <Text style={styles.emailText}>support@splitbill.app</Text>
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
    paddingTop: Platform.OS === 'ios' ? 65 : 50,
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
    fontSize: 20,
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

