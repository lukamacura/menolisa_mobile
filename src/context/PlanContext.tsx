import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { isSubscriptionRequiredError } from '../lib/api';
import {
  addHabit as addHabitRequest,
  clearTask,
  completeTask,
  deleteHabit as deleteHabitRequest,
  fetchPlan,
  localDateString,
} from '../lib/planApi';
import {
  habitTaskKey,
  isPlanReady,
  type HabitKind,
  type PlanReady,
  type PlanTask,
  type PlanWeek,
} from '../lib/planTypes';
import { isPlanFinished } from '../lib/planFormat';
import { logger } from '../lib/logger';

/** How long a cached plan stays fresh before a focus event refetches it. */
const STALE_AFTER_MS = 60_000;
/** Gap between polls while the plan is still being written. */
const GENERATING_POLL_MS = 4_000;
/** Give up polling after this long and offer a retry. Server stall timeout is 120s. */
const GENERATING_TIMEOUT_MS = 180_000;
/**
 * Quiet period after the last write settles before we re-read the plan.
 *
 * `GET /api/plan` walks every log row since `startedAt` to rebuild ten nutrition
 * streaks plus one per habit — far too heavy to run after each of six water
 * taps, and it returns nothing the optimistic update hasn't already applied.
 * So we let the taps land, then reconcile once, silently.
 */
const RECONCILE_DEBOUNCE_MS = 4_000;
/** The server's zod schema caps `count` here. */
const MAX_COUNT = 20;

export type PlanStatus = 'loading' | 'generating' | 'ready' | 'error';

/**
 * Something she just finished. Emitted once, at the tick that finished it.
 *
 * Detected here rather than inferred from the rewards payload because this is
 * the only place that sees the *transition* — the server can say a row is done,
 * but not that this tap is what did it — and because it has to be instant. A
 * reward that waits on a round trip lands after she has already moved on.
 */
export type PlanCompletion = {
  /** Unique per event, so a repeat of the same row still re-triggers the UI. */
  id: number;
  /** What she finished, in her own plan's words. */
  title: string;
  /** "Nutrition" / "Movement" / "Relaxation" / "Habit" — the section it came from. */
  kind: string;
};

type PlanContextValue = {
  status: PlanStatus;
  plan: PlanReady | null;
  /** The local date the plan is scored against. */
  date: string;
  /**
   * Which eight weeks she is on. 1 until her first plan runs out, then 2, and
   * so on every 56 days.
   *
   * Null only before the first response of the session. It deliberately
   * survives `generating`: at a rollover the server sends the new cycle number
   * while the plan is still being written, and that is the window the recap of
   * the finished eight weeks belongs in.
   */
  cycle: number | null;
  /** The week with `state: 'current'`, or null. Never read locked weeks. */
  currentWeek: PlanWeek | null;
  /** Set when a tick failed and was rolled back. Render inline, never as an Alert. */
  error: string | null;
  clearError: () => void;
  /** Refetch. Skipped when the cached plan is fresh unless `force`. */
  refresh: (force?: boolean) => Promise<void>;
  /** Set the day's total for a key. `count` replaces — pass the new total, not a delta. */
  tick: (taskKey: string, count: number) => Promise<void>;
  /** Clear the day for a key. */
  clear: (taskKey: string) => Promise<void>;
  addHabit: (title: string, kind: HabitKind) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  /** The most recent thing she finished, until the reward for it is dismissed. */
  completion: PlanCompletion | null;
  clearCompletion: () => void;
};

const PlanContext = createContext<PlanContextValue | null>(null);

// ---------------------------------------------------------------------------
// Pure updates
//
// `POST /api/plan/complete` echoes back only what we sent — no streaks, no
// doneToday. So the client recomputes the derived fields by the server's own
// rules and a background refresh reconciles afterwards. We deliberately do not
// model streaks beyond today: the server measures the run to *yesterday* when
// today is not yet at target, which is what stops a 40-day streak reading 0
// every morning, and a second implementation of that would drift.
// ---------------------------------------------------------------------------

