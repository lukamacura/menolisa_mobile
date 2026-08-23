import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../../theme/tokens';
import { AnimatedPressable } from '../AnimatedPressable';
import { useReduceMotion } from '../StaggeredZoomIn';
import { useBreathingSession } from '../../hooks/useBreathingSession';
import { formatDuration } from '../../lib/planFormat';
import {
  BREATHING_CUES,
  BREATHING_CUE_SECONDS,
  BREATHING_LAST_CUE,
  BREATHING_SETTLE_CUE,
  cueAt,
} from '../../lib/relaxationCues';
import type { RelaxationBreathing } from '../../lib/planTypes';
import { usePlanViewport } from './PlanScreenLayout';
import { BreathingCircle, CIRCLE_MAX, CIRCLE_MIN, STAGE_RATIO } from './BreathingCircle';
import { RelaxationCue } from './RelaxationCue';

/** Above this many rounds, dots stop being readable — paced respiration is 90. */
const MAX_ROUND_DOTS = 12;

/** Long enough that the last cue of a session isn't cut off by the finish. */
const MIN_ROUNDS_FOR_LAST_CUE = 4;

/**
 * Everything the player draws under the circle, at its tallest — the pre-start
 * state, which carries the longest fine print:
 *
 *   round line      12 + 20 = 32
 *   dots or bar     10 + 12 = 22
 *   Start button    16 + 44 = 60
 *   summary         16 + 44 = 60
 *   screen-on hint   8 + 18 = 26
 *   scroll padding           32
 *                           232, plus a little slack for font scaling
 *
 * The circle gets what is left. Sized against the tallest state on purpose: a
 * circle that fits only once the summary disappears would leave the Start button
 * she has to press first below the fold, which is the bug this replaced.
 */
const CHROME_BELOW = 236;

type BreathingPlayerProps = {
  detail: RelaxationBreathing;
  /** Fired once when the last round finishes. */
  onComplete: () => void;
};

