import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { SessionPhase } from '../lib/planTypes';
import { playSessionCue } from '../lib/sessionSound';
import {
  REST_BUMP_SECONDS,
  completedSets,
  nextStep,
  stepSeconds,
  totalSets,
  type SessionExercise,
  type SessionStep,
} from '../lib/sessionSteps';

export { REST_BUMP_SECONDS } from '../lib/sessionSteps';
export type { SessionStep, SessionExercise } from '../lib/sessionSteps';

/**
 * Drives a guided movement session: the clock, the countdown and the resume.
 *
 * All of the ordering — what follows what, and which steps are timed — lives in
 * `lib/sessionSteps.ts` as pure functions, so it can be simulated without a
 * renderer. Nothing here decides sequence.
 */
export type SessionPlayer = {
  step: SessionStep;
  /** The exercise the current step belongs to. Null once the session is done. */
  current: SessionExercise | null;
  /** Which part of the session she is in. `main` once it is over. */
  phase: SessionPhase;
  /** Seconds left on a timed step; null when the step waits on her instead. */
  remaining: number | null;
  /** How long the current timed step runs, for the ring's denominator. */
  duration: number | null;
  paused: boolean;
  /** 0-1 across the whole session, by completed sets. */
  progress: number;
  /** Advances the current step early — "Skip set", "I'm ready", "Start now". */
  advance: () => void;
  /** Adds time to whatever is on the clock. No-op on an untimed step. */
  addTime: () => void;
  togglePause: () => void;
  /** Every set the session asks for — warm-up, power and cool-down included. */
  setsDone: number;
  setsTotal: number;
  /**
   * True once every main-work set is behind her — whether she ran them or
   * skipped them one at a time.
   *
   * The session is worth logging from this moment on, and only from this
   * moment on. A cool-down she walks out of costs her nothing; a warm-up she
   * quit halfway through is not a session, however far the bar had crept.
   */
  mainDone: boolean;
};

/**
 * @param items Built by `buildSessionItems()` in planFormat — warm-up, work,
 *   power and cool-down already in run order with their doses resolved, and the
 *   power block already gated on `powerSessions`. Memoise it: the clock below
 *   re-arms on this array's identity, so an array rebuilt mid-session restarts
 *   the step she is standing on.
 * @param options.armed Whether the clock may run at all. Default true. A screen
 *   that shows something before the session — a setup card, a start button —
 *   must pass `false` until she has actually started, or the session runs
 *   underneath it: the first transition times out while she is still reading,
 *   and a long enough read finishes and logs a session she never did.
 * @param options.skipIntro Open on the first working set rather than on the
 *   "next up" card in front of it. For a session that is one continuous block —
 *   a walk, a bike ride — there is no next exercise to introduce, and twelve
 *   seconds of standing still is the wrong way to start twenty-five minutes of
 *   moving.
 */
export function useSessionPlayer(
  items: SessionExercise[],
  options: {
    compact?: boolean;
    startIndex?: number;
    armed?: boolean;
    skipIntro?: boolean;
    onFinish?: () => void;
  } = {}
): SessionPlayer {
  const { compact = false, startIndex = 0, armed = true, skipIntro = false, onFinish } = options;

  /** The step a session opens on, given where it starts and whether it has an intro. */
  const openingStep = useCallback(
    (index: number): SessionStep =>
      skipIntro ? { kind: 'work', index, set: 1, side: 0 } : { kind: 'transition', index },
    [skipIntro]
  );

  const [step, setStep] = useState<SessionStep>(() =>
    items.length ? openingStep(Math.min(startIndex, items.length - 1)) : { kind: 'done' }
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
    setStep(openingStep(Math.min(startIndex, items.length - 1)));
  }, [items.length, startIndex, openingStep]);

  const advance = useCallback(() => {
    setStep((prev) => nextStep(prev, items));
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

  /** Mirrors `remaining` so `togglePause` need not depend on a value that moves 4x a second. */
  const remainingRef = useRef<number | null>(null);
  remainingRef.current = remaining;

  /** Mirrors `step` so the clock can ask what comes next without re-arming on every step. */
  const stepRef = useRef(step);
  stepRef.current = step;

  const togglePause = useCallback(() => {
    setPaused((wasPaused) => {
      // Resuming restarts the clock from whatever was left when she paused.
      endsAt.current = wasPaused ? Date.now() + (remainingRef.current ?? 0) * 1000 : null;
      return !wasPaused;
    });
  }, []);

  // Arm the clock whenever the step changes to a timed one.
  useEffect(() => {
    lastTick.current = null;
    setBonus(0);
    // A pause belongs to the set she paused, not to the session. Skipping a set
    // while paused used to carry the pause into the rest that followed, which
    // only "pause" on a work step can clear — leaving her on a rest whose clock
    // never ran down and whose only way out was a tap.
    setPaused(false);
    if (baseDuration === null) {
      endsAt.current = null;
      setRemaining(null);
      return;
    }
    // Disarmed, the clock is shown but not started — the full dose sits on the
    // face, which is what a start button has to be standing next to.
    if (!armed) {
      endsAt.current = null;
      setRemaining(baseDuration);
      return;
    }
    endsAt.current = Date.now() + baseDuration * 1000;
    setRemaining(baseDuration);
  }, [step, baseDuration, armed]);

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
    if (baseDuration === null || paused || !armed) return;

    let cancelled = false;
    const readClock = () => {
      if (cancelled || endsAt.current === null) return;
      const left = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        endsAt.current = null;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        // Silent when the session itself is what ends here: the celebration
        // rings its own chime a beat later, and the two landing on top of each
        // other is a muddle where the bigger moment should be.
        if (nextStep(stepRef.current, items).kind !== 'done') playSessionCue('end');
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
  }, [baseDuration, paused, armed, advance, items]);

  // The last three seconds, heard and felt rather than watched — she is not
  // looking at the screen while she is holding a wall sit. Three ticks and then
  // the note above marks zero, so the clock can be followed with the phone
  // face-down on the mat.
  useEffect(() => {
    if (remaining === null || paused) return;
    if (remaining > 3 || remaining < 1) return;
    if (lastTick.current === remaining) return;
    lastTick.current = remaining;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    playSessionCue('tick');
  }, [remaining, paused]);

  const setsTotal = useMemo(() => totalSets(items), [items]);
  const setsDone = completedSets(step, items);
  const mainTotal = useMemo(() => totalSets(items, 'main'), [items]);
  // False, not true, for a session with no main work at all — a plan that sent
  // only a mobility flow. There is no "the work is done, only the cool-down is
  // left" to say about a session that was never anything but bookends, and
  // leaving one falls back to the ordinary how-far-in-was-she prompt.
  const mainDone = mainTotal > 0 && completedSets(step, items, 'main') >= mainTotal;

  const current = step.kind === 'done' ? null : items[step.index] ?? null;

  return {
    step,
    current,
    // Falls back to `main` rather than to the session's first phase: this is
    // read to pick colour and copy, and "the working part" is the safe default
    // for both when there is no exercise left to ask.
    phase: current?.phase ?? 'main',
    remaining,
    // The ring's denominator grows with "+ time", so its arc never runs backwards
    // past empty when she takes another twenty seconds.
    duration: baseDuration === null ? null : baseDuration + bonus,
    paused,
    progress: setsTotal ? Math.min(1, setsDone / setsTotal) : 0,
    advance,
    addTime,
    togglePause,
    setsDone,
    setsTotal,
    mainDone,
  };
}
