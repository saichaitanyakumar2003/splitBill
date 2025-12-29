import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Dimensions, Animated, Easing } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

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

export default function App() {
  const handleCustomSplit = () => {
    alert('Custom Split - Coming in Step 2!');
  };

  const handleUploadImage = () => {
    alert('Upload Image - Coming in Step 2!');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FF8C5A', '#FF6B35', '#FF5722', '#E64A19']}
        locations={[0, 0.3, 0.7, 1]}
        style={styles.gradient}
      >
        <StatusBar style="light" />
        
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 10,
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
});
