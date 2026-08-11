import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../../theme/tokens';
import { AnimatedPressable } from '../AnimatedPressable';
import { useReduceMotion } from '../StaggeredZoomIn';
import { useBreathingSession } from '../../hooks/useBreathingSession';
import { formatDuration } from '../../lib/planFormat';
import type { RelaxationBreathing } from '../../lib/planTypes';
import { BreathingCircle } from './BreathingCircle';

/** Above this many rounds, dots stop being readable — paced respiration is 90. */
const MAX_ROUND_DOTS = 12;

type BreathingPlayerProps = {
  detail: RelaxationBreathing;
  /** Fired once when the last round finishes. */
  onComplete: () => void;
};

export function BreathingPlayer({ detail, onComplete }: BreathingPlayerProps) {
  const reduceMotion = useReduceMotion();
  const session = useBreathingSession(detail.phases, detail.rounds);
  const notified = useRef(false);

  useEffect(() => {
    if (!session.done || notified.current) return;
    notified.current = true;
    onComplete();
  }, [session.done, onComplete]);

  const started = session.running || session.round > 0 || session.done;
  const roundsLeft = detail.rounds - session.round;

  return (
    <View style={styles.wrap}>
      <BreathingCircle
        phase={session.phase}
        phaseIndex={session.phaseIndex}
        secondsLeft={session.secondsLeft}
        running={session.running}
        reduceMotion={reduceMotion}
      />

      <Text style={styles.rounds}>
        {session.done
          ? `${detail.rounds} rounds done`
          : `Round ${session.round + 1} of ${detail.rounds}`}
      </Text>

      {detail.rounds <= MAX_ROUND_DOTS ? (
        <View style={styles.dots}>
          {Array.from({ length: detail.rounds }, (_, index) => index).map((index) => (
            <View
              key={index}
              style={[styles.dot, index < session.round && styles.dotDone]}
            />
          ))}
        </View>
      ) : (
        <View style={styles.bar}>
          <View
            style={[
              styles.barFill,
              { width: `${Math.round((session.round / detail.rounds) * 100)}%` },
            ]}
          />
        </View>
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

      {started && !session.running && !session.done && (
        <Text style={styles.paused}>Paused — {roundsLeft} rounds left</Text>
      )}

      {/* Below the button on purpose: it reads as the fine print under Start, and
          keeps the button itself above the fold on a short screen. */}
      {!started && (
        <Text style={styles.summary}>
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
    gap: 6,
    marginTop: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  dotDone: {
    backgroundColor: colors.primary,
  },
  bar: {
    width: 180,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
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
    marginTop: spacing.lg,
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
  paused: {
    ...typography.presets.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
