/**
 * Types for the generated 8-week plan, as `GET /api/plan` returns it.
 *
 * The contract lives in the web app (`app/api/plan/route.ts`) and is documented in
 * `docs/generated_plan.md`. Three things about this payload catch people out:
 *
 * 1. `doneToday` is a NUMBER on tasks and habits but a BOOLEAN on nutrition rows
 *    (there it means `count >= target`). No shared renderer may assume one type.
 * 2. `count` on `POST /api/plan/complete` REPLACES the day's total — it does not add.
 * 3. `video`/`poster` only arrive with `?media=1` AND once the server's `MEDIA_READY`
 *    set lists the exercise id. It is empty today, so treat clips as optional forever.
 */

/** Pillars that appear as plan tasks. Nutrition is never a task — it has its own section. */
export type PlanPillar = 'movement' | 'relaxation' | 'habit';

/** How often a task is meant to happen. Read together with `target`. */
export type PlanCadence = 'daily' | 'weekly' | 'per_day';

/** `past` and `current` carry tasks; `locked` never does. */
export type PlanWeekState = 'past' | 'current' | 'locked';

export type HabitKind = 'build' | 'resist';

/** One exercise inside a movement task, joined against the catalog server-side. */
export type PlanExercise = {
  /** Catalog id, e.g. "L01". Strength ids carry sets+reps; cardio ids (prefix "K") carry minutes. */
  id: string;
  sets?: number;
  reps?: number;
  minutes?: number;
  /** Joined from the catalog — e.g. "Box squat". Never stored on the plan itself. */
  name: string;
  /** Equipment, e.g. "Sturdy chair". */
  props: string;
  /** Only with `?media=1` and only for ids the server has clips for. */
  video?: string;
  poster?: string;
};

/** One step of a breathing pattern. `top_up` is a 1-second sip, used only by `breath_sigh`. */
export type BreathPhase = {
  key: 'in' | 'hold' | 'out' | 'top_up';
  /** "Breathe in" / "Hold" / "Breathe out" / "Short sip in" — fixed server-side. */
  label: string;
  seconds: number;
};

export type RelaxationBreathing = {
  kind: 'breathing';
  /** When to reach for it, e.g. "The moment you feel one starting." */
  use: string;
  phases: BreathPhase[];
  rounds: number;
  cycleSeconds: number;
  totalSeconds: number;
  /** One decimal, e.g. 3.8. */
  breathsPerMinute: number;
};

export type RelaxationPractice = {
  kind: 'practice';
  use: string;
  minutes: number;
};

export type RelaxationDetail = RelaxationBreathing | RelaxationPractice;

export type PlanTask = {
  /** Stable log key, `w<week>_<suffix>` — e.g. "w1_movement0", "w3_breath_sleep". */
  key: string;
  pillar: PlanPillar;
  title: string;
  why: string;
  cadence: PlanCadence;
  /** Completions a full period takes. daily → 1, weekly → 2-4, per_day → 2-6. */
  target: number;
  /** Ticks logged for the requested date. A NUMBER, not a boolean. */
  doneToday: number;
  /** Sum across this plan-week's 7 days — offset from `startedAt`, not Mon-Sun. */
  doneThisWeek: number;
  /** Movement tasks only. */
  exercises?: PlanExercise[];
  /** Relaxation tasks only. Undefined when the key suffix is not a catalog id. */
  relaxation?: RelaxationDetail;
};

export type PlanWeek = {
  number: number;
  title: string;
  /** Empty string on locked weeks. */
  focus: string;
  state: PlanWeekState;
  /** Always empty on locked weeks — she cannot read ahead. */
  tasks: PlanTask[];
};

export type NutritionItem = {
  /** Catalog id, e.g. "protein_25_30g". */
  id: string;
  /** Log key — `nut_<id>`. Send THIS to /api/plan/complete, not `id`. */
  key: string;
  /** Display label. Never hardcode it; it has changed before. */
  title: string;
  /** Group header, e.g. "Every meal". Also render from the response. */
  group: string;
  /** True when this week's plan pushes on this row. */
  focus: boolean;
  /** Why this row is on her list — written for her at plan generation. Always present. */
  why: string;
  /** Ticks a full day takes. */
  target: number;
  /** Ticks the UI should offer. Only water differs from target (6 → 8). */
  max: number;
  count: number;
  /** `count >= target`. A BOOLEAN here, unlike PlanTask/PlanHabit. */
  doneToday: boolean;
  streak: number;
  bestStreak: number;
};

export type NutritionGroup = {
  title: string;
  items: NutritionItem[];
};

export type PlanNutrition = {
  /** Ten today, but read it rather than assuming. */
  total: number;
  /** Number of FULLY complete rows (count >= target), not rows with any tick. */
  doneToday: number;
  groups: NutritionGroup[];
  /** Shown under the `supplements` row once ticked. Never counted toward `total`. */
  supplements: { id: string; label: string }[];
};

export type PlanHabit = {
  id: string;
  title: string;
  kind: HabitKind;
  /** Ticks for the requested date. A NUMBER. */
  doneToday: number;
  streak: number;
  bestStreak: number;
};

/** A temptation she gets credit for resisting. An offer until she adopts it as a habit. */
export type ResistSuggestion = {
  title: string;
  why: string;
};

export type PlanGenerating = {
  status: 'generating';
};

export type PlanReady = {
  status: 'ready';
  /** The date the server resolved — echo of what we sent, unless it was rejected. */
  date: string;
  /** Day 1 of week 1. Stamped by the first-ever GET from the date we sent. */
  startedAt: string;
  /** 1-8, clamped. Stays at 8 forever once she is past day 56. */
  currentWeek: number;
  /** Always exactly 8, in order. */
  weeks: PlanWeek[];
  nutrition: PlanNutrition;
  habits: PlanHabit[];
  /** Only the ones she has not already taken up as habits. */
  resistSuggestions: ResistSuggestion[];
};

export type PlanResponse = PlanGenerating | PlanReady;

/** The habit row `POST /api/plan/habits` returns — same shape as one from `GET /api/plan`. */
export type AddHabitResponse = {
  habit: PlanHabit;
};

/** What `POST /api/plan/complete` echoes back. Notably: no streaks, no doneToday. */
export type CompleteResponse = {
  taskKey: string;
  date: string;
  count: number;
};

/** The server rejects an 11th habit with a 400. */
export const MAX_HABITS = 10;

/** Weeks in a plan. The server always returns this many, padding locked ones. */
export const PLAN_WEEKS = 8;

export function isPlanReady(plan: PlanResponse): plan is PlanReady {
  return plan.status === 'ready';
}

/** The log key for one of her own habits. */
export function habitTaskKey(habitId: string): string {
  return `habit_${habitId}`;
}
