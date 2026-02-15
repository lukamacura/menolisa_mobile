import React, { useEffect } from 'react';
import { type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const FADE_DURATION_MS = 320;

type ContentTransitionProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

/**
 * Wraps content and runs a short fade-in on mount.
 * Use when replacing a skeleton: render skeleton while loading, then this wrapper around real content when loaded.
 */
export function ContentTransition({ children, style }: ContentTransitionProps) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: FADE_DURATION_MS,
      easing: Easing.out(Easing.ease),
    });
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[{ flex: 1 }, animatedStyle, style]}>{children}</Animated.View>;
}
