import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../../theme/tokens';
import { AnimatedPressable } from '../AnimatedPressable';
import { useReduceMotion } from '../StaggeredZoomIn';

const PULSE_MS = 2400;

type PlanGeneratingViewProps = {
  /** True once polling gave up. Swaps the copy and offers a retry. */
  timedOut?: boolean;
  onRetry: () => void;
};

/**
 * Shown while `GET /api/plan` answers `{status:"generating"}`.
 *
 * She reaches this at most once — the plan is written on purchase and never
 * regenerated — but a webhook can be slow or missing, in which case the read
 * itself kicks generation. So this is a real waiting room, not a flash.
 */
export function PlanGeneratingView({ timedOut = false, onRetry }: PlanGeneratingViewProps) {
  const reduceMotion = useReduceMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion || timedOut) return;
    pulse.value = withRepeat(
      withTiming(1.08, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [reduceMotion, timedOut, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.badge, pulseStyle]}>
        <Ionicons
          name={timedOut ? 'refresh' : 'sparkles'}
          size={32}
          color={colors.primary}
        />
      </Animated.View>

      <Text style={styles.title}>
        {timedOut ? 'This is taking longer than usual' : 'Lisa is writing your plan'}
      </Text>
      <Text style={styles.body}>
        {timedOut
          ? 'Your plan is still being put together. Give it another try — nothing is lost.'
          : 'Eight weeks, built around the symptoms you told us about. It takes a moment.'}
      </Text>

      {timedOut && (
        <AnimatedPressable
          containerStyle={styles.buttonWrap}
          style={styles.button}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text style={styles.buttonText}>Try again</Text>
        </AnimatedPressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['2xl'],
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadows.glowPrimary,
  },
  title: {
    ...typography.presets.heading2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  body: {
    ...typography.presets.body,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
  },
  buttonWrap: {
    marginTop: spacing.xl,
    width: 'auto',
  },
  button: {
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.sm,
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
    ...shadows.buttonPrimary,
  },
  buttonText: {
    ...typography.presets.button,
    color: colors.textInverse,
  },
});
