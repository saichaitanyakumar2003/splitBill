import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Animated,
  Share,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';

const ANIMATION_DURATION = 4000; // Animation stops after 4 seconds

// Party Balloon Component
function PartyBalloon({ left, delay, color, isAnimating }) {
  const floatAnim = useRef(new Animated.Value(800)).current;
  const swayAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isAnimating) return;
    
    const timeout = setTimeout(() => {
      // Float up animation
      Animated.parallel([
        Animated.timing(floatAnim, {
          toValue: -100,
          duration: 3000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        // Sway side to side
        Animated.loop(
          Animated.sequence([
            Animated.timing(swayAnim, {
              toValue: 1,
              duration: 800,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(swayAnim, {
              toValue: -1,
              duration: 800,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ])
        ),
      ]).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, [isAnimating]);

  const translateX = swayAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-20, 20],
  });

  if (!isAnimating) return null;

  return (
    <Animated.View
      style={[
        styles.balloon,
        {
          left,
          transform: [
            { translateY: floatAnim },
            { translateX },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <View style={[styles.balloonBody, { backgroundColor: color }]}>
        <View style={styles.balloonShine} />
      </View>
      <View style={[styles.balloonKnot, { backgroundColor: color }]} />
      <View style={styles.balloonString} />
    </Animated.View>
  );
}

// Party Popper/Bomb Component
function PartyPopper({ left, top, delay, isAnimating }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isAnimating) return;
    
    const timeout = setTimeout(() => {
      Animated.sequence([
        // Pop in
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1.2,
            friction: 3,
            tension: 100,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        // Bounce back
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          useNativeDriver: true,
        }),
        // Rotate and fade
        Animated.parallel([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 1500,
            delay: 500,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, [isAnimating]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!isAnimating) return null;

  return (
    <Animated.View
      style={[
        styles.popper,
        {
          left,
          top,
          transform: [{ scale: scaleAnim }, { rotate }],
          opacity: opacityAnim,
        },
      ]}
    >
      <Text style={styles.popperEmoji}>💥</Text>
    </Animated.View>
  );
}

// Confetti Burst Component
function ConfettiBurst({ isAnimating }) {
  const confettiItems = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    startX: '50%',
    angle: (i / 40) * 360,
    color: ['#FF6B35', '#FFD700', '#FF69B4', '#00CED1', '#9370DB', '#32CD32', '#FF4500', '#00FF7F'][i % 8],
    delay: Math.random() * 300,
    distance: 150 + Math.random() * 200,
  }));

  return (
    <View style={styles.confettiBurstContainer} pointerEvents="none">
      {confettiItems.map(item => (
        <ConfettiParticle key={item.id} {...item} isAnimating={isAnimating} />
      ))}
    </View>
  );
}

function ConfettiParticle({ angle, color, delay, distance, isAnimating }) {
  const moveAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isAnimating) return;
    
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(moveAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, [isAnimating]);

  const radians = (angle * Math.PI) / 180;
  const translateX = moveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.cos(radians) * distance],
  });
  const translateY = moveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.sin(radians) * distance + 100], // Add gravity effect
  });
  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${720 + Math.random() * 360}deg`],
  });

  if (!isAnimating) return null;

  return (
    <Animated.View
      style={[
        styles.confettiParticle,
        {
          backgroundColor: color,
          transform: [{ translateX }, { translateY }, { rotate }],
          opacity: opacityAnim,
        },
      ]}
    />
  );
}

// Main Party Animation Container
function PartyAnimations({ isAnimating }) {
  const balloons = [
    { left: '10%', delay: 0, color: '#FF6B35' },
    { left: '25%', delay: 200, color: '#FFD700' },
    { left: '40%', delay: 400, color: '#FF69B4' },
    { left: '55%', delay: 300, color: '#00CED1' },
    { left: '70%', delay: 500, color: '#9370DB' },
    { left: '85%', delay: 100, color: '#32CD32' },
  ];

  const poppers = [
    { left: '15%', top: '20%', delay: 100 },
    { left: '75%', top: '15%', delay: 300 },
    { left: '30%', top: '40%', delay: 500 },
    { left: '60%', top: '35%', delay: 200 },
    { left: '85%', top: '50%', delay: 400 },
    { left: '10%', top: '55%', delay: 600 },
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <ConfettiBurst isAnimating={isAnimating} />
      {balloons.map((balloon, i) => (
        <PartyBalloon key={i} {...balloon} isAnimating={isAnimating} />
      ))}
      {poppers.map((popper, i) => (
        <PartyPopper key={i} {...popper} isAnimating={isAnimating} />
      ))}
    </View>
  );
}

export default function SplitSummaryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [copied, setCopied] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);
  
  const { groupName, consolidatedExpenses = [], groupId } = route.params || {};
  
  // Animation for success checkmark
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Stop party animations after 4 seconds
    const animationTimer = setTimeout(() => {
      setIsAnimating(false);
    }, ANIMATION_DURATION);
    
    return () => clearTimeout(animationTimer);
  }, []);

  const handleGoHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  const getSummaryText = () => {
    let text = `🎉 Split Summary - ${groupName}\n\n`;
    text += `Who owes whom:\n`;
    text += `─────────────────\n`;
    consolidatedExpenses.forEach(exp => {
      text += `${exp.fromName} → ${exp.toName}: ₹${parseFloat(exp.amount).toFixed(2)}\n`;
    });
    text += `─────────────────\n`;
    text += `\nSplit with SplitBill App! 📱`;
    return text;
  };

  const handleCopy = async () => {
    const text = getSummaryText();
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const text = getSummaryText();
    try {
      await Share.share({
        message: text,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  // Redirect to home if params missing
  if (!groupName || !consolidatedExpenses) {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
    return null;
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FF8C5A', '#FF6B35', '#FF5722', '#E64A19']}
        locations={[0, 0.3, 0.7, 1]}
        style={styles.gradient}
      >
        <StatusBar style="light" />
        
        {/* Party Animations - Balloons and Bombs */}
        <PartyAnimations isAnimating={isAnimating} />

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Success Icon */}
          <Animated.View style={[styles.successIcon, { transform: [{ scale: scaleAnim }] }]}>
            <Text style={styles.successEmoji}>🎉</Text>
          </Animated.View>

          <Animated.Text style={[styles.title, { opacity: fadeAnim }]}>
            Split Created!
          </Animated.Text>

          <Animated.Text style={[styles.groupName, { opacity: fadeAnim }]}>
            {groupName}
          </Animated.Text>

          {/* Summary Card */}
          <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
            <Text style={styles.cardTitle}>Who Owes Whom</Text>
            
            {consolidatedExpenses.length > 0 ? (
              <View style={styles.expensesList}>
                {consolidatedExpenses.map((exp, index) => (
                  <View key={index} style={styles.expenseRow}>
                    <View style={styles.expenseNames}>
                      <Text style={styles.fromName}>{exp.fromName}</Text>
                      <Text style={styles.arrow}>→</Text>
                      <Text style={styles.toName}>{exp.toName}</Text>
                    </View>
                    <Text style={styles.expenseAmount}>₹{parseFloat(exp.amount).toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.settledContainer}>
                <Text style={styles.settledEmoji}>✅</Text>
                <Text style={styles.settledText}>Everyone is settled up!</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton} onPress={handleCopy}>
                <Text style={styles.actionIcon}>{copied ? '✓' : '📋'}</Text>
                <Text style={styles.actionText}>{copied ? 'Copied!' : 'Copy'}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                <Text style={styles.actionIcon}>📤</Text>
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Go to Home Button */}
          <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
            <Text style={styles.homeButtonText}>Go to Home Page</Text>
          </TouchableOpacity>
        </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  // Balloon styles
  balloon: {
    position: 'absolute',
    alignItems: 'center',
  },
  balloonBody: {
    width: 50,
    height: 60,
    borderRadius: 25,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  balloonShine: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 15,
    height: 15,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  balloonKnot: {
    width: 12,
    height: 10,
    borderRadius: 6,
    marginTop: -2,
  },
  balloonString: {
    width: 2,
    height: 60,
    backgroundColor: '#999',
  },
  // Party popper styles
  popper: {
    position: 'absolute',
  },
  popperEmoji: {
    fontSize: 50,
  },
  // Confetti burst styles
  confettiBurstContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    top: '30%',
  },
  confettiParticle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  successIcon: {
    marginBottom: 20,
  },
  successEmoji: {
    fontSize: 80,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 30,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  expensesList: {
    marginBottom: 20,
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  expenseNames: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fromName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  arrow: {
    fontSize: 16,
    color: '#FF6B35',
    marginHorizontal: 10,
    fontWeight: '700',
  },
  toName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B35',
  },
  settledContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  settledEmoji: {
    fontSize: 50,
    marginBottom: 10,
  },
  settledText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#28A745',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  actionButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  homeButton: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  homeButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FF6B35',
  },
});

