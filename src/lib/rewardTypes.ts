/**
 * Types for `GET /api/rewards`, as the Next.js app returns it.
 *
 * The server owns the whole rulebook — XP values, level thresholds, every
 * achievement target. This app owns icons, colours and celebration, and nothing
 * else. Do not re-derive a threshold here to "save a round trip": a badge that
 * unlocks on the phone but not on the server (or the reverse) is worse than no
 * badge, and the two copies drift the first time a number is tuned.
 *
 * The payload is computed from her logs on every read, so it is safe to refetch
 * freely and there is nothing to keep in sync locally.
 */

/** Every measurable the achievements score against. */
export type RewardMetric =
  | 'bestStreak'
  | 'totalXp'
  | 'nutritionRows'
  | 'waterDays'
  | 'proteinDays'
  | 'movementSessions'
  | 'relaxationSessions'
  | 'habitTicks'
  | 'goalDays'
  | 'activeDays'
  | 'symptomLogs'
  | 'planWeek'
  | 'weekendDays'
  | 'totalTicks'
  | 'comebacks'
  | 'bigDays'
  | 'strongWeeks';

export type RewardLevel = {
  /** 1-based. */
  level: number;
  /** "Spark", "Ember", … Repeats past the last name while the number climbs. */
  name: string;
  floor: number;
  ceiling: number;
  intoLevel: number;
  levelSpan: number;
  toNext: number;
  /** 0-1 through the current level. */
  progress: number;
};

export type Achievement = {
  /** Family id, e.g. "wildfire". Stable — safe to key visuals off. */
  id: string;
  name: string;
  blurb: string;
  metric: RewardMetric;
  /** Where she is on this family's metric. */
  value: number;
  /** Tiers earned. 0 means still locked. */
  tier: number;
  maxTier: number;
  /** What the next tier needs, or null once every tier is earned. */
  target: number | null;
  /** The tier she last passed — the progress bar's left edge, not zero. */
  floor: number;
  /** Ready-to-render sentence for the next tier. Empty when complete. */
  goal: string;
  unlocked: boolean;
  complete: boolean;
  /** 0-1 toward the next tier. */
  progress: number;
  /** Stable ids of tiers earned, e.g. "wildfire.7". The celebration key. */
  earned: string[];
};

export type RewardStats = Record<RewardMetric, number> & {
  todayXp: number;
  streak: number;
  activeToday: boolean;
};

export type RewardsPayload = {
  /** The local date the payload was scored against. */
  date: string;
  xp: {
    /** Lifetime. */
    total: number;
    /** Earned on `date`. */
    today: number;
    /** The daily target. Server-owned — never hardcode it. */
    goal: number;
    /** What one finished thing pays. Label rewards from this, never a literal. */
    perCompletion: number;
  };
  level: RewardLevel;
  streak: {
    current: number;
    best: number;
    /** False before her first tick of the day, while `current` still counts to yesterday. */
    activeToday: boolean;
  };
  stats: RewardStats;
  achievements: Achievement[];
  /** Every tier earned across all families, flattened. */
  earned: string[];
};

/** Split `"wildfire.7"` into its family id and tier number. */
export function parseTierId(tierId: string): { familyId: string; target: number } | null {
  const dot = tierId.lastIndexOf('.');
  if (dot <= 0) return null;
  const target = Number(tierId.slice(dot + 1));
  if (!Number.isFinite(target)) return null;
  return { familyId: tierId.slice(0, dot), target };
}

/** 0-1 toward the daily XP goal, clamped — she can earn well past it. */
export function goalProgress(payload: RewardsPayload): number {
  if (payload.xp.goal <= 0) return 0;
  return Math.min(1, Math.max(0, payload.xp.today / payload.xp.goal));
}
