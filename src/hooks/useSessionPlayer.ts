import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Haptics from 'expo-haptics';
import { resolveDose } from '../lib/planFormat';
import type { PlanExercise } from '../lib/planTypes';
import {
  REST_BUMP_SECONDS,
  completedSets,
  nextStep,
  skipToNextExercise,
  stepSeconds,
  totalSets,
  type SessionExercise,
  type SessionStep,
} from '../lib/sessionSteps';

export { REST_BUMP_SECONDS } from '../lib/sessionSteps';
export type { SessionStep, SessionExercise } from '../lib/sessionSteps';

/**
 * Drives a guided movement session: the clock, the haptics and the resume.
 *
 * All of the ordering — what follows what, and which steps are timed — lives in
 * `lib/sessionSteps.ts` as pure functions, so it can be simulated without a
 * renderer. Nothing here decides sequence.
 */
export type SessionPlayer = {
  step: SessionStep;
  /** The exercise the current step belongs to. Null once the session is done. */
  current: SessionExercise | null;
  /** Seconds left on a timed step; null when the step waits on her instead. */
  remaining: number | null;
  /** How long the current timed step runs, for the ring's denominator. */
  duration: number | null;
  paused: boolean;
  /** 0-1 across the whole session, by completed sets. */
  progress: number;
  /** Advances the current step early — "Done", "I'm ready", "Start now". */
  advance: () => void;
  /** Adds time to whatever is on the clock. No-op on an untimed step. */
  addTime: () => void;
  togglePause: () => void;
  /** Abandons the rest of the current exercise and moves to the next. */
  skipExercise: () => void;
  setsDone: number;
  setsTotal: number;
};

export function useSessionPlayer(
  exercises: PlanExercise[],
  options: { compact?: boolean; startIndex?: number; onFinish?: () => void } = {}
): SessionPlayer {
  const { compact = false, startIndex = 0, onFinish } = options;

  const items = useMemo<SessionExercise[]>(
    () =>
      exercises.flatMap((exercise) => {
        const dose = resolveDose(exercise);
        return dose ? [{ exercise, dose }] : [];
      }),
    [exercises]
  );

  const [step, setStep] = useState<SessionStep>(() =>
    items.length
      ? { kind: 'transition', index: Math.min(startIndex, items.length - 1) }
      : { kind: 'done' }
  );
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  /** Seconds "+ time" has added to this step. Reset every time the step changes. */
  const [bonus, setBonus] = useState(0);

  const baseDuration = useMemo(() => stepSeconds(step, items, compact), [step, items, compact]);
  const endsAt = useRef<number | null>(null);
  const finished = useRef(false);
  const lastTick = useRef<number | null>(null);

  // The plan may still be loading when this mounts — a cold start straight into
  // a session, or a refresh in flight. Without this the player would initialise
  // empty, land on `done`, and sit there once the exercises finally arrived.
  const seeded = useRef(items.length > 0);
  useEffect(() => {
    if (seeded.current || !items.length) return;
    seeded.current = true;
    setStep({ kind: 'transition', index: Math.min(startIndex, items.length - 1) });
  }, [items.length, startIndex]);

  const advance = useCallback(() => {
    setStep((prev) => nextStep(prev, items));
    setPaused(false);
  }, [items]);

  const skipExercise = useCallback(() => {
    setStep((prev) => skipToNextExercise(prev, items));
    setPaused(false);
  }, [items]);

  // Offered on the work step too, not just the rest. It is what keeps the clock
  // on a set from being a deadline: a slower morning costs her a tap, never the
  // set.
  const addTime = useCallback(() => {
    if (baseDuration === null) return;
    // Null while paused — `togglePause` rebuilds the deadline from `remaining` on
    // resume, so the added seconds survive either way.
    if (endsAt.current !== null) endsAt.current += REST_BUMP_SECONDS * 1000;
    setBonus((seconds) => seconds + REST_BUMP_SECONDS);
    setRemaining((left) => (left === null ? left : left + REST_BUMP_SECONDS));
  }, [baseDuration]);

  const togglePause = useCallback(() => {
    setPaused((wasPaused) => {
      // Resuming restarts the clock from whatever was left when she paused.
      endsAt.current = wasPaused ? Date.now() + (remaining ?? 0) * 1000 : null;
      return !wasPaused;
    });
  }, [remaining]);

  // Arm the clock whenever the step changes to a timed one.
  useEffect(() => {
    lastTick.current = null;
    setBonus(0);
    if (baseDuration === null) {
      endsAt.current = null;
      setRemaining(null);
      return;
    }
    endsAt.current = Date.now() + baseDuration * 1000;
    setRemaining(baseDuration);
  }, [step, baseDuration]);

  // Fire once when the session ends, not on every render that follows it.
  useEffect(() => {
    if (step.kind === 'done' && !finished.current && items.length) {
      finished.current = true;
      onFinish?.();
    }
  }, [step.kind, items.length, onFinish]);

  /**
   * The clock, read off `Date.now()` rather than counted in ticks.
   *
   * Deliberately unlike `PracticeTimer`, which pauses itself when the app leaves
   * the foreground. That is right for a body scan and wrong here — she pockets
   * the phone for a farmer's carry or a walk, and coming back to a stopped clock
   * is how she stops trusting the feature. This one keeps running and catches up
   * in one jump on resume, rather than replaying every step it missed.
   */
  useEffect(() => {
    if (baseDuration === null || paused) return;

    let cancelled = false;
    const readClock = () => {
      if (cancelled || endsAt.current === null) return;
      const left = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        endsAt.current = null;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        advance();
      }
    };

    const timer = setInterval(readClock, 250);
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') readClock();
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      subscription.remove();
    };
  }, [baseDuration, paused, advance]);

  // The last three seconds, felt rather than watched — she is not looking at the
  // screen while she is holding a wall sit.
  useEffect(() => {
    if (remaining === null || paused) return;
    if (remaining > 3 || remaining < 1) return;
    if (lastTick.current === remaining) return;
    lastTick.current = remaining;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [remaining, paused]);

  const setsTotal = useMemo(() => totalSets(items), [items]);
  const setsDone = completedSets(step, items);

  return {
    step,
    current: step.kind === 'done' ? null : items[step.index] ?? null,
    remaining,
    // The ring's denominator grows with "+ time", so its arc never runs backwards
    // past empty when she takes another twenty seconds.
    duration: baseDuration === null ? null : baseDuration + bonus,
    paused,
    progress: setsTotal ? Math.min(1, setsDone / setsTotal) : 0,
    advance,
    addTime,
    togglePause,
    skipExercise,
    setsDone,
    setsTotal,
  };
}
