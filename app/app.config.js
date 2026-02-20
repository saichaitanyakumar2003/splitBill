const base = require('./app.json');

// Custom AdMob plugin that only injects App IDs into native projects. We do NOT use
// the plugin from "react-native-google-mobile-ads" here — it fails to load during
// expo config / eas update / web (Unexpected token 'typeof'). The JS runtime still
// uses react-native-google-mobile-ads; only the config plugin is replaced.
const ADMOB_APP_IDS = {
  androidAppId: 'ca-app-pub-4564304850605749~7400225557',
  iosAppId: 'ca-app-pub-3940256099942544~1458002511',
};

module.exports = () => {
  const expo = { ...base.expo };
  expo.plugins = [
    ...(expo.plugins || []),
    ['./plugins/withAdMobAppId.js', ADMOB_APP_IDS],
  ];
  return { expo };
};
