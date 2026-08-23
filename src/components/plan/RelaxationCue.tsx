import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, spacing, typography } from '../../theme/tokens';

const FADE_OUT_MS = 200;
const FADE_IN_MS = 420;
/** How far the incoming line rises. Barely there — anything more pulls the eye. */
const RISE = 8;

/**
 * Reserved so the line can go from one to two and back without shifting the
 * button underneath it. She is mid-breath; nothing on this screen may move that
 * she did not move herself.
 */
const RESERVED_HEIGHT = 22 * 2 + spacing.xs;

type RelaxationCueProps = {
  /** The line to show. Null clears the cue without collapsing the space. */
  text: string | null;
  reduceMotion: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * One line of guidance, cross-faded whenever it changes.
 *
 * The swap is deliberately slow on the way in — a line that snaps into place
 * mid-exhale reads as an alert, and the whole point of the screen is that
 * nothing here is urgent.
 */
export function RelaxationCue({ text, reduceMotion, style }: RelaxationCueProps) {
  const [shown, setShown] = useState(text);
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const rise = useSharedValue(reduceMotion ? 0 : RISE);

  // Out, then swap. The incoming line is faded up by the effect below, once
  // `shown` has actually caught up with the prop.
  useEffect(() => {
    if (text === shown) return;
    if (reduceMotion) {
      setShown(text);
      return;
    }
    opacity.value = withTiming(0, { duration: FADE_OUT_MS }, (done) => {
      if (done) runOnJS(setShown)(text);
    });
  }, [text, shown, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      rise.value = 0;
      return;
    }
    if (shown === null) return;
    rise.value = RISE;
    rise.value = withTiming(0, { duration: FADE_IN_MS, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(1, { duration: FADE_IN_MS, easing: Easing.out(Easing.quad) });
  }, [shown, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: rise.value }],
  }));

  return (
    <Animated.View style={[styles.wrap, animatedStyle, style]} pointerEvents="none">
      {shown ? (
        <Text style={styles.text} numberOfLines={2} accessibilityLiveRegion="polite">
          {shown}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: RESERVED_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  text: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
