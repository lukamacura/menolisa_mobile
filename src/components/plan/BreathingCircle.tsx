import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type EasingFunction,
  type EasingFunctionFactory,
} from 'react-native-reanimated';
import { colors, radii, typography } from '../../theme/tokens';
import type { BreathPhase } from '../../lib/planTypes';

/**
 * The circle is sized by the player, which measures what is actually left on
 * screen. These are the ends of the range it may pick.
 *
 * The floor is not arbitrary: "Breathe out" has to sit on one line inside the
 * circle at its resting scale, and below ~120pt it stops fitting. It is what an
 * iPhone SE ends up with, so do not raise it without re-checking that screen —
 * a higher floor there overrides the fit and pushes Start back below the fold.
 */
export const CIRCLE_MIN = 120;
export const CIRCLE_MAX = 200;

/**
 * The stage reserves room for the largest phase scale (`top_up`, 1.4) and the
 * glow that rides 6% outside it — 1.4 * 1.06, rounded up. Anything smaller and
 * a `breath_sigh` sip paints over the round counter underneath.
 */
export const STAGE_RATIO = 1.5;

/** The phase word's cross-fade. Out fast, in slow — the same shape as the breath. */
const LABEL_FADE_OUT_MS = 160;
const LABEL_FADE_IN_MS = 300;

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
  /** Diameter at rest, from the player's fit calculation. */
  size: number;
};

export function BreathingCircle({
  phase,
  phaseIndex,
  secondsLeft,
  running,
  reduceMotion,
  size,
}: BreathingCircleProps) {
  const scale = useSharedValue(1);
  const glow = useSharedValue(PHASE_GLOW.out);

  /**
   * The phase word cross-fades rather than cutting.
   *
   * "Breathe in" replacing "Hold" on a single frame is the one hard edge left on
   * a screen whose entire job is to have none — and it lands at the exact moment
   * she is meant to be changing what her lungs are doing.
   */
  const [label, setLabel] = useState(phase?.label ?? '');
  const labelOpacity = useSharedValue(1);

  useEffect(() => {
    const next = phase?.label ?? '';
    if (next === label) return;
    if (reduceMotion) {
      setLabel(next);
      return;
    }
    labelOpacity.value = withTiming(0, { duration: LABEL_FADE_OUT_MS }, (done) => {
      if (done) runOnJS(setLabel)(next);
    });
  }, [phase?.label, label, reduceMotion]);

  useEffect(() => {
    labelOpacity.value = reduceMotion
      ? 1
      : withTiming(1, { duration: LABEL_FADE_IN_MS, easing: Easing.out(Easing.quad) });
  }, [label, reduceMotion]);

  const circleSize = { width: size, height: size };
  const stageSize = { width: size * STAGE_RATIO, height: size * STAGE_RATIO };
  const readoutSize = { width: size, height: size, paddingHorizontal: Math.round(size * 0.11) };
  const countdownSize = { fontSize: Math.round(size * 0.3), lineHeight: Math.round(size * 0.36) };
  /** Clamped, or the word outgrows the chord it has to sit on at the small end. */
  const phaseSize = {
    fontSize: Math.min(17, Math.max(13, Math.round(size * 0.085))),
    lineHeight: Math.min(24, Math.max(18, Math.round(size * 0.115))),
  };

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
  const labelStyle = useAnimatedStyle(() => ({ opacity: labelOpacity.value }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: scale.value * 1.06 }],
  }));

  if (reduceMotion) {
    // No scaling, so no stage to reserve — the circle is its own footprint.
    return (
      <View style={[styles.circleWrap, circleSize]}>
        <View style={[styles.circle, styles.circleStatic, circleSize]} />
        <View style={[styles.readout, readoutSize]} pointerEvents="none">
          <Text
            style={[styles.phase, styles.phaseStatic, phaseSize]}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLiveRegion="polite"
          >
            {phase?.label ?? ''}
          </Text>
          <Text
            style={[styles.countdown, styles.countdownStatic, countdownSize]}
            accessibilityLiveRegion="polite"
          >
            {secondsLeft}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.circleWrap, stageSize]}>
      <Animated.View style={[styles.glow, circleSize, glowStyle]} pointerEvents="none" />
      <Animated.View style={[styles.circle, circleSize, circleStyle]} />
      {/*
        The readout rides above the circle rather than inside it, on a layer that
        does not scale. Parented to the animated view it would stretch 35% on
        every inhale — the one thing on the screen she is actually reading, made
        to pulse. Absolute with no insets, so the wrap's centering places it.
      */}
      <View style={[styles.readout, readoutSize]} pointerEvents="none">
        <Animated.Text
          style={[styles.phase, phaseSize, labelStyle]}
          numberOfLines={1}
          adjustsFontSizeToFit
          allowFontScaling={false}
          accessibilityLiveRegion="polite"
        >
          {label}
        </Animated.Text>
        <Text style={[styles.countdown, countdownSize]} allowFontScaling={false}>
          {secondsLeft}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    position: 'absolute',
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  circleStatic: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  readout: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phase: {
    fontFamily: typography.display.semibold,
    color: colors.textInverse,
    textAlign: 'center',
  },
  countdown: {
    fontFamily: typography.display.bold,
    color: colors.textInverse,
    textAlign: 'center',
  },
  /** The static circle is a light fill, so white would drop below contrast. */
  phaseStatic: {
    color: colors.text,
  },
  countdownStatic: {
    color: colors.text,
  },
});
