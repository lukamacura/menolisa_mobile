import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { BreathPhase } from '../lib/planTypes';

/** How often we sample the clock. Fine enough for a 1-second `top_up` phase. */
const SAMPLE_MS = 100;

export type BreathingState = {
  phase: BreathPhase | null;
  phaseIndex: number;
  /** 0-based round currently in progress. */
  round: number;
  rounds: number;
  /** Whole seconds left in the current phase, for the countdown. */
  secondsLeft: number;
  /** How far through the current phase, 0-1. Drives the visual. */
  phaseProgress: number;
  running: boolean;
  done: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
};

/**
 * The timing engine for a breathing pattern.
 *
 * Derives everything from wall time rather than accumulating ticks, so a busy
 * JS thread makes it skip ahead rather than drift — after fifteen minutes of
 * paced respiration an accumulating timer would be seconds out, and she is
 * following the circle with her lungs.
 *
 * Auto-pauses when the app leaves the foreground. The longest pattern is 15
 * minutes and nothing here keeps the screen awake, so backgrounding mid-session
 * is expected, not exceptional.
 */
export function useBreathingSession(phases: BreathPhase[], rounds: number): BreathingState {
  const cycleMs = useMemo(
    () => phases.reduce((total, phase) => total + phase.seconds * 1000, 0),
    [phases]
  );

  /** Cumulative start offset of each phase within one cycle. */
  const offsets = useMemo(() => {
    let running = 0;
    return phases.map((phase) => {
      const start = running;
      running += phase.seconds * 1000;
      return start;
    });
  }, [phases]);

  const startedAt = useRef<number | null>(null);
  const pausedAt = useRef<number | null>(null);
  const pausedTotal = useRef(0);

  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const start = useCallback(() => {
    startedAt.current = Date.now();
    pausedAt.current = null;
    pausedTotal.current = 0;
    setElapsed(0);
    setDone(false);
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    if (pausedAt.current !== null || startedAt.current === null) return;
    pausedAt.current = Date.now();
    setRunning(false);
  }, []);

  const resume = useCallback(() => {
    if (pausedAt.current === null) return;
    pausedTotal.current += Date.now() - pausedAt.current;
    pausedAt.current = null;
    setRunning(true);
  }, []);

  const reset = useCallback(() => {
    startedAt.current = null;
    pausedAt.current = null;
    pausedTotal.current = 0;
    setElapsed(0);
    setRunning(false);
    setDone(false);
  }, []);

  useEffect(() => {
    if (!running || cycleMs === 0) return;
    const timer = setInterval(() => {
      if (startedAt.current === null) return;
      const next = Date.now() - startedAt.current - pausedTotal.current;
      const total = cycleMs * rounds;
      if (next >= total) {
        setElapsed(total);
        setRunning(false);
        setDone(true);
        return;
      }
      setElapsed(next);
    }, SAMPLE_MS);
    return () => clearInterval(timer);
  }, [running, cycleMs, rounds]);

  // Backgrounding mid-session pauses rather than silently running on — she
  // cannot follow a circle she cannot see, and resuming where she left off is
  // the only honest option.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next !== 'active') pause();
    });
    return () => subscription.remove();
  }, [pause]);

  const round = cycleMs > 0 ? Math.min(rounds - 1, Math.floor(elapsed / cycleMs)) : 0;
  const intoCycle = cycleMs > 0 ? elapsed % cycleMs : 0;

  let phaseIndex = 0;
  for (let index = phases.length - 1; index >= 0; index -= 1) {
    if (intoCycle >= offsets[index]) {
      phaseIndex = index;
      break;
    }
  }

  const phase = phases[phaseIndex] ?? null;
  const phaseMs = (phase?.seconds ?? 0) * 1000;
  const intoPhase = intoCycle - (offsets[phaseIndex] ?? 0);

  return {
    phase,
    phaseIndex,
    round,
    rounds,
    secondsLeft: phase ? Math.max(1, Math.ceil((phaseMs - intoPhase) / 1000)) : 0,
    phaseProgress: phaseMs > 0 ? Math.min(1, intoPhase / phaseMs) : 0,
    running,
    done,
    start,
    pause,
    resume,
    reset,
  };
}
