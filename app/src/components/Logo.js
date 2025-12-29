import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

export default function Logo({ size = 'large' }) {
  const isLarge = size === 'large';
  const containerSize = isLarge ? 120 : 60;
  const fontSize = isLarge ? 48 : 24;
  const subtitleSize = isLarge ? 16 : 10;

  return (
    <View style={styles.container}>
      <View style={[styles.logoContainer, { width: containerSize, height: containerSize }]}>
        {/* Outer glow ring */}
        <View style={[styles.glowRing, { width: containerSize + 20, height: containerSize + 20 }]} />
        
        {/* Main logo circle */}
        <LinearGradient
          colors={['#FFFFFF', '#F0F0F0']}
          style={[styles.logoCircle, { width: containerSize, height: containerSize, borderRadius: containerSize / 2 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={[styles.logoText, { fontSize }]}>
            <Text style={styles.logoS}>S</Text>
            <Text style={styles.logoB}>B</Text>
          </Text>
        </LinearGradient>

        {/* Decorative elements */}
        <View style={[styles.decorDot, styles.dotTopRight, { width: isLarge ? 12 : 6, height: isLarge ? 12 : 6 }]} />
        <View style={[styles.decorDot, styles.dotBottomLeft, { width: isLarge ? 8 : 4, height: isLarge ? 8 : 4 }]} />
      </View>

      {isLarge && (
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Split<Text style={styles.titleBold}>Bill</Text></Text>
          <Text style={styles.subtitle}>Split smart. Pay fair.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  logoContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  logoCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  logoText: {
    fontWeight: '800',
    letterSpacing: -2,
  },
  logoS: {
    color: '#FF6B35',
  },
  logoB: {
    color: '#E85A2A',
  },
  decorDot: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 10,
  },
  dotTopRight: {
    top: -5,
    right: -5,
  },
  dotBottomLeft: {
    bottom: 5,
    left: -2,
  },
  titleContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: '300',
    letterSpacing: 1,
  },
  titleBold: {
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});

