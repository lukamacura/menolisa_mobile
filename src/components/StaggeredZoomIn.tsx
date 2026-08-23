import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

/** Slower, smoother entrance: duration and stagger tuned for a calm feel */
export const ZOOM_ENTRANCE_DURATION_MS = 460;
export const STAGGER_DELAY_MS = 70;
export const ZOOM_INITIAL_SCALE = 0.97;

/**
 * Opacity lands well before the transform does.
 *
 * A card that is still half-transparent while it is still moving reads as a
 * rendering problem; one that is solid while it settles the last few points
 * reads as arriving. Same trick every good sheet animation uses.
 */
const OPACITY_DURATION_MS = 280;

/** How far each block rises into place. Small on purpose — this is a settle, not a slide. */
const RISE_DISTANCE = 14;

/**
 * Stagger stops compounding after this many blocks.
 *
 * The daily loop is eight blocks deep and grows with her habits. Uncapped, the
 * disclaimer at the bottom would start animating half a second after the header
 * — long enough that a fast scroll catches it mid-entrance.
 */
const MAX_STAGGER_STEPS = 6;

/** A single ease-out curve, shared so nothing on a screen settles on a different clock. */
const ENTRANCE_EASING = Easing.bezier(0.16, 1, 0.3, 1);

export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

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
  const rise = useSharedValue(reduceMotion ? 0 : RISE_DISTANCE);
  const hasAnimated = useRef(false);

  useEffect(() => {
    // Only trigger the entrance animation once. If content is already visible
    // (reduceMotion was true at mount) or already animated, skip.
    if (hasAnimated.current || reduceMotion) return;
    hasAnimated.current = true;
    const delay = Math.min(delayIndex, MAX_STAGGER_STEPS) * STAGGER_DELAY_MS;
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: OPACITY_DURATION_MS, easing: Easing.out(Easing.quad) })
    );
    scale.value = withDelay(
      delay,
      withTiming(1, { duration: ZOOM_ENTRANCE_DURATION_MS, easing: ENTRANCE_EASING })
    );
    rise.value = withDelay(
      delay,
      withTiming(0, { duration: ZOOM_ENTRANCE_DURATION_MS, easing: ENTRANCE_EASING })
    );
  }, [reduceMotion, delayIndex]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: rise.value }, { scale: scale.value }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
