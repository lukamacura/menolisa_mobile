/**
 * Expo config plugin: Android large screen support (Google Play requirement).
 * - Sets android:resizeableActivity="true" for multi-window and resizing on tablets/foldables/ChromeOS.
 * - Sets android:screenOrientation="fullUser" so orientation follows app.json "orientation": "default".
 * Run `npx expo prebuild` to apply. See app.config.js for plugin registration.
 */
const { withAndroidManifest } = require('@expo/config-plugins');
const { getMainActivity } = require('@expo/config-plugins/build/android/Manifest');

function withAndroidLargeScreen(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const mainActivity = getMainActivity(androidManifest);
    if (!mainActivity?.$) {
      return config;
    }

    mainActivity.$['android:resizeableActivity'] = 'true';
    mainActivity.$['android:screenOrientation'] = 'fullUser';

    return config;
  });
}

module.exports = withAndroidLargeScreen;
