import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  Animated,
  ActivityIndicator,
  Text,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';

const PULL_THRESHOLD = 70;
const INDICATOR_HEIGHT = 50;

/**
 * WebPullToRefresh - A ScrollView wrapper with pull-to-refresh for mobile web.
 * This component only activates on mobile web (Platform.OS === 'web' && narrow screen).
 * 
 * @param {Function} onRefresh - Async function to call when refresh is triggered
 * @param {boolean} refreshing - Whether refresh is currently in progress
 * @param {React.ReactNode} children - Content to display inside ScrollView
 * @param {boolean} enabled - Whether pull-to-refresh is enabled (default: true)
 * @param {Object} scrollViewProps - Additional props to pass to ScrollView
 * @param {Object} contentContainerStyle - Style for ScrollView content container
 */
export default function WebPullToRefresh({ 
  onRefresh, 
  refreshing = false, 
  children, 
  enabled = true,
  style,
  contentContainerStyle,
  scrollViewProps = {},
}) {
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const pullAnim = useRef(new Animated.Value(0)).current;
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [canPull, setCanPull] = useState(true);
  const startY = useRef(0);
  const scrollY = useRef(0);
  const scrollViewRef = useRef(null);
  
  // Only enable on mobile web (web platform with narrow screen < 768px)
  const isMobileWeb = Platform.OS === 'web' && screenWidth < 768;
  
  // Track screen width changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);
  
  const handleRefresh = useCallback(async () => {
    if (onRefresh && !refreshing) {
      await onRefresh();
    }
  }, [onRefresh, refreshing]);
  
  // Handle scroll to track position
  const handleScroll = useCallback((event) => {
    scrollY.current = event.nativeEvent.contentOffset.y;
    setCanPull(scrollY.current <= 0);
    
    // Call original onScroll if provided
    if (scrollViewProps.onScroll) {
      scrollViewProps.onScroll(event);
    }
  }, [scrollViewProps]);
  
  // Touch handlers for web
  const handleTouchStart = useCallback((event) => {
    if (!isMobileWeb || !enabled || refreshing || !canPull) return;
    startY.current = event.nativeEvent.touches?.[0]?.pageY || event.nativeEvent.pageY;
  }, [isMobileWeb, enabled, refreshing, canPull]);
  
  const handleTouchMove = useCallback((event) => {
    if (!isMobileWeb || !enabled || refreshing) return;
    
    const currentY = event.nativeEvent.touches?.[0]?.pageY || event.nativeEvent.pageY;
    const dy = currentY - startY.current;
    
    // Only start pulling if we're at the top and pulling down
    if (scrollY.current <= 0 && dy > 0) {
      setIsPulling(true);
      const resistance = 0.4;
      const newPullDistance = Math.min(dy * resistance, PULL_THRESHOLD + 30);
      
      setPullDistance(newPullDistance);
      pullAnim.setValue(newPullDistance);
      
      // Prevent default scroll when pulling
      if (dy > 10 && scrollY.current <= 0) {
        event.preventDefault?.();
      }
    }
  }, [isMobileWeb, enabled, refreshing, pullAnim]);
  
  const handleTouchEnd = useCallback(() => {
    if (!isPulling) return;
    
    setIsPulling(false);
    
    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      // Trigger refresh
      handleRefresh();
      
      // Animate to loading position
      Animated.timing(pullAnim, {
        toValue: INDICATOR_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      // Animate back to 0
      Animated.spring(pullAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 40,
        friction: 8,
      }).start();
    }
    
    setPullDistance(0);
  }, [isPulling, pullDistance, refreshing, handleRefresh, pullAnim]);
  
  // Reset animation when refreshing ends
  useEffect(() => {
    if (!refreshing && !isPulling) {
      Animated.spring(pullAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 40,
        friction: 8,
      }).start();
    }
  }, [refreshing, isPulling, pullAnim]);
  
  // If not mobile web, render regular ScrollView with native RefreshControl
  if (!isMobileWeb) {
    return (
      <ScrollView
        ref={scrollViewRef}
        style={style}
        contentContainerStyle={contentContainerStyle}
        {...scrollViewProps}
      >
        {children}
      </ScrollView>
    );
  }
  
  const indicatorOpacity = pullAnim.interpolate({
    inputRange: [0, PULL_THRESHOLD * 0.3, PULL_THRESHOLD],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });
  
  const indicatorScale = pullAnim.interpolate({
    inputRange: [0, PULL_THRESHOLD],
    outputRange: [0.6, 1],
    extrapolate: 'clamp',
  });
  
  return (
    <View style={[styles.container, style]}>
      {/* Pull indicator - positioned at top */}
      <Animated.View 
        style={[
          styles.indicatorContainer,
          {
            opacity: refreshing ? 1 : indicatorOpacity,
            transform: [
              { translateY: Animated.subtract(pullAnim, INDICATOR_HEIGHT) },
              { scale: refreshing ? 1 : indicatorScale },
            ],
          },
        ]}
      >
        <View style={styles.indicatorContent}>
          {refreshing ? (
            <>
              <ActivityIndicator size="small" color="#FF6B35" />
              <Text style={styles.indicatorText}>Refreshing...</Text>
            </>
          ) : pullDistance >= PULL_THRESHOLD ? (
            <>
              <Text style={styles.releaseIcon}>↑</Text>
              <Text style={styles.indicatorText}>Release to refresh</Text>
            </>
          ) : (
            <>
              <Text style={styles.pullIcon}>↓</Text>
              <Text style={styles.indicatorText}>Pull to refresh</Text>
            </>
          )}
        </View>
      </Animated.View>
      
      {/* ScrollView with touch handlers */}
      <Animated.View 
        style={[
          styles.scrollContainer,
          {
            transform: [{ translateY: isPulling || refreshing ? pullAnim : 0 }],
          },
        ]}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={contentContainerStyle}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          {...scrollViewProps}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

/**
 * Simple refresh button for mobile web - alternative to pull gesture
 * Can be added to screen headers for easier refresh access
 */
export function WebRefreshButton({ onRefresh, refreshing, style }) {
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isMobileWeb = Platform.OS === 'web' && screenWidth < 768;
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);
  
  // Only show on mobile web
  if (!isMobileWeb) return null;
  
  return (
    <View style={[styles.refreshButton, style]}>
      {refreshing ? (
        <ActivityIndicator size="small" color="#FF6B35" />
      ) : (
        <Text style={styles.refreshButtonText} onPress={onRefresh}>↻</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  indicatorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: INDICATOR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  indicatorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  indicatorText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  pullIcon: {
    fontSize: 18,
    color: '#FF6B35',
    fontWeight: '700',
  },
  releaseIcon: {
    fontSize: 18,
    color: '#28A745',
    fontWeight: '700',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButtonText: {
    fontSize: 20,
    color: '#FF6B35',
    fontWeight: '700',
  },
});
