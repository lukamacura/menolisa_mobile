import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../theme/tokens';
import { useReduceMotion } from '../StaggeredZoomIn';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Animated SVG props go through the native shadow tree, which react-native-web
 * does not have. Rather than risk a ring that renders permanently empty in the
 * browser, web draws the arc statically — it is a screenshot target, not a
 * surface anyone taps through.
 */
const CAN_ANIMATE_ARC = Platform.OS !== 'web';

/** The first sweep — long enough to be read as filling, not as a jump. */
const SWEEP_MOUNT_MS = 620;
/** Every sweep after that. She just ticked something; the ring should keep up with her. */
const SWEEP_UPDATE_MS = 300;

type ProgressRingProps = {
  /** Completions so far. May exceed `total` — she did extra. */
  value: number;
  /** Completions a full period takes. Guarded against 0. */
  total: number;
  size?: number;
  strokeWidth?: number;
  /** Ring colour when incomplete. Complete always reads as success. */
  color?: string;
  /** Rendered in the middle. Defaults to `value` (or a check once complete). */
  label?: string;
  /**
   * Override for the label's font size. The 0.3-of-diameter default is sized for
   * one or two characters; a countdown face like "12:00" needs to be told to
   * shrink or it runs past the ring it sits inside.
   */
  labelSize?: number;
  /**
   * Hold the first sweep back, so a ring inside a staggered card fills once the
   * card has arrived rather than behind it.
   */
  sweepDelayMs?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The app's first circular progress indicator.
 *
 * The fill clamps at 100% — going past it would render an overlapping arc that
 * reads as *less* progress, and an extra session is not a failure state.
 *
 * The arc sweeps rather than snaps: on mount it fills from empty, and every tick
 * after that animates from where it was. Reduce Motion pins it to the value.
 */
export function ProgressRing({
  value,
  total,
  size = 48,
  strokeWidth = 4,
  color = colors.primary,
  label,
  labelSize,
  sweepDelayMs = 0,
  style,
}: ProgressRingProps) {
  const reduceMotion = useReduceMotion();
  const safeTotal = Math.max(1, total);
  const ratio = Math.min(1, Math.max(0, value / safeTotal));
  const complete = value >= safeTotal;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const strokeColor = complete ? colors.success : color;

  const still = reduceMotion || !CAN_ANIMATE_ARC;
  const progress = useSharedValue(still ? ratio : 0);
  const hasSwept = useRef(false);

  useEffect(() => {
    if (still) {
      progress.value = ratio;
      return;
    }
    const first = !hasSwept.current;
    hasSwept.current = true;
    const timing = withTiming(ratio, {
      duration: first ? SWEEP_MOUNT_MS : SWEEP_UPDATE_MS,
      easing: Easing.out(Easing.cubic),
    });
    progress.value = first && sweepDelayMs > 0 ? withDelay(sweepDelayMs, timing) : timing;
  }, [ratio, still, sweepDelayMs]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View
      style={[styles.container, { width: size, height: size }, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: safeTotal, now: Math.min(value, safeTotal) }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {ratio > 0 &&
          (still ? (
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={circumference * (1 - ratio)}
              // Start the arc at 12 o'clock rather than 3.
              transform={`rotate(-90 ${center} ${center})`}
            />
          ) : (
            <AnimatedCircle
              cx={center}
              cy={center}
              r={radius}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              animatedProps={animatedProps}
              transform={`rotate(-90 ${center} ${center})`}
            />
          ))}
      </Svg>

      <View style={styles.center} pointerEvents="none">
        {complete && !label ? (
          <Ionicons name="checkmark" size={Math.round(size * 0.42)} color={colors.success} />
        ) : (
          <Text
            style={[styles.label, { fontSize: labelSize ?? Math.round(size * 0.3) }]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {label ?? String(value)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: typography.display.bold,
    color: colors.text,
  },
});
