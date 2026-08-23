/**
 * Types for `GET /api/plan/history`, as the Next.js app returns it.
 *
 * The server owns the scoring — see `lib/plan/history.ts` in `menolisa_web` for
 * the rule. This app renders `ratio` and nothing else. Do not re-derive a
 * percentage here from `done`/`target`: those are raw counts kept for the
 * sentence under the ring, and a pillar with two tasks averages their ratios
 * rather than pooling their totals, so the two will not agree.
 *
 * The one thing to hold on to while rendering:
 *
 *   **`null` means the plan asked nothing of her there. Never draw it as zero.**
 *
 * Movement is usually two sessions *somewhere* in a week, so on the five days
 * she was meant to rest `day.movement` is `null` — an empty arc there would
 * mark a perfect week as two-thirds failed.
 */

/** One pillar's standing over a day, a week, or the plan so far. */
export type PillarProgress = {
  /** Raw count — sessions done, nutrition tasks finished. For copy, not the ring. */
  done: number;
  /** What the raw count was measured against. */
  target: number;
  /** 0-1, already clamped. The only field the ring reads. */
  ratio: number;
};

/** `past` and `today` carry scores; `future` never does. */
export type DayState = 'past' | 'today' | 'future';

export type DayProgress = {
  date: string;
  /** 1-based within the plan, so day 1 of week 3 is 15. */
  dayOfPlan: number;
  week: number;
  state: DayState;
  movement: PillarProgress | null;
  nutrition: PillarProgress | null;
  relaxation: PillarProgress | null;
  /** Mean of the pillars in play. 0 on a future day. */
  score: number;
};

export type WeekProgressState = 'past' | 'current' | 'locked';

export type WeekProgress = {
  number: number;
  title: string;
  /** Empty on a locked week — she cannot read ahead. */
  focus: string;
  state: WeekProgressState;
  startDate: string;
  endDate: string;
  movement: PillarProgress | null;
  nutrition: PillarProgress | null;
  relaxation: PillarProgress | null;
  score: number;
  /** Always exactly 7, in order. */
  days: DayProgress[];
};

/**
 * One of her eight-week cycles, for the switcher.
 *
 * The server sends every cycle on every response, so the switcher never costs
 * a second request — and a woman on her first plan gets a one-item list, which
 * the screen renders as nothing at all.
 */
export type PlanCycle = {
  cycle: number;
  startedAt: string;
  /** Day 56. In the future for the cycle she is living in. */
  endsAt: string;
  current: boolean;
};

export type PlanHistory = {
  /** Which cycle this grid scores. Absent on a server older than 2026-08-23. */
  cycle?: number;
  /** Every cycle she has started, oldest first. One entry means no switcher. */
  cycles?: PlanCycle[];
  startedAt: string;
  /** The local date this was scored against. */
  date: string;
  currentWeek: number;
  /** Always 8, but read it rather than assuming. */
  totalWeeks: number;
  daysElapsed: number;
  /** Always exactly `totalWeeks`, in order. */
  weeks: WeekProgress[];
  overall: {
    movement: PillarProgress | null;
    nutrition: PillarProgress | null;
    relaxation: PillarProgress | null;
    score: number;
  };
};

/** The three pillars the grid scores. Habits and symptoms are deliberately out — see ProgressScreen. */
export const HISTORY_PILLARS = ['movement', 'nutrition', 'relaxation'] as const;
export type HistoryPillar = (typeof HISTORY_PILLARS)[number];

/** `0.62` → `62`. The only place a ratio becomes a number she reads. */
export function toPercent(ratio: number): number {
  return Math.round(Math.min(1, Math.max(0, ratio)) * 100);
}
