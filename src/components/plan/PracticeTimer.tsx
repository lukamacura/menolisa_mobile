import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, AppState, type AppStateStatus } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
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
import { ProgressRing } from './ProgressRing';
import { RelaxationCue } from './RelaxationCue';

const RING_SIZE = 132;

/** One full swell of the halo. Roughly a slow, unforced breath. */
const HALO_PERIOD_MS = 5200;

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

  // Swells only while she is actually in the practice — a halo breathing away
  // behind a paused clock says the session is running when it is not.
  const halo = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion || !running) {
      cancelAnimation(halo);
      halo.value = withTiming(1, { duration: 400 });
      return;
    }
    halo.value = withRepeat(
      withTiming(1.12, { duration: HALO_PERIOD_MS / 2, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [running, reduceMotion]);

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: halo.value }],
    // Nearly flat at rest, so a paused screen reads as still rather than dim.
    opacity: 0.25 + (halo.value - 1) * 2.2,
  }));

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
        <Animated.View style={[styles.halo, haloStyle]} pointerEvents="none" />
        <ProgressRing
          value={elapsed}
          total={totalSeconds}
          size={RING_SIZE}
          strokeWidth={8}
          color={colors.lavender}
          label={formatDuration(remaining)}
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
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(139, 124, 246, 0.22)',
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
