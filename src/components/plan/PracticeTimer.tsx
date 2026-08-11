import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, AppState, type AppStateStatus } from 'react-native';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../../theme/tokens';
import { AnimatedPressable } from '../AnimatedPressable';
import { formatDuration } from '../../lib/planFormat';
import { ProgressRing } from './ProgressRing';

type PracticeTimerProps = {
  minutes: number;
  /** Fired once when the countdown reaches zero. */
  onComplete: () => void;
};

/**
 * Countdown for the non-breathing practices — the wind-down, the body scan, the
 * five-minute reset. Same completion contract as the breathing player, so the
 * relaxation screen doesn't care which kind a week gave her.
 */
export function PracticeTimer({ minutes, onComplete }: PracticeTimerProps) {
  const totalSeconds = minutes * 60;
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running, setRunning] = useState(false);
  const endsAt = useRef<number | null>(null);
  const completed = useRef(false);

  const start = useCallback(() => {
    completed.current = false;
    endsAt.current = Date.now() + remaining * 1000;
    setRunning(true);
  }, [remaining]);

  const pause = useCallback(() => {
    setRunning(false);
    endsAt.current = null;
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      if (endsAt.current === null) return;
      const left = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && !completed.current) {
        completed.current = true;
        setRunning(false);
        onComplete();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [running, onComplete]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next !== 'active') pause();
    });
    return () => subscription.remove();
  }, [pause]);

  const elapsed = totalSeconds - remaining;

  return (
    <View style={styles.wrap}>
      <ProgressRing
        value={elapsed}
        total={totalSeconds}
        size={132}
        strokeWidth={8}
        color={colors.lavender}
        label={formatDuration(remaining)}
      />

      <AnimatedPressable
        containerStyle={styles.buttonWrap}
        style={styles.button}
        onPress={running ? pause : start}
        accessibilityRole="button"
        accessibilityLabel={running ? 'Pause' : 'Start'}
      >
        <Text style={styles.buttonText}>{running ? 'Pause' : 'Start'}</Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  buttonWrap: {
    marginTop: spacing.lg,
    width: 'auto',
  },
  button: {
    minHeight: minTouchTarget,
    minWidth: 160,
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
