/**
 * Expo config — the single source of truth.
 *
 * This used to spread a static app.json and then redeclare `plugins`, which
 * replaced the whole array instead of extending it. The expo-notifications
 * entry lived only in app.json, so it was silently dropped from every build:
 * Android fell back to the default white-square notification icon. Everything
 * now lives here so there is no second file to drift out of sync with.
 */

/**
 * Cleartext HTTP exists only so local dev can reach the Next.js server on
 * http://<lan-ip>:3000. It must never be on in a store build, so it fails
 * closed — anything that is not an explicit `development` variant gets false.
 * npm scripts set APP_VARIANT=development; EAS sets it on the dev profile.
 */
const isDevelopmentVariant = process.env.APP_VARIANT === 'development';

module.exports = {
  expo: {
    name: 'MenoLisa',
    slug: 'womenreset-mobile',
    version: '1.3.1',
    orientation: 'default',
    icon: './assets/logo.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    scheme: 'menolisa',
    splash: {
      image: './assets/logo.png',
      resizeMode: 'contain',
      backgroundColor: '#E8E4F0',
    },
    // Root-level keys. These were nested under `android`, where Expo ignores
    // them entirely. Edge-to-edge already forces both bars transparent, so
    // `translucent`/`backgroundColor` are redundant here (and prebuild warns
    // that the status bar color conflicts with the splash background). What
    // does still matter is barStyle: the app renders no <StatusBar> component
    // anywhere, so without dark-content the system draws white icons over
    // MenoLisa's white background and they vanish.
    androidStatusBar: {
      barStyle: 'dark-content',
    },
    androidNavigationBar: {
      barStyle: 'dark-content',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.menolisa.app',
      associatedDomains: ['applinks:menolisa.com', 'applinks:www.menolisa.com'],
      infoPlist: {
        CFBundleDisplayName: 'MenoLisa',
        // Apple reads `ITSAppUsesNonExemptEncryption`. `ITSAppManagesNonExemptEncryption`
        // is not a key Apple defines, so it was silently ignored: every upload landed
        // in App Store Connect with the export-compliance question unanswered, and
        // TestFlight holds a build hostage until someone answers it by hand. 1.2.0
        // (build 22) shipped with the wrong name and needed that manual answer.
        ITSAppUsesNonExemptEncryption: false,
        // Without this the guided meditation stops the moment the screen locks
        // — which, on an eleven-minute recording she lies down for, is about a
        // minute in. `setAudioProfile('meditation')` asks for background
        // playback and iOS silently ignores the request unless the capability is
        // declared here, so the flag and this key only work as a pair.
        //
        // Adding it means the next store build needs a native rebuild (`npx
        // expo prebuild` / a fresh EAS build); it cannot ship over the air.
        UIBackgroundModes: ['audio'],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/logo.png',
        backgroundColor: '#E8E4F0',
      },
      package: 'com.menolisa.app',
      softwareKeyboardLayoutMode: 'pan',
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: 'menolisa.com',
              pathPrefix: '/auth',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      googleServicesFile: './google-services.json',
      // Expo's prebuild template adds these three; nothing in this app uses
      // them. There is no file picker, no media library and no download, and
      // SYSTEM_ALERT_WINDOW is only ever needed by React Native's dev-menu
      // overlay — the debug manifest re-declares it, so dev builds keep it and
      // only release drops it. Left in, Play lists the app as able to "display
      // over other apps", which is a bad look and an extra review question.
      blockedPermissions: [
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ],
    },
    notification: {
      icon: './assets/logo.png',
      color: '#ff8da1',
      androidMode: 'default',
      iosDisplayInForeground: true,
    },
    web: {
      favicon: './assets/logo.png',
    },
    extra: {
      eas: {
        projectId: '936ae9cc-0f77-4ed4-ab01-c949bb39bf03',
      },
    },
    plugins: [
      [
        'expo-build-properties',
        {
          android: {
            usesCleartextTraffic: isDevelopmentVariant,
            // Expo SDK 54 already defaults to 36, but Google Play requires
            // API 36 for all uploads from 31 Aug 2026, so pin it rather than
            // inherit it and discover the default moved during a release.
            compileSdkVersion: 36,
            targetSdkVersion: 36,
          },
          ios: {
            deploymentTarget: '15.1',
          },
        },
      ],
      './plugins/android-large-screen.js',
      'expo-asset',
      'expo-font',
      'expo-video',
      [
        // Playback only, for the reward chimes. Both flags off strip the
        // microphone permission the plugin adds by default — we never record,
        // and a menopause app asking for the mic is a listing that reads badly
        // on the Play Store and an extra question at App Store review.
        'expo-audio',
        {
          microphonePermission: false,
          recordAudioAndroid: false,
        },
      ],
      [
        // This is the entry that used to be lost when app.config.js redeclared
        // `plugins`. On Android it sets the small notification icon and tint;
        // on iOS it is what writes the `aps-environment` entitlement, without
        // which useRegisterPushToken's getExpoPushTokenAsync() fails outright.
        // The APNs environment has to match the build: a dev client signed for
        // production APNs cannot receive a test push.
        'expo-notifications',
        {
          icon: './assets/logo_transparent.png',
          color: '#ff8da1',
          mode: isDevelopmentVariant ? 'development' : 'production',
        },
      ],
    ],
  },
};
