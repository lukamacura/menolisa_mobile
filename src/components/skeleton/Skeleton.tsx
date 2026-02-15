import React, { useEffect } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, radii } from '../../theme/tokens';

const GLOW_DURATION_MS = 1400;
const GLOW_OPACITY_MIN = 0.32;
const GLOW_OPACITY_MAX = 0.62;

type SkeletonProps = {
  style?: ViewStyle;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
};

/**
 * Base skeleton block with a soft, continuous glow (opacity pulse).
 * Use same width/height and layout as the real content so there’s no layout shift.
 */
export function Skeleton({
  style,
  width,
  height,
  borderRadius = radii.sm,
}: SkeletonProps) {
  const opacity = useSharedValue(GLOW_OPACITY_MIN);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(GLOW_OPACITY_MAX, {
          duration: GLOW_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(GLOW_OPACITY_MIN, {
          duration: GLOW_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
        })
      ),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const baseStyle: ViewStyle = {
    width: width ?? '100%',
    height: height ?? 20,
    borderRadius,
    backgroundColor: colors.border,
    overflow: 'hidden',
  };

  return (
    <View style={[baseStyle, style]} collapsable={false}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius, backgroundColor: colors.primaryLight + '50' },
          animatedStyle,
        ]}
      />
    </View>
  );
}
