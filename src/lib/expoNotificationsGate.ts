import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Remote push was removed from Expo Go on Android (SDK 53+). Loading `expo-notifications`
 * there spams errors. Dev builds / standalone binaries are unaffected.
 */
function canLoadExpoNotificationsNativeModule(): boolean {
  if (Platform.OS === 'web') return false;
  if (
    Platform.OS === 'android' &&
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  ) {
    return false;
  }
  return true;
}

type ExpoNotificationsModule = typeof import('expo-notifications');

let cached: ExpoNotificationsModule | null | undefined;

/**
 * Returns the notifications module, or `null` when it must not be loaded (e.g. Expo Go Android).
 */
export function getNativeExpoNotifications(): ExpoNotificationsModule | null {
  if (!canLoadExpoNotificationsNativeModule()) {
    return null;
  }
  if (cached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cached = require('expo-notifications') as ExpoNotificationsModule;
    } catch {
      cached = null;
    }
  }
  return cached;
}
