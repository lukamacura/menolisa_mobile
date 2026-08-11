import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../theme/tokens';

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
  style?: StyleProp<ViewStyle>;
};

/**
 * The app's first circular progress indicator.
 *
 * The fill clamps at 100% — going past it would render an overlapping arc that
 * reads as *less* progress, and an extra session is not a failure state.
 */
export function ProgressRing({
  value,
  total,
  size = 48,
  strokeWidth = 4,
  color = colors.primary,
  label,
  style,
}: ProgressRingProps) {
  const safeTotal = Math.max(1, total);
  const ratio = Math.min(1, Math.max(0, value / safeTotal));
  const complete = value >= safeTotal;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const strokeColor = complete ? colors.success : color;

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
        {ratio > 0 && (
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
        )}
      </Svg>

      <View style={styles.center} pointerEvents="none">
        {complete && !label ? (
          <Ionicons name="checkmark" size={Math.round(size * 0.42)} color={colors.success} />
        ) : (
          <Text
            style={[styles.label, { fontSize: Math.round(size * 0.3) }]}
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