/** Apply a new day-total to whichever row `taskKey` names. Returns a new plan object. */
function applyCount(plan: PlanReady, taskKey: string, count: number): PlanReady {
  if (taskKey.startsWith('nut_')) return applyNutritionCount(plan, taskKey, count);
  if (taskKey.startsWith('habit_')) return applyHabitCount(plan, taskKey, count);
  return applyTaskCount(plan, taskKey, count);
}

function applyNutritionCount(plan: PlanReady, taskKey: string, count: number): PlanReady {
  const groups = plan.nutrition.groups.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      if (item.key !== taskKey) return item;
      const wasDone = item.doneToday;
      const isDone = count >= item.target;
      const streak = nextStreak(item.streak, wasDone, isDone);
      return {
        ...item,
        count,
        doneToday: isDone,
        streak,
        bestStreak: Math.max(item.bestStreak, streak),
      };
    }),
  }));

  const doneToday = groups.reduce(
    (total, group) => total + group.items.filter((item) => item.doneToday).length,
    0
  );

  return { ...plan, nutrition: { ...plan.nutrition, groups, doneToday } };
}

function applyHabitCount(plan: PlanReady, taskKey: string, count: number): PlanReady {
  const habits = plan.habits.map((habit) => {
    if (habitTaskKey(habit.id) !== taskKey) return habit;
    // Her own habits are always target 1 — any tick completes the day.
    const streak = nextStreak(habit.streak, habit.doneToday > 0, count > 0);
    return {
      ...habit,
      doneToday: count,
      streak,
      bestStreak: Math.max(habit.bestStreak, streak),
    };
  });
  return { ...plan, habits };
}

function applyTaskCount(plan: PlanReady, taskKey: string, count: number): PlanReady {
  // Past day 56 today falls outside week 8's counting window, so the server will
  // never include this tick in doneThisWeek. Bumping it locally would show her
  // progress that vanishes on the next read.
  const countsTowardWeek = !isPlanFinished(plan);

  const weeks = plan.weeks.map((week) => {
    if (!week.tasks.some((task) => task.key === taskKey)) return week;
    return {
      ...week,
      tasks: week.tasks.map((task) => {
        if (task.key !== taskKey) return task;
        const delta = count - task.doneToday;
        return {
          ...task,
          doneToday: count,
          // doneThisWeek is a sum across the week's days, so it moves by the delta.
          doneThisWeek: countsTowardWeek
            ? Math.max(0, task.doneThisWeek + delta)
            : task.doneThisWeek,
        };
      }),
    };
  });
  return { ...plan, weeks };
}

/** The server's rule: a day counts only once it reaches target. */
function nextStreak(streak: number, wasDone: boolean, isDone: boolean): number {
  if (!wasDone && isDone) return streak + 1;
  if (wasDone && !isDone) return Math.max(0, streak - 1);
  return streak;
}

/**
 * Re-apply the writes we are still waiting on, on top of a freshly read plan.
 *
 * `GET /api/plan` answers with the day as it stood when the query ran, so a
 * write that was still in the air is simply absent from it. Painting the
 * response as-is would un-tick a row she has already ticked.
 */
function applyPending(plan: PlanReady, pending: Map<string, number>): PlanReady {
  let next = plan;
  for (const [taskKey, count] of pending) next = applyCount(next, taskKey, count);
  return next;
}

/** Today's tick count for whichever row `taskKey` names. 0 when it isn't in the plan. */
function currentCountFor(plan: PlanReady, taskKey: string): number {
  if (taskKey.startsWith('nut_')) {
    for (const group of plan.nutrition.groups) {
      const item = group.items.find((row) => row.key === taskKey);
      if (item) return item.count;
    }
    return 0;
  }
  if (taskKey.startsWith('habit_')) {
    return plan.habits.find((habit) => habitTaskKey(habit.id) === taskKey)?.doneToday ?? 0;
  }
  for (const week of plan.weeks) {
    const task = week.tasks.find((entry) => entry.key === taskKey);
    if (task) return task.doneToday;
  }
  return 0;
}

