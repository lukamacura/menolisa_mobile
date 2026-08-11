import React, { useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type EasingFunction,
  type EasingFunctionFactory,
} from 'react-native-reanimated';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import type { BreathPhase } from '../../lib/planTypes';

const CIRCLE_SIZE = 200;

/**
 * On a short screen the full-size stage alone eats 290pt and the start button
 * lands below the fold — she should never have to scroll to begin. Shrink the
 * circle instead, so the whole session stays on one screen.
 */
const CIRCLE_SIZE_COMPACT = 156;
const COMPACT_HEIGHT = 740;

/** The stage reserves room for the largest phase scale (`top_up`, 1.4) plus the glow. */
const STAGE_RATIO = 1.45;

/**
 * Scale targets, matched to the funnel's `BREATH_SEQUENCE`.
 *
 * She did 4-2-6 breathing at this exact rhythm before she paid for anything, so
 * the app opening on the same motion is the continuity the whole funnel is
 * built on. Don't "improve" these on one side only.
 *
 * `hold` drifts back a hair rather than freezing — a real hold settles. `top_up`
 * is a small overshoot above the inhale with a fast ease-out, which is what makes
 * a one-second sip legible instead of a glitch.
 */
const PHASE_SCALE: Record<BreathPhase['key'], number> = {
  in: 1.35,
  hold: 1.32,
  top_up: 1.4,
  out: 1,
};

const PHASE_GLOW: Record<BreathPhase['key'], number> = {
  in: 0.72,
  hold: 0.66,
  top_up: 0.78,
  out: 0.32,
};

/** Per-phase easing. Inhale opens, hold settles, exhale hesitates then releases. */
const PHASE_EASING: Record<BreathPhase['key'], EasingFunction | EasingFunctionFactory> = {
  in: Easing.bezier(0.22, 0.45, 0.32, 1),
  hold: Easing.bezier(0.4, 0, 0.6, 1),
  top_up: Easing.out(Easing.quad),
  out: Easing.bezier(0.5, 0.03, 0.35, 1),
};

type BreathingCircleProps = {
  phase: BreathPhase | null;
  phaseIndex: number;
  secondsLeft: number;
  running: boolean;
  reduceMotion: boolean;
};

export function BreathingCircle({
  phase,
  phaseIndex,
  secondsLeft,
  running,
  reduceMotion,
}: BreathingCircleProps) {
  const { height } = useWindowDimensions();
  const scale = useSharedValue(1);
  const glow = useSharedValue(PHASE_GLOW.out);

  const size = height < COMPACT_HEIGHT ? CIRCLE_SIZE_COMPACT : CIRCLE_SIZE;
  const circleSize = { width: size, height: size };
  const stageSize = { width: size * STAGE_RATIO, height: size * STAGE_RATIO };
  const countdownSize = { fontSize: Math.round(size * 0.28) };

  useEffect(() => {
    if (reduceMotion || !phase) return;
    if (!running) {
      // Freeze exactly where she is rather than snapping back — resuming should
      // pick up the breath, not restart it.
      cancelAnimation(scale);
      cancelAnimation(glow);
      return;
    }
    // Animate only the time actually left in the phase, so resuming a 6-second
    // exhale at second 2 finishes in 4 and the visual stays with the clock.
    const duration = Math.max(120, secondsLeft * 1000);
    const easing = PHASE_EASING[phase.key];
    scale.value = withTiming(PHASE_SCALE[phase.key], { duration, easing });
    glow.value = withTiming(PHASE_GLOW[phase.key], { duration, easing });
    // Re-entering on phaseIndex (not the whole phase object) keeps this to one
    // animation per phase boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseIndex, running, reduceMotion]);

  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: scale.value * 1.06 }],
  }));

  if (reduceMotion) {
    return (
      <View style={styles.stage}>
        <View style={[styles.circle, styles.circleStatic, circleSize]}>
          <Text
            style={[styles.countdown, styles.countdownStatic, countdownSize]}
            accessibilityLiveRegion="polite"
          >
            {secondsLeft}
          </Text>
        </View>
        <Text style={styles.label} accessibilityLiveRegion="polite">
          {phase?.label ?? ''}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.stage}>
      <View style={[styles.circleWrap, stageSize]}>
        <Animated.View style={[styles.glow, circleSize, glowStyle]} pointerEvents="none" />
        <Animated.View style={[styles.circle, circleSize, circleStyle]}>
          <Text style={[styles.countdown, countdownSize]} allowFontScaling={false}>
            {secondsLeft}
          </Text>
        </Animated.View>
      </View>
      <Text style={styles.label} accessibilityLiveRegion="polite">
        {phase?.label ?? ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(249, 184, 200, 0.55)',
  },
  circle: {
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  circleStatic: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  countdown: {
    fontFamily: typography.display.bold,
    color: colors.textInverse,
  },
  /** The static circle is a light fill, so white would drop below contrast. */
  countdownStatic: {
    color: colors.text,
  },
  label: {
    ...typography.presets.heading2,
    color: colors.text,
    marginTop: spacing.md,
  },
});
