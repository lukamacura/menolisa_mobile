/**
 * Whether she is owed the "your eight weeks" recap, and the bookkeeping to
 * make sure she is only ever shown it once.
 *
 * Every 56 days the server scores what she did, writes her the next plan, and
 * raises her cycle number. Cycle 2 means cycle 1 just ended — so the recap is
 * always about `cycle - 1`, and "has she seen it" is one integer per user:
 * the highest finished cycle she has already been walked through.
 *
 * It reads the cycle from `PlanContext`, which carries it through `generating`.
 * At a rollover the next plan takes ~20 seconds to write, and the recap is what
 * that time is for — waiting for `ready` would show her the summary *after* the
 * new plan had already replaced it on screen.
 *
 * See `lib/seenMarker.ts` for why the marker is a shared store rather than
 * component state, and why it lives on the device.
 */

import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../context/PlanContext';
import { useSeenMarker } from '../lib/seenMarker';

export type PlanCycleRecapState = {
  /**
   * The finished cycle she has not been shown yet, or null.
   *
   * Null until the stored marker has loaded, so the recap can never flash at a
   * woman who dismissed it a minute ago.
   */
  pendingCycle: number | null;
  /** Call when she has been through it. Idempotent. */
  markSeen: () => void;
};

export function usePlanCycleRecap(): PlanCycleRecapState {
  const { user } = useAuth();
  const { cycle } = usePlan();

  const { value, loaded, save } = useSeenMarker(
    user?.id ? `plan.recapSeen.${user.id}` : null
  );

  const seen = loaded ? parseInt(value ?? '0', 10) || 0 : null;
  const finished = cycle && cycle > 1 ? cycle - 1 : 0;
  const pendingCycle = seen !== null && finished > seen ? finished : null;

  const markSeen = useCallback(() => {
    if (finished) save(String(finished));
  }, [finished, save]);

  return { pendingCycle, markSeen };
}
