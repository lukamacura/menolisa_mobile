import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { usePlan } from './PlanContext';
import { isSubscriptionRequiredError } from '../lib/api';
import { fetchRewards } from '../lib/rewardsApi';
import { parseTierId, type Achievement, type RewardLevel, type RewardsPayload } from '../lib/rewardTypes';
import { logger } from '../lib/logger';

/** How long a cached payload stays fresh before a focus event refetches it. */
const STALE_AFTER_MS = 45_000;

/**
 * Quiet period after her last tick before we re-read rewards.
 *
 * Rewards are derived from the same logs `POST /api/plan/complete` writes, so a
 * read that overlaps a burst of six water taps scores a half-written day and
 * then has to correct itself. Letting the taps settle costs a few seconds of
 * staleness and buys a celebration that fires once, on the right tick.
 */
const AFTER_TICK_DEBOUNCE_MS = 4_500;

/** Per-user, so two accounts on one device don't inherit each other's history. */
const seenKey = (userId: string) => `rewards.seen.${userId}`;

/** One thing worth interrupting her for. */
export type Celebration =
  | {
      kind: 'achievement';
      achievement: Achievement;
      /** Stable id of the tier just earned, e.g. "wildfire.7". */
      tierId: string;
      /** 1-based tier number within the family. */
      tier: number;
      /** What that tier asked for. */
      target: number;
    }
  | { kind: 'level'; level: RewardLevel };

type RewardsContextValue = {
  status: 'loading' | 'ready' | 'error';
  rewards: RewardsPayload | null;
  /** The celebration currently on screen, if any. */
  celebration: Celebration | null;
  /** Dismiss the current one; the next queued celebration takes its place. */
  dismissCelebration: () => void;
  /** Refetch. Skipped when the cached payload is fresh unless `force`. */
  refresh: (force?: boolean) => Promise<void>;
};

const RewardsContext = createContext<RewardsContextValue | null>(null);

/**
 * Her XP, streak and achievements — and the decision of when to celebrate one.
 *
 * Must sit inside `PlanProvider`: it reads the plan's date so both are scored
 * against the same local day, and it watches the plan for ticks so a badge
 * earned by checking a box announces itself without every screen having to
 * remember to ask.
 */