export function BreathingPlayer({ detail, onComplete }: BreathingPlayerProps) {
  const reduceMotion = useReduceMotion();
  const session = useBreathingSession(detail.phases, detail.rounds);
  const notified = useRef(false);
  const { height: windowHeight } = useWindowDimensions();
  const viewport = usePlanViewport();
  const [offsetY, setOffsetY] = useState<number | null>(null);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { y } = event.nativeEvent.layout;
    setOffsetY((current) => (current === y ? current : y));
  }, []);

  /**
   * The whole session has to sit on one screen — she is following the circle
   * with her lungs, and a screen she has to scroll mid-breath is a screen that
   * broke the practice.
   *
   * So the circle is the variable, not the layout. `viewport` is the scroll
   * area's real height and `offsetY` is where this player starts inside it, so
   * what's left for the stage is exact rather than guessed at from a device
   * breakpoint. Before the first layout pass, fall back to a window-height
   * estimate so the correction that follows is a few points, not a jump.
   */
  const circleSize = useMemo(() => {
    const forStage =
      viewport !== null && offsetY !== null
        ? viewport - offsetY - CHROME_BELOW
        : windowHeight * 0.24 * STAGE_RATIO;
    return Math.min(CIRCLE_MAX, Math.max(CIRCLE_MIN, Math.floor(forStage / STAGE_RATIO)));
  }, [viewport, offsetY, windowHeight]);

  useEffect(() => {
    if (!session.done || notified.current) return;
    notified.current = true;
    onComplete();
  }, [session.done, onComplete]);

  const started = session.running || session.round > 0 || session.done;
  const roundsLeft = detail.rounds - session.round;
  const pausedLabel = `Paused — ${roundsLeft} round${roundsLeft === 1 ? '' : 's'} left`;

  /**
   * Cues change on a clock, not on rounds.
   *
   * Paced respiration is ninety ten-second rounds; a line that swapped every
   * round would flicker. One every ~35 seconds is slow enough to read twice and
   * still feel like the screen is with her.
   */
  const cue = useMemo(() => {
    if (!started || session.done) return null;
    const cycle = detail.cycleSeconds > 0 ? detail.cycleSeconds : 1;
    const roundsPerCue = Math.max(1, Math.round(BREATHING_CUE_SECONDS / cycle));
    const index = Math.floor(session.round / roundsPerCue);

    // The first stretch is always the settling line — she has just tapped Start
    // and is not yet breathing to the rhythm.
    if (index === 0) return BREATHING_SETTLE_CUE;
    if (session.round >= detail.rounds - 1 && detail.rounds >= MIN_ROUNDS_FOR_LAST_CUE) {
      return BREATHING_LAST_CUE;
    }
    return cueAt(BREATHING_CUES, index - 1);
  }, [started, session.done, session.round, detail.cycleSeconds, detail.rounds]);

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {/* The phase word lives inside the circle, with the countdown. Under the
          circle is where the session's own state goes — which round, how many
          left, and the cue. */}
      <BreathingCircle
        phase={session.phase}
        phaseIndex={session.phaseIndex}
        secondsLeft={session.secondsLeft}
        running={session.running}
        reduceMotion={reduceMotion}
        size={circleSize}
      />

      <Text style={styles.rounds}>
        {session.done
          ? `${detail.rounds} rounds done`
          : `Round ${session.round + 1} of ${detail.rounds}`}
      </Text>

      {detail.rounds <= MAX_ROUND_DOTS ? (
        <View style={styles.dots}>
          {Array.from({ length: detail.rounds }, (_, index) => index).map((index) => (
            <RoundDot key={index} done={index < session.round} reduceMotion={reduceMotion} />
          ))}
        </View>
      ) : (
        <RoundBar
          ratio={detail.rounds > 0 ? session.round / detail.rounds : 0}
          reduceMotion={reduceMotion}
        />
      )}

      {!session.done && (
        <AnimatedPressable
          containerStyle={styles.buttonWrap}
          style={styles.button}
          onPress={
            session.running ? session.pause : started ? session.resume : session.start
          }
          accessibilityRole="button"
          accessibilityLabel={session.running ? 'Pause' : started ? 'Continue' : 'Start'}
        >
          <Text style={styles.buttonText}>
            {session.running ? 'Pause' : started ? 'Continue' : 'Start'}
          </Text>
        </AnimatedPressable>
      )}

      {/* Under the button, in the slot the pre-start summary vacates — so
          starting a session never moves the button she just tapped, and the
          cue lands where her eye already is between breaths.

          Paused shares the slot rather than adding a line under it: she is not
          breathing to a rhythm just then, so where she stopped is the more
          useful thing to say, and one reserved row keeps the screen from
          growing past the fold mid-session. */}
      {started && !session.done && (
        <RelaxationCue
          text={session.running ? cue : pausedLabel}
          reduceMotion={reduceMotion}
          style={styles.cue}
        />
      )}

      {/* Below the button on purpose: it reads as the fine print under Start, and
          keeps the button itself above the fold on a short screen. */}
      {!started && (
        <Text style={styles.summary} numberOfLines={2}>
          {detail.use} · {formatDuration(detail.totalSeconds)} · {detail.breathsPerMinute} breaths
          a minute
        </Text>
      )}

      {/* Nothing here keeps the screen awake, and paced respiration runs a full
          fifteen minutes — so say it before she starts rather than let the
          session die on a screen lock. */}
      {!started && detail.totalSeconds > 120 && (
        <Text style={styles.hint}>Keep your screen on for this one.</Text>
      )}
    </View>
  );
}

/** A round marker that fills rather than flips — the same easing as the breath. */
function RoundDot({ done, reduceMotion }: { done: boolean; reduceMotion: boolean }) {
  const fill = useSharedValue(done ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      fill.value = done ? 1 : 0;
      return;
    }
    fill.value = withTiming(done ? 1 : 0, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
    });
  }, [done, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + fill.value * 0.25 }],
    backgroundColor: interpolateColor(fill.value, [0, 1], [colors.border, colors.primary]),
  }));

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

/** The long-session stand-in for dots. Grows continuously instead of stepping. */
function RoundBar({ ratio, reduceMotion }: { ratio: number; reduceMotion: boolean }) {
  const progress = useSharedValue(reduceMotion ? ratio : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = ratio;
      return;
    }
    progress.value = withTiming(ratio, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [ratio, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${Math.round(progress.value * 100)}%`,
  }));

  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.barFill, animatedStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  rounds: {
    ...typography.presets.label,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    height: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  bar: {
    width: 180,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    marginTop: 10,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  cue: {
    marginTop: spacing.sm,
  },
  summary: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  hint: {
    ...typography.presets.caption,
    color: colors.primaryDark,
    marginTop: spacing.xs,
  },
  buttonWrap: {
    marginTop: spacing.md,
    width: 'auto',
  },
  button: {
    minHeight: minTouchTarget,
    minWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
    ...shadows.buttonPrimary,
  },
  buttonText: {
    ...typography.presets.button,
    color: colors.textInverse,
  },
});
