/**
 * Custom Expo config plugin that injects Google AdMob App IDs into native projects.
 * Does NOT require "react-native-google-mobile-ads" in the config context, so it
 * won't break expo config / eas update / web builds (that package fails to load there).
 * The runtime JS from react-native-google-mobile-ads still runs in the app; only the
 * official plugin is replaced by this one.
 */
const {
  withAndroidManifest,
  withInfoPlist,
} = require('@expo/config-plugins');

const ANDROID_META_NAME = 'com.google.android.gms.ads.APPLICATION_ID';
const IOS_KEY = 'GADApplicationIdentifier';

function withAdMobAppId(config, options = {}) {
  const { androidAppId, iosAppId } = options;

  if (androidAppId) {
    config = withAndroidManifest(config, (cfg) => {
      const manifest = cfg.modResults;
      const application = manifest?.manifest?.application?.[0];
      if (application) {
        if (!application['meta-data']) {
          application['meta-data'] = [];
        }
        const hasAdMob = application['meta-data'].some(
          (m) => m?.$?.['android:name'] === ANDROID_META_NAME
        );
        if (!hasAdMob) {
          application['meta-data'].push({
            $: {
              'android:name': ANDROID_META_NAME,
              'android:value': androidAppId,
            },
          });
        }
      }
      return cfg;
    });
  }

  if (iosAppId) {
    config = withInfoPlist(config, (cfg) => {
      cfg.modResults[IOS_KEY] = iosAppId;
      return cfg;
    });
  }

  return config;
}

module.exports = withAdMobAppId;
