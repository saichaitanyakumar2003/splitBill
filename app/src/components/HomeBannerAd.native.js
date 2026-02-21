import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform, Dimensions } from 'react-native';

const isAndroid = Platform.OS === 'android';
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function HomeBannerAd() {
  const [AdContent, setAdContent] = useState(null);

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
        // Prefer adaptive banner for full-width fit (API may be async)
        let size = BannerAdSize.BANNER;
        try {
          if (typeof BannerAdSize.getAnchoredAdaptiveBannerSize === 'function') {
            const adaptiveSize = await BannerAdSize.getAnchoredAdaptiveBannerSize(SCREEN_WIDTH);
            if (adaptiveSize) size = adaptiveSize;
          }
        } catch (_) {}
        if (!mounted) return;
        setAdContent(() => {
          const Wrapper = () => <BannerAd unitId={adUnitId} size={size} />;
          return Wrapper;
        });
      } catch (e) {
        if (__DEV__) console.warn('HomeBannerAd:', e?.message);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (!isAndroid || !AdContent) return null;
  const AdWrapper = AdContent;

  return (
    <View style={styles.container}>
      <AdWrapper />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginTop: 8,
  },
});
