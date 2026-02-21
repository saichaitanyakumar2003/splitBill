import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

const isAndroid = Platform.OS === 'android';

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
        // Keep small width (standard BANNER 320x50) so it doesn't overlap the logo
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
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
});
