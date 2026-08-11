/**
 * Dynamic Expo config. Used so Android usesCleartextTraffic is true only in dev
 * (for localhost) and false in production builds.
 */
const base = require('./app.json');

const isProduction =
  process.env.NODE_ENV === 'production' || process.env.APP_VARIANT === 'production';

module.exports = {
  expo: {
    ...base.expo,
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
            usesCleartextTraffic: !isProduction,
          },
          ios: {
            deploymentTarget: '15.1',
          },
        },
      ],
      './plugins/android-large-screen.js',
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
    ],
  },
};