/**
 * What (if anything) this tick just finished.
 *
 * The rules match what the server pays XP for, so a reward never appears for
 * something that earns nothing:
 *
 * - A **nutrition row** finishes when it reaches its target. The taps on the way
 *   there are parts of one thing, not four things — celebrating each would make
 *   the moment worthless and put six rewards behind a glass of water.
 * - A **plan task** finishes on every tick: one tap means one session done.
 * - A **habit** finishes the first time it is ticked that day.
 *
 * Returns null for un-ticking, and for a row that was already complete.
 */
function describeCompletion(
  plan: PlanReady,
  taskKey: string,
  previous: number,
  next: number
): Omit<PlanCompletion, 'id'> | null {
  if (next <= previous) return null;

  if (taskKey.startsWith('nut_')) {
    for (const group of plan.nutrition.groups) {
      const item = group.items.find((row) => row.key === taskKey);
      if (!item) continue;
      const justFinished = previous < item.target && next >= item.target;
      return justFinished ? { title: item.title, kind: 'Nutrition' } : null;
    }
    return null;
  }

  if (taskKey.startsWith('habit_')) {
    if (previous > 0) return null;
    const habit = plan.habits.find((row) => habitTaskKey(row.id) === taskKey);
    return habit ? { title: habit.title, kind: 'Habit' } : null;
  }

  for (const week of plan.weeks) {
    const task = week.tasks.find((entry) => entry.key === taskKey);
    if (!task) continue;
    return { title: task.title, kind: PILLAR_LABELS[task.pillar] };
  }
  return null;
}

