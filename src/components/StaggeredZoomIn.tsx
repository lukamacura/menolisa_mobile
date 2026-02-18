import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

/** Slower, smoother entrance: duration and stagger tuned for a calm feel */
export const ZOOM_ENTRANCE_DURATION_MS = 420;
export const STAGGER_DELAY_MS = 72;
export const ZOOM_INITIAL_SCALE = 0.96;

export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    return () => subscription.remove();
  }, []);

  return reduceMotion;
}

type StaggeredZoomInProps = {
  delayIndex: number;
  reduceMotion: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
};

export function StaggeredZoomIn({
  delayIndex,
  reduceMotion,
  children,
  style,
}: StaggeredZoomInProps) {
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const scale = useSharedValue(reduceMotion ? 1 : ZOOM_INITIAL_SCALE);

  useEffect(() => {
    if (reduceMotion) return;
    const easing = Easing.out(Easing.quad);
    const delay = delayIndex * STAGGER_DELAY_MS;
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: ZOOM_ENTRANCE_DURATION_MS, easing })
    );
    scale.value = withDelay(
      delay,
      withTiming(1, { duration: ZOOM_ENTRANCE_DURATION_MS, easing })
    );
  }, [reduceMotion, delayIndex]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
