/**
 * Custom Expo config plugin that injects Google AdMob App IDs into native projects.
 * Does NOT require "react-native-google-mobile-ads" in the config context, so it
 * won't break expo config / eas update / web builds (that package fails to load there).
 * Also injects rootProject.ext.googleMobileAdsJson so the library's Android build.gradle
 * can read android_app_id (avoids "Cannot get property 'googleMobileAdsJson'" build failure).
 */
const {
  withAndroidManifest,
  withInfoPlist,
  withProjectBuildGradle,
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

    // react-native-google-mobile-ads android/build.gradle expects rootProject.ext.googleMobileAdsJson
    // with getStringValue("android_app_id", "") and isFlagEnabled(...). Inject that so the build succeeds.
    config = withProjectBuildGradle(config, (cfg) => {
      const gradle = cfg.modResults.contents;
      const marker = '// AdMob ext.googleMobileAdsJson (withAdMobAppId plugin)';
      if (gradle.includes(marker)) return cfg;
      const appIdEscaped = androidAppId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const block = `
${marker}
ext.googleMobileAdsJson = new groovy.util.Expando(
  getStringValue: { String key, String defaultValue ->
    if (key == "android_app_id") return "${appIdEscaped}"
    return defaultValue
  },
  isFlagEnabled: { String key, boolean defaultValue ->
    return defaultValue
  }
)
`;
      cfg.modResults.contents = gradle.trimEnd() + block;
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
