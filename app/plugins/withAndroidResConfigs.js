/**
 * Expo config plugin to add resConfigs to Android defaultConfig.
 * Excludes invalid language resources (e.g. "cb", "fb" from third-party libs)
 * so the Play Store accepts the App Bundle.
 * @see https://developer.android.com/studio/build/shrink-code#unused-alt-resources
 */
const { withAppBuildGradle } = require('@expo/config-plugins');

function withAndroidResConfigs(config) {
  return withAppBuildGradle(config, (cfg) => {
    const buildGradle = cfg.modResults.contents;
    // Only include valid language resources; excludes invalid codes like "cb", "fb" from deps.
    // Use "en" only - aapt2 rejects "en-US" for the -c option.
    const resConfigsLine = '        resConfigs "en"';
    if (buildGradle.includes('resConfigs')) {
      return cfg;
    }
    // Insert resConfigs inside defaultConfig { ... }
    const defaultConfigRegex = /(defaultConfig\s*\{)/;
    const newContents = buildGradle.replace(
      defaultConfigRegex,
      `$1\n${resConfigsLine}`
    );
    cfg.modResults.contents = newContents;
    return cfg;
  });
}

module.exports = withAndroidResConfigs;