/** Section names, for the line above the title in a reward. */
const PILLAR_LABELS: Record<PlanTask['pillar'], string> = {
  movement: 'Movement',
  relaxation: 'Relaxation',
  habit: 'Habit',
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [date, setDate] = useState(() => localDateString());
  const [plan, setPlan] = useState<PlanReady | null>(null);
  const [status, setStatus] = useState<PlanStatus>('loading');
  const [cycle, setCycle] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<PlanCompletion | null>(null);
  /** Monotonic, so finishing the same row twice is still two distinct events. */
  const completionSeq = useRef(0);

  const lastFetchedAt = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  /** Which date the in-flight read is for — a read for yesterday cannot satisfy today. */
  const inFlightDate = useRef<string | null>(null);
  const generatingSince = useRef<number | null>(null);
  const mounted = useRef(true);
  /** Mirrors `date` so callbacks don't re-identify every time it changes. */
  const dateRef = useRef(date);
  dateRef.current = date;
  /** Mirrors "we have a plan", for the staleness check, without capturing it. */
  const hasPlan = useRef(false);
  /** Mirrors `plan` itself, for rollbacks that need the pre-write value. */
  const planRef = useRef<PlanReady | null>(null);
  planRef.current = plan;

  // The write latch. One in-flight request per key, last tap wins — `count`
  // replaces the day's total server-side, so a superseded request is simply
  // discarded rather than needing to be undone. Six rapid water taps become two
  // or three requests, and the counter never spins or disables; the whole point
  // of the optimistic layer is that six taps feel like six taps.
  /** What we want the server to hold for a key. */
  const desired = useRef(new Map<string, number>());
  /** What we have actually sent and are waiting on. */
  const inflight = useRef(new Map<string, number>());
  /** The count before this burst of taps started — where a failure rolls back to. */
  const baseline = useRef(new Map<string, number>());
  const reconcileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Bumped by every tick. A read that starts at one value and lands at another
   * overlapped a write, and its payload predates that tap — see `load`.
   */
  const writeSeq = useRef(0);
  /** Assigned below: `load` needs to reschedule, and the scheduler needs `load`. */
  const scheduleReconcileRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * The only place a plan is fetched. Everything — the mount, the generating
   * poll, pull-to-refresh, the post-write reconcile — goes through here, so
   * there is never more than one read in the air. `GET /api/plan` rebuilds ten
   * nutrition streaks plus one per habit from every log row since `startedAt`;
   * two of them racing is both wasteful and a source of stale overwrites.
   */
  const load = useCallback(async (forDate: string) => {
    // Deduplicate only against a read for the *same* day. Sharing the promise
    // across a midnight rollover deadlocked the screen: the in-flight read was
    // for yesterday, so it discarded its own response as stale, and today's
    // read never happened — leaving the plan on the loading skeleton forever.
    if (inFlight.current && inFlightDate.current === forDate) return inFlight.current;

    // Sampled before the request goes out, not inside it, so a tap made while
    // it is in the air is visible when the response lands.
    const seqAtStart = writeSeq.current;

    const request = (async () => {
      try {
        const response = await fetchPlan(forDate);
        if (!mounted.current) return;
        // A response for a date we have since rolled off is stale — drop it
        // rather than paint yesterday over today.
        if (forDate !== dateRef.current) return;

        if (isPlanReady(response)) {
          // She ticked something while this read was in the air.
          //
          // The response is the day as it stood before that tap, so painting it
          // would silently un-tick the row she just tapped — and because the
          // reconcile fires a few seconds after the previous tick settles, that
          // is exactly the moment she is reaching for the next row. The
          // optimistic state is already correct; drop the stale read and take
          // another once the writes have gone quiet.
          if (hasPlan.current && writeSeq.current !== seqAtStart) {
            scheduleReconcileRef.current?.();
            return;
          }

          generatingSince.current = null;
          // Writes that were already in flight when the read started can be
          // missing from it too. Those we still hold the wanted value for, so
          // they go back on top rather than being lost.
          setPlan(applyPending(response, desired.current));
          // `?? 1` covers a server that predates cycles — she is on her first.
          setCycle(response.cycle ?? 1);
          setStatus('ready');
          hasPlan.current = true;
          lastFetchedAt.current = Date.now();
          return;
        }

        // Still being written. Poll — the server re-kicks a stalled run on read.
        // An older server sends no cycle here; leaving the last known value in
        // place is right either way, since a rollover only ever raises it.
        if (response.cycle) setCycle(response.cycle);
        if (generatingSince.current === null) generatingSince.current = Date.now();
        setStatus(
          Date.now() - generatingSince.current > GENERATING_TIMEOUT_MS ? 'error' : 'generating'
        );
      } catch (err) {
        if (!mounted.current) return;
        // A 403 has already re-synced AuthContext, which is moving the navigator
        // to the paywall — an error banner would only flash behind that.
        if (isSubscriptionRequiredError(err)) return;
        logger.error('Failed to load plan', err);
        setStatus((current) => (current === 'ready' ? 'ready' : 'error'));
        setError('We could not load your plan. Pull down to try again.');
      } finally {
        // Only clear if we are still the current read; a rollover may have
        // started a newer one that must stay tracked.
        if (inFlightDate.current === forDate) {
          inFlight.current = null;
          inFlightDate.current = null;
        }
      }
    })();

    inFlight.current = request;
    inFlightDate.current = forDate;
    return request;
  }, []);

  const refresh = useCallback(
    async (force = false) => {
      if (!force && hasPlan.current && Date.now() - lastFetchedAt.current < STALE_AFTER_MS) {
        return;
      }
      return load(dateRef.current);
    },
    [load]
  );

  // Initial load, and a full reload whenever the local date rolls over.
  //
  // Yesterday's counts are dropped rather than shown while the new day loads —
  // a screen of ticks that empties a second later reads as lost work. Pending
  // writes go too: they were aimed at yesterday, and each request body already
  // carries the date it was written for, so nothing in flight is corrupted.
  useEffect(() => {
    desired.current.clear();
    inflight.current.clear();
    baseline.current.clear();
    hasPlan.current = false;
    lastFetchedAt.current = 0;
    setPlan(null);
    setStatus('loading');
    load(date);
  }, [date, load]);

  // Poll while the plan is being generated.
  useEffect(() => {
    if (status !== 'generating') return;
    const timer = setInterval(() => load(dateRef.current), GENERATING_POLL_MS);
    return () => clearInterval(timer);
  }, [status, load]);

  // Midnight rollover.
  //
  // Two triggers, because either alone leaves a hole. The foreground check
  // catches the phone that was asleep at midnight; the timer catches the phone
  // that was awake — she is reading the plan at 23:58 and taps a box at 00:01,
  // and without this that tick is written against yesterday and vanishes from
  // her day when the screen next reloads.
  useEffect(() => {
    const rollIfNeeded = () => {
      const today = localDateString();
      setDate((current) => (current === today ? current : today));
    };

    let timer: ReturnType<typeof setTimeout>;
    const scheduleNextMidnight = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      // A second past, so the local date has definitely turned over.
      timer = setTimeout(() => {
        rollIfNeeded();
        scheduleNextMidnight();
      }, midnight.getTime() - now.getTime() + 1_000);
    };
    scheduleNextMidnight();

    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next !== 'active') return;
      rollIfNeeded();
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  // ---- the write path -----------------------------------------------------

  const scheduleReconcile = useCallback(() => {
    if (reconcileTimer.current) clearTimeout(reconcileTimer.current);
    reconcileTimer.current = setTimeout(() => {
      reconcileTimer.current = null;
      if (!mounted.current || inflight.current.size > 0) return;
      lastFetchedAt.current = 0;
      load(dateRef.current);
    }, RECONCILE_DEBOUNCE_MS);
  }, [load]);
  scheduleReconcileRef.current = scheduleReconcile;

  useEffect(
    () => () => {
      if (reconcileTimer.current) clearTimeout(reconcileTimer.current);
    },
    []
  );

  const flush = useCallback(
    async (taskKey: string) => {
      if (inflight.current.has(taskKey)) return;
      const wanted = desired.current.get(taskKey);
      if (wanted === undefined) return;

      inflight.current.set(taskKey, wanted);
      try {
        // `count: 0` is a 400 — clearing a day is `done: false`, not a zero count.
        if (wanted <= 0) await clearTask(taskKey, date);
        else await completeTask({ taskKey, date, count: wanted });

        inflight.current.delete(taskKey);
        if (!mounted.current) return;

        // She tapped again while that was in the air — chase the newer value.
        if (desired.current.get(taskKey) !== wanted) {
          flush(taskKey);
          return;
        }
        desired.current.delete(taskKey);
        baseline.current.delete(taskKey);
        scheduleReconcile();
      } catch (err) {
        inflight.current.delete(taskKey);
        if (!mounted.current) return;

        // A 403 has already fired the global handler and AppNavigator is swapping
        // the tree to the paywall. Rolling back a screen that is unmounting is noise.
        if (isSubscriptionRequiredError(err)) {
          desired.current.delete(taskKey);
          baseline.current.delete(taskKey);
          return;
        }

        logger.error('Failed to save tick', err);
        const previous = baseline.current.get(taskKey);
        desired.current.delete(taskKey);
        baseline.current.delete(taskKey);
        if (previous !== undefined) {
          setPlan((current) => (current ? applyCount(current, taskKey, previous) : current));
        }
        setError('That did not save. Check your connection and try again.');
      }
    },
    [date, scheduleReconcile]
  );

  const tick = useCallback(
    async (taskKey: string, count: number) => {
      // Clamped here, not just on the way out: the server caps `count` at
      // MAX_COUNT, so an optimistic 25 would paint a number that the reconcile
      // silently corrects to 20 a few seconds later.
      const next = Math.min(MAX_COUNT, Math.max(0, count));
      // Marks this tap for any read already in the air — see `load`.
      writeSeq.current += 1;
      setPlan((current) => {
        if (!current) return current;
        const previous = currentCountFor(current, taskKey);
        // Remember where to land if this whole burst fails.
        if (!baseline.current.has(taskKey)) {
          baseline.current.set(taskKey, previous);
        }

        // Fired optimistically, alongside the count it belongs to. She has done
        // the thing; the write is bookkeeping. If it later fails the count rolls
        // back and the error banner explains it — but a reward that waits for
        // the server to agree arrives too late to feel like a reward.
        const finished = describeCompletion(current, taskKey, previous, next);
        if (finished) {
          completionSeq.current += 1;
          const event = { id: completionSeq.current, ...finished };
          // Out of the updater: setState during another component's render phase
          // warns, and this one runs inside setPlan.
          queueMicrotask(() => {
            if (mounted.current) setCompletion(event);
          });
        }

        return applyCount(current, taskKey, next);
      });
      setError(null);
      desired.current.set(taskKey, next);
      await flush(taskKey);
    },
    [flush]
  );

  const clear = useCallback((taskKey: string) => tick(taskKey, 0), [tick]);

  const addHabit = useCallback(
    async (title: string, kind: HabitKind) => {
      const { habit } = await addHabitRequest(title, kind);
      if (!mounted.current) return;
      setPlan((current) =>
        current
          ? {
              ...current,
              habits: [...current.habits, habit],
              // The server drops an adopted suggestion on the next read; do it now
              // so the card does not sit there looking untaken.
              resistSuggestions: current.resistSuggestions.filter(
                (suggestion) => suggestion.title.toLowerCase() !== habit.title.toLowerCase()
              ),
            }
          : current
      );
    },
    []
  );

  const removeHabit = useCallback(
    async (id: string) => {
      // Captured before the write, not from inside the updater: a state updater
      // must be pure, may run twice under StrictMode, and is not guaranteed to
      // have run by the time the catch below needs the value.
      const snapshot = planRef.current;
      setPlan((current) =>
        current
          ? { ...current, habits: current.habits.filter((habit) => habit.id !== id) }
          : current
      );
      try {
        await deleteHabitRequest(id);
        // Deleting a habit also clears its logs server-side, and can bring a
        // resist suggestion back into the list — re-read rather than guess.
        lastFetchedAt.current = 0;
        load(dateRef.current);
      } catch (err) {
        if (!mounted.current) return;
        logger.error('Failed to remove habit', err);
        if (snapshot) setPlan(snapshot);
        setError('We could not remove that habit. Try again in a moment.');
      }
    },
    [load]
  );

  const clearCompletion = useCallback(() => setCompletion(null), []);

  const currentWeek = useMemo(
    () => plan?.weeks.find((week) => week.state === 'current') ?? null,
    [plan]
  );

  const value = useMemo<PlanContextValue>(
    () => ({
      status,
      plan,
      date,
      cycle,
      currentWeek,
      error,
      clearError: () => setError(null),
      refresh,
      tick,
      clear,
      addHabit,
      removeHabit,
      completion,
      clearCompletion,
    }),
    [
      status,
      plan,
      date,
      cycle,
      currentWeek,
      error,
      refresh,
      tick,
      clear,
      addHabit,
      removeHabit,
      completion,
      clearCompletion,
    ]
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const context = useContext(PlanContext);
  if (!context) throw new Error('usePlan must be used within a PlanProvider');
  return context;
}

/** The current week's tasks for one pillar, in plan order. */
export function tasksForPillar(week: PlanWeek | null, pillar: PlanTask['pillar']): PlanTask[] {
  return week?.tasks.filter((task) => task.pillar === pillar) ?? [];
}
