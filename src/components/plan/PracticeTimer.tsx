import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, AppState, type AppStateStatus } from 'react-native';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../../theme/tokens';
import { AnimatedPressable } from '../AnimatedPressable';
import { useReduceMotion } from '../StaggeredZoomIn';
import { formatDuration } from '../../lib/planFormat';
import {
  PRACTICE_CUES,
  PRACTICE_CUE_SECONDS,
  PRACTICE_HALFWAY_CUE,
  PRACTICE_LAST_CUE,
  cueAt,
} from '../../lib/relaxationCues';
import { PRACTICE_CLOCK_SIZE, PRACTICE_RING_SIZE } from './practiceStage';
import { PracticeHalo } from './PracticeHalo';
import { ProgressRing } from './ProgressRing';
import { RelaxationCue } from './RelaxationCue';

/** The last stretch, as a share of the practice. */
const LAST_STRETCH = 0.15;

type PracticeTimerProps = {
  minutes: number;
  /** Fired once when the countdown reaches zero. */
  onComplete: () => void;
};

/**
 * Countdown for the non-breathing practices — the wind-down, the body scan, the
 * five-minute reset. Same completion contract as the breathing player, so the
 * relaxation screen doesn't care which kind a week gave her.
 *
 * A bare countdown is the loneliest screen in the app: five minutes of a number
 * going down, with nothing to do and no sign anything is happening. The halo
 * gives the screen a pulse to sit with, and the cue line gives her something to
 * come back to when her attention drifts — which, in a body scan, it is meant to.
 */
export function PracticeTimer({ minutes, onComplete }: PracticeTimerProps) {
  const reduceMotion = useReduceMotion();
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
  const started = elapsed > 0;

  const cue = useMemo(() => {
    if (!started || remaining === 0) return null;
    if (remaining / totalSeconds <= LAST_STRETCH) return PRACTICE_LAST_CUE;

    const index = Math.floor(elapsed / PRACTICE_CUE_SECONDS);
    // Only a practice long enough to have a middle gets told it has one.
    const halfwaySlot = Math.floor(totalSeconds / 2 / PRACTICE_CUE_SECONDS);
    if (halfwaySlot >= 2 && index === halfwaySlot) return PRACTICE_HALFWAY_CUE;
    return cueAt(PRACTICE_CUES, index);
  }, [started, elapsed, remaining, totalSeconds]);

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <PracticeHalo size={PRACTICE_RING_SIZE} active={running} reduceMotion={reduceMotion} />
        <ProgressRing
          value={elapsed}
          total={totalSeconds}
          size={PRACTICE_RING_SIZE}
          strokeWidth={8}
          color={colors.lavender}
          label={formatDuration(remaining)}
          labelSize={PRACTICE_CLOCK_SIZE}
        />
      </View>

      <AnimatedPressable
        containerStyle={styles.buttonWrap}
        style={styles.button}
        onPress={running ? pause : start}
        accessibilityRole="button"
        accessibilityLabel={running ? 'Pause' : started ? 'Continue' : 'Start'}
      >
        <Text style={styles.buttonText}>
          {running ? 'Pause' : started ? 'Continue' : 'Start'}
        </Text>
      </AnimatedPressable>

      {started && remaining > 0 && (
        <RelaxationCue text={cue} reduceMotion={reduceMotion} style={styles.cue} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  stage: {
    width: PRACTICE_RING_SIZE,
    height: PRACTICE_RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
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
  cue: {
    marginTop: spacing.md,
  },
});
