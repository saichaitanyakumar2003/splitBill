import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import WebPullToRefresh from '../components/WebPullToRefresh';

const ANIMATION_DURATION = 4000; // Animation stops after 4 seconds
const isAndroid = Platform.OS === 'android';

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
  const [showSettlements, setShowSettlements] = useState(false);
  
  const { groupName, consolidatedExpenses = [], groupId, expenses = [] } = route.params || {};
  
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
      const result = await Share.share(
        {
          message: text,
          title: `Split Summary - ${groupName}`, // Shows as title on Android share sheet
        },
        {
          // Android specific options
          dialogTitle: `Share Split Summary`, // Title of the share dialog on Android
        }
      );
      
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // Shared with specific activity (iOS)
          console.log('Shared via:', result.activityType);
        } else {
          // Shared on Android
          console.log('Shared successfully');
        }
      } else if (result.action === Share.dismissedAction) {
        // Dismissed (iOS only)
        console.log('Share dismissed');
      }
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

  // Content without card wrapper (for Android)
  const contentWithoutCard = (
    <>
      {/* Action Icons - Top Right */}
      <View style={androidStyles.cardActions}>
        <TouchableOpacity 
          style={[styles.cardActionIcon, copied && styles.cardActionIconCopied]} 
          onPress={handleCopy}
        >
          {copied ? (
            <Text style={styles.copiedText}>Copied!</Text>
          ) : (
            <View style={styles.copyIcon}>
              <View style={styles.copyRect} />
              <View style={styles.copyRectBack} />
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.cardActionIcon} onPress={handleShare}>
          <View style={styles.shareIconContainer}>
            {/* Arrow pointing up */}
            <View style={styles.shareArrow} />
            <View style={styles.shareArrowHead} />
            {/* Box base */}
            <View style={styles.shareBox} />
          </View>
        </TouchableOpacity>
      </View>

      {!showSettlements ? (
        <>
          <Text style={styles.cardTitle}>Expenses Added ({expenses.length})</Text>
          
          {expenses.length > 0 ? (
            <ScrollView 
              style={styles.expensesScrollView}
              contentContainerStyle={styles.expensesScrollContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {expenses.map((exp, index) => (
                <View key={index} style={styles.addedExpenseRow}>
                  <View style={styles.addedExpenseInfo}>
                    <Text style={styles.addedExpenseTitle} numberOfLines={1}>{exp.title}</Text>
                    <Text style={styles.addedExpensePaidBy} numberOfLines={1}>
                      Paid by {exp.paidByName} • {exp.memberCount} member{exp.memberCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={styles.addedExpenseAmount}>₹{parseFloat(exp.totalAmount).toFixed(2)}</Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.settledContainer}>
              <Text style={styles.settledEmoji}>📝</Text>
              <Text style={styles.settledText}>No expenses added</Text>
            </View>
          )}

          {/* Link to view settlements */}
          <TouchableOpacity 
            style={styles.viewSettlementsLink}
            onPress={() => setShowSettlements(true)}
          >
            <Text style={styles.viewSettlementsText}>View Final Settlements →</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.cardTitle}>Who Owes Whom</Text>
          
          {consolidatedExpenses.length > 0 ? (
            <ScrollView 
              style={styles.expensesScrollView}
              contentContainerStyle={styles.expensesScrollContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {consolidatedExpenses.map((exp, index) => (
                <View key={index} style={styles.expenseRow}>
                  <View style={styles.expenseNames}>
                    <Text style={styles.fromName} numberOfLines={1}>{exp.fromName}</Text>
                    <Text style={styles.arrow}>→</Text>
                    <Text style={styles.toName} numberOfLines={1}>{exp.toName}</Text>
                  </View>
                  <Text style={styles.expenseAmount}>₹{parseFloat(exp.amount).toFixed(2)}</Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.settledContainer}>
              <Text style={styles.settledEmoji}>✅</Text>
              <Text style={styles.settledText}>Everyone is settled up!</Text>
            </View>
          )}

          {/* Link to go back to expenses */}
          <TouchableOpacity 
            style={styles.viewSettlementsLink}
            onPress={() => setShowSettlements(false)}
          >
            <Text style={styles.viewSettlementsText}>← View Expenses Added</Text>
          </TouchableOpacity>
        </>
      )}
    </>
  );

  // Scroll content to be shared between WebPullToRefresh and ScrollView
  const scrollContent = (
    <>
      {/* Success Icon */}
      <Animated.View style={[styles.successIcon, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.successEmoji}>🎉</Text>
      </Animated.View>

      <Animated.Text style={[styles.title, { opacity: fadeAnim }]}>
        Split Created!
      </Animated.Text>

      <Animated.Text style={[styles.groupName, { opacity: fadeAnim }]} numberOfLines={1}>
        {groupName}
      </Animated.Text>

      {/* Summary Card */}
      <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
        {/* Action Icons - Top Right */}
        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={[styles.cardActionIcon, copied && styles.cardActionIconCopied]} 
            onPress={handleCopy}
          >
            {copied ? (
              <Text style={styles.copiedText}>Copied!</Text>
            ) : (
              <View style={styles.copyIcon}>
                <View style={styles.copyRect} />
                <View style={styles.copyRectBack} />
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.cardActionIcon} onPress={handleShare}>
            <View style={styles.shareIconContainer}>
              {/* Arrow pointing up */}
              <View style={styles.shareArrow} />
              <View style={styles.shareArrowHead} />
              {/* Box base */}
              <View style={styles.shareBox} />
            </View>
          </TouchableOpacity>
        </View>

        {!showSettlements ? (
          <>
            <Text style={styles.cardTitle}>Expenses Added ({expenses.length})</Text>
            
            {expenses.length > 0 ? (
              <ScrollView 
                style={styles.expensesScrollView}
                contentContainerStyle={styles.expensesScrollContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {expenses.map((exp, index) => (
                  <View key={index} style={styles.addedExpenseRow}>
                    <View style={styles.addedExpenseInfo}>
                      <Text style={styles.addedExpenseTitle} numberOfLines={1}>{exp.title}</Text>
                      <Text style={styles.addedExpensePaidBy} numberOfLines={1}>
                        Paid by {exp.paidByName} • {exp.memberCount} member{exp.memberCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Text style={styles.addedExpenseAmount}>₹{parseFloat(exp.totalAmount).toFixed(2)}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.settledContainer}>
                <Text style={styles.settledEmoji}>📝</Text>
                <Text style={styles.settledText}>No expenses added</Text>
              </View>
            )}

            {/* Link to view settlements */}
            <TouchableOpacity 
              style={styles.viewSettlementsLink}
              onPress={() => setShowSettlements(true)}
            >
              <Text style={styles.viewSettlementsText}>View Final Settlements →</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.cardTitle}>Who Owes Whom</Text>
            
            {consolidatedExpenses.length > 0 ? (
              <ScrollView 
                style={styles.expensesScrollView}
                contentContainerStyle={styles.expensesScrollContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {consolidatedExpenses.map((exp, index) => (
                  <View key={index} style={styles.expenseRow}>
                    <View style={styles.expenseNames}>
                      <Text style={styles.fromName} numberOfLines={1}>{exp.fromName}</Text>
                      <Text style={styles.arrow}>→</Text>
                      <Text style={styles.toName} numberOfLines={1}>{exp.toName}</Text>
                    </View>
                    <Text style={styles.expenseAmount}>₹{parseFloat(exp.amount).toFixed(2)}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.settledContainer}>
                <Text style={styles.settledEmoji}>✅</Text>
                <Text style={styles.settledText}>Everyone is settled up!</Text>
              </View>
            )}

            {/* Link to go back to expenses */}
            <TouchableOpacity 
              style={styles.viewSettlementsLink}
              onPress={() => setShowSettlements(false)}
            >
              <Text style={styles.viewSettlementsText}>← View Expenses Added</Text>
            </TouchableOpacity>
          </>
        )}
      </Animated.View>

      {/* Go to Home Button */}
      <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
        <Text style={styles.homeButtonText}>Go to Home Page</Text>
      </TouchableOpacity>
    </>
  );

  // Android-specific layout
  if (isAndroid) {
    return (
      <View style={androidStyles.container}>
        <LinearGradient
          colors={['#F57C3A', '#E85A24', '#D84315']}
          style={androidStyles.headerGradient}
        >
          <StatusBar style="light" />
          
          {/* Back Button */}
          <TouchableOpacity 
            style={androidStyles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#E85A24" />
          </TouchableOpacity>

          {/* Header Title */}
          <Text style={androidStyles.headerTitle}>Summary</Text>

          {/* Decorative Icon */}
          <View style={androidStyles.decorativeIconContainer}>
            <Ionicons name="checkmark-done-outline" size={26} color="#E85A24" />
          </View>
        </LinearGradient>

        {/* White Content Area with Curved Top */}
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
              <Animated.View style={{ opacity: fadeAnim }}>
                {contentWithoutCard}
              </Animated.View>
              {/* Go to Home Button */}
              <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
                <Text style={styles.homeButtonText}>Go to Home Page</Text>
              </TouchableOpacity>
            </WebPullToRefresh>
          ) : (
            <ScrollView 
              style={androidStyles.scrollView}
              contentContainerStyle={androidStyles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Animated.View style={{ opacity: fadeAnim }}>
                {contentWithoutCard}
              </Animated.View>
              {/* Go to Home Button */}
              <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
                <Text style={styles.homeButtonText}>Go to Home Page</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    );
  }

  // Web/iOS - Original design unchanged
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
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 85 : (Platform.OS === 'web' ? 20 : 65),
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
    paddingTop: 50,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 24,
    position: 'relative',
  },
  cardActions: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    gap: 12,
    zIndex: 10,
  },
  cardActionIcon: {
    minWidth: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  cardActionIconCopied: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
  },
  copiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  copyIcon: {
    width: 18,
    height: 18,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyRect: {
    width: 12,
    height: 14,
    borderWidth: 2,
    borderColor: '#666',
    borderRadius: 2,
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#FFF',
  },
  copyRectBack: {
    width: 12,
    height: 14,
    borderWidth: 2,
    borderColor: '#666',
    borderRadius: 2,
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#F5F5F5',
  },
  shareIconContainer: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  shareArrow: {
    width: 2,
    height: 10,
    backgroundColor: '#666',
    position: 'absolute',
    top: 2,
  },
  shareArrowHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#666',
    position: 'absolute',
    top: 0,
  },
  shareBox: {
    width: 14,
    height: 10,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: '#666',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  expensesScrollView: {
    maxHeight: 250,
  },
  expensesScrollContent: {
    paddingBottom: 8,
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
    marginRight: 12,
    flexWrap: 'wrap',
  },
  fromName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flexShrink: 1,
  },
  arrow: {
    fontSize: 16,
    color: '#FF6B35',
    marginHorizontal: 8,
    fontWeight: '700',
  },
  toName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flexShrink: 1,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B35',
    flexShrink: 0,
    minWidth: 70,
    textAlign: 'right',
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
  // Added expense styles
  addedExpenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  addedExpenseInfo: {
    flex: 1,
    marginRight: 12,
  },
  addedExpenseTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  addedExpensePaidBy: {
    fontSize: 13,
    color: '#666',
  },
  addedExpenseAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B35',
    flexShrink: 0,
  },
  viewSettlementsLink: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  viewSettlementsText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF6B35',
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

const androidStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerGradient: {
    paddingTop: Platform.OS === 'android' ? 50 : 0,
    paddingBottom: 30,
    paddingHorizontal: 20,
    position: 'relative',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  decorativeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 5,
    marginBottom: -25,
    zIndex: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  whiteContentArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: 0,
    paddingTop: 40,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
    alignSelf: 'flex-end',
    marginBottom: 20,
    zIndex: 10,
  },
});

