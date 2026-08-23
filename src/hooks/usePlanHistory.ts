import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlan } from '../context/PlanContext';
import { ApiError } from '../lib/api';
import { fetchPlanHistory } from '../lib/planHistoryApi';
import type { PlanHistory } from '../lib/planHistoryTypes';
import { logger } from '../lib/logger';

/** How long a payload stays fresh before a focus event refetches it. */
const STALE_AFTER_MS = 30_000;

export type PlanHistoryState = {
  status: 'loading' | 'ready' | 'empty' | 'error';
  history: PlanHistory | null;
  /**
   * A fetch for a *different* cycle is in flight.
   *
   * Its own flag rather than `status`, because the payload on screen while it
   * runs is still valid — it is simply the wrong eight weeks. The screen swaps
   * in a skeleton on this; a focus refetch or a pull-to-refresh, which return
   * the same eight weeks, deliberately never raises it.
   */
  switching: boolean;
  /** Refetch. Skipped while fresh unless `force`. */
  refresh: (force?: boolean) => Promise<void>;
};

/**
 * Her eight weeks, scored.
 *
 * Screen-local rather than a context: only the progress screen reads it, it is
 * a pure derivation the server recomputes on every request, and putting it in a
 * provider would have every tick anywhere in the app invalidating a payload
 * nobody is looking at.
 *
 * The plan's date is the clock, not `new Date()` — the grid and the daily loop
 * must agree on which day is "today" or the coral halo lands on the wrong cell
 * for anyone whose device crossed midnight while the app was backgrounded.
 *
 * `cycle` picks which eight weeks to score. Null — the default — means the ones
 * she is living in, which is what every caller but the switcher wants. A
 * finished cycle is scored server-side against its own last day, so it renders
 * as eight full weeks rather than trailing off into blank future.
 */
export function usePlanHistory(cycle: number | null = null): PlanHistoryState {
  const { date } = usePlan();
  const [history, setHistory] = useState<PlanHistory | null>(null);
  const [status, setStatus] = useState<PlanHistoryState['status']>('loading');
  const [switching, setSwitching] = useState(false);

  const mounted = useRef(true);
  const inFlight = useRef<Promise<void> | null>(null);
  const lastFetchedAt = useRef(0);
  const lastDate = useRef(date);
  const lastCycle = useRef(cycle);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(
    async (force = false) => {
      if (!date) return;
      // A rolled-over date always refetches: yesterday's grid is the wrong shape.
      // So does a switch to another cycle — the cached payload is a different
      // eight weeks entirely, and showing it under the new label would be a lie.
      const dateChanged = lastDate.current !== date;
      const cycleChanged = lastCycle.current !== cycle;
      if (
        !force &&
        !dateChanged &&
        !cycleChanged &&
        history &&
        Date.now() - lastFetchedAt.current < STALE_AFTER_MS
      ) {
        return;
      }
      if (inFlight.current) return inFlight.current;

      // Only a cycle change: the first load has its own empty state, and a
      // refresh of the same cycle must leave her grid where it is.
      if (cycleChanged && history) setSwitching(true);

      const run = (async () => {
        try {
          const payload = await fetchPlanHistory(date, cycle);
          if (!mounted.current) return;
          lastDate.current = date;
          lastCycle.current = cycle;
          lastFetchedAt.current = Date.now();
          setHistory(payload);
          setStatus('ready');
        } catch (err) {
          if (!mounted.current) return;
          // 404 is "no plan yet", not a failure — she is still being written one,
          // and the daily loop is already showing her that.
          if (err instanceof ApiError && err.status === 404) {
            setStatus('empty');
            return;
          }
          logger.error('Plan history fetch failed', err);
          // Keep whatever is on screen. A grid that blanks out on a dropped
          // connection loses eight weeks she just scrolled through.
          setStatus(history ? 'ready' : 'error');
        } finally {
          inFlight.current = null;
          if (mounted.current) setSwitching(false);
        }
      })();

      inFlight.current = run;
      return run;
    },
    [date, cycle, history]
  );

  useEffect(() => {
    refresh().catch(() => {});
    // Only on date or cycle change: focus refetches are the screen's job.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, cycle]);

  return { status, history, switching, refresh };
}
