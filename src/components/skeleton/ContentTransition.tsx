import React, { useEffect } from 'react';
import { type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useReduceMotion } from '../StaggeredZoomIn';

/**
 * Short on purpose.
 *
 * The blocks inside a plan screen run their own staggered entrance, and two
 * fades multiplied together read as one slow, murky one — this is only here to
 * cover the swap from skeleton to content, so it gets out of the way well
 * before the first card has finished arriving.
 */
const FADE_DURATION_MS = 180;

type ContentTransitionProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

/**
 * Wraps content and runs a short fade-in on mount.
 * Use when replacing a skeleton: render skeleton while loading, then this wrapper around real content when loaded.
 */
export function ContentTransition({ children, style }: ContentTransitionProps) {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      return;
    }
    opacity.value = withTiming(1, {
      duration: FADE_DURATION_MS,
      easing: Easing.out(Easing.ease),
    });
  }, [opacity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[{ flex: 1 }, animatedStyle, style]}>{children}</Animated.View>;
}
