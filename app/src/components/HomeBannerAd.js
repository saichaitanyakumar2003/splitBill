import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const isAndroid = Platform.OS === 'android';

export default function HomeBannerAd() {
  const [AdContent, setAdContent] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isAndroid) return;
    let mounted = true;
    (async () => {
      try {
        const pkg = require('react-native-google-mobile-ads');
        const { BannerAd, BannerAdSize } = pkg;
        await pkg.default().initialize();
        if (!mounted) return;
        const adUnitId = 'ca-app-pub-4564304850605749/4687256712';
        setAdContent(() => {
          const Wrapper = () => <BannerAd unitId={adUnitId} size={BannerAdSize.BANNER} />;
          return Wrapper;
        });
      } catch (e) {
        if (__DEV__) console.warn('HomeBannerAd:', e?.message);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (!isAndroid || !AdContent || dismissed) return null;
  const AdWrapper = AdContent;

  return (
    <View style={styles.container}>
      <View style={styles.bannerWrapper}>
        <AdWrapper />
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => setDismissed(true)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Close ad"
        >
          <Ionicons name="close" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  bannerWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