export function RewardsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { plan, date } = usePlan();

  const [rewards, setRewards] = useState<RewardsPayload | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [queue, setQueue] = useState<Celebration[]>([]);

  const mounted = useRef(true);
  const inFlight = useRef<Promise<void> | null>(null);
  /** Which date the in-flight read is for — see the same guard in PlanContext. */
  const inFlightDate = useRef<string | null>(null);
  const lastFetchedAt = useRef(0);
  /** Mirrors "we have a payload", so the freshness check needs no state dependency. */
  const hasRewards = useRef(false);
  const dateRef = useRef(date);
  dateRef.current = date;

  /**
   * Tiers she has already been shown. `null` until it is read from storage —
   * nothing may be celebrated before then, or a cold start races the read and
   * replays her whole history.
   */
  const seen = useRef<Set<string> | null>(null);
  /** Her level at the last read, so a level-up can be spotted. Null on first read. */
  const lastLevel = useRef<number | null>(null);
  const tickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Load (or reset) the seen set whenever the signed-in user changes.
  useEffect(() => {
    seen.current = null;
    lastLevel.current = null;
    hasRewards.current = false;
    setRewards(null);
    setStatus('loading');
    setQueue([]);

    if (!user?.id) return;
    let cancelled = false;

    AsyncStorage.getItem(seenKey(user.id))
      .then((raw) => {
        if (cancelled) return;
        if (!raw) {
          // No record for this account on this device. Whatever she has already
          // earned gets seeded silently by the first fetch below — see `reconcile`.
          seen.current = null;
          return;
        }
        try {
          const parsed = JSON.parse(raw);
          seen.current = new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
        } catch {
          seen.current = new Set();
        }
      })
      .catch((err) => {
        if (cancelled) return;
        logger.error('Failed to read reward history', err);
        // Treat an unreadable store as a first run: seed silently rather than
        // celebrate everything she has ever done.
        seen.current = null;
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const persistSeen = useCallback(
    (ids: Set<string>) => {
      if (!user?.id) return;
      AsyncStorage.setItem(seenKey(user.id), JSON.stringify([...ids])).catch((err) =>
        logger.error('Failed to save reward history', err)
      );
    },
    [user?.id]
  );

  /**
   * Decide what to celebrate from a fresh payload.
   *
   * The first payload for an account on a device is *seeded, not celebrated*.
   * Rewards are computed from her whole history, so someone six weeks in would
   * otherwise be met with forty modals — and a reinstall would do it again.
   * Silence there is what makes every celebration after it mean something.
   */
  const reconcile = useCallback(
    (payload: RewardsPayload) => {
      const earned = new Set(payload.earned);

      if (seen.current === null) {
        seen.current = earned;
        lastLevel.current = payload.level.level;
        persistSeen(earned);
        return;
      }

      const fresh: Celebration[] = [];
      for (const achievement of payload.achievements) {
        // `earned` is ascending, so an index is the 1-based tier number.
        achievement.earned.forEach((tierId, index) => {
          if (seen.current!.has(tierId)) return;
          fresh.push({
            kind: 'achievement',
            achievement,
            tierId,
            tier: index + 1,
            target: parseTierId(tierId)?.target ?? 0,
          });
        });
      }

      if (lastLevel.current !== null && payload.level.level > lastLevel.current) {
        fresh.push({ kind: 'level', level: payload.level });
      }
      lastLevel.current = payload.level.level;

      if (fresh.length === 0) return;

      // Biggest last: the modals are dismissed in order, so a level-up lands as
      // the finale rather than being buried under three bronze tiers.
      fresh.sort((a, b) => rank(a) - rank(b));

      seen.current = earned;
      persistSeen(earned);
      setQueue((current) => [...current, ...fresh]);
    },
    [persistSeen]
  );

  const load = useCallback(
    async (forDate: string) => {
      if (!user?.id) return;
      // Same-day dedupe only: a read for yesterday discards its own response as
      // stale, so sharing it across a rollover would strand rewards on 'loading'.
      if (inFlight.current && inFlightDate.current === forDate) return inFlight.current;

      const request = (async () => {
        try {
          const payload = await fetchRewards(forDate);
          if (!mounted.current) return;
          // A payload for a day we have since rolled off is stale.
          if (forDate !== dateRef.current) return;

          setRewards(payload);
          setStatus('ready');
          hasRewards.current = true;
          lastFetchedAt.current = Date.now();
          reconcile(payload);
        } catch (err) {
          if (!mounted.current) return;
          // A 403 has already re-synced AuthContext and the navigator is moving
          // to the paywall. Nothing to show behind it.
          if (isSubscriptionRequiredError(err)) return;
          logger.error('Failed to load rewards', err);
          setStatus((current) => (current === 'ready' ? 'ready' : 'error'));
        } finally {
          if (inFlightDate.current === forDate) {
            inFlight.current = null;
            inFlightDate.current = null;
          }
        }
      })();

      inFlight.current = request;
      inFlightDate.current = forDate;
      return request;
    },
    [user?.id, reconcile]
  );

  // Referentially stable: this is a `useFocusEffect` dependency on the hub, and
  // one that changed identity on every response turned a single focus into a
  // cascade of reads.
  const refresh = useCallback(
    async (force = false) => {
      if (!force && hasRewards.current && Date.now() - lastFetchedAt.current < STALE_AFTER_MS) {
        return;
      }
      return load(dateRef.current);
    },
    [load]
  );

  // Initial load, and a fresh one whenever the local date rolls over.
  useEffect(() => {
    if (!user?.id) return;
    lastFetchedAt.current = 0;
    load(date);
  }, [user?.id, date, load]);

  /**
   * Re-read after she ticks something.
   *
   * `plan` is replaced by PlanContext's optimistic update on every tap, which
   * makes its identity a reliable "she just did something" signal without the
   * two contexts having to know about each other. Debounced, so a burst of taps
   * is one read — and long enough that the writes have landed, since rewards
   * are derived from those same rows server-side.
   */
  useEffect(() => {
    if (!plan || !user?.id) return;
    if (tickTimer.current) clearTimeout(tickTimer.current);
    tickTimer.current = setTimeout(() => {
      tickTimer.current = null;
      lastFetchedAt.current = 0;
      load(dateRef.current);
    }, AFTER_TICK_DEBOUNCE_MS);

    return () => {
      if (tickTimer.current) clearTimeout(tickTimer.current);
    };
  }, [plan, user?.id, load]);

  const dismissCelebration = useCallback(() => setQueue((current) => current.slice(1)), []);

  const value = useMemo<RewardsContextValue>(
    () => ({
      status,
      rewards,
      celebration: queue[0] ?? null,
      dismissCelebration,
      refresh,
    }),
    [status, rewards, queue, dismissCelebration, refresh]
  );

  return <RewardsContext.Provider value={value}>{children}</RewardsContext.Provider>;
}

/** Ordering weight for the celebration queue — a level-up outranks any badge. */
function rank(item: Celebration): number {
  return item.kind === 'level' ? 100 : item.tier;
}

export function useRewards(): RewardsContextValue {
  const context = useContext(RewardsContext);
  if (!context) throw new Error('useRewards must be used within a RewardsProvider');
  return context;
}
