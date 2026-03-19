import { Platform } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { colors } from '../theme/tokens';
import { motion } from '../theme/motion';

/**
 * Default transitions for inner stacks (Home, Chat, Settings).
 * - Matches iOS-style horizontal push on Android so depth feels consistent (Wise-like clarity).
 * - Solid background avoids flash between routes during transition.
 * - Duration aligned with `theme/motion` so stack motion and in-screen Reanimated cues feel related.
 */
export const innerStackScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.background },
  // Android: iOS-like slide; iOS: native default push already matches.
  ...(Platform.OS === 'android' ? { animation: 'ios_from_right' as const } : {}),
  animationDuration: motion.duration.base,
  fullScreenGestureEnabled: true,
  gestureEnabled: true,
};
