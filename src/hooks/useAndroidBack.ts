import { useCallback } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Route Android's hardware back button through the screen's own way out.
 *
 * Three screens in this app are built on the promise that their one button is
 * the only exit — the guided session, the cycle recap and the renewal screen —
 * and all three said so with `gestureEnabled: false` and a hidden back chevron.
 * Neither of those touches the Android back button, which pops the screen
 * itself, straight past the handler that was supposed to run first. On that
 * platform:
 *
 * - Backing out of a session she was four exercises into discarded it silently.
 *   The "want it logged?" prompt the screen exists to show never appeared.
 * - Backing out of the recap or the renewal screen landed on the daily loop,
 *   whose focus effect immediately pushed the same screen again — so the one
 *   gesture every Android user reaches for first made the app look frozen.
 *
 * Returning `true` from the listener claims the press, so the navigator's
 * default pop never runs and `onBack` is the whole behaviour. Scoped to focus,
 * so a screen deeper in the stack cannot answer for the one on top of it.
 */
export function useAndroidBack(onBack: () => void): void {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        onBack();
        return true;
      });
      return () => subscription.remove();
    }, [onBack])
  );
}
