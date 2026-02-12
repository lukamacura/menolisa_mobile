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
        },
      ],
    ],
  },
};
