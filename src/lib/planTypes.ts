/**
 * Types for the generated 8-week plan, as `GET /api/plan` returns it.
 *
 * The contract lives in the web app (`app/api/plan/route.ts`) and is documented in
 * `docs/generated_plan.md`. Three things about this payload catch people out:
 *
 * 1. `doneToday` is a NUMBER on tasks and habits but a BOOLEAN on nutrition rows
 *    (there it means `count >= target`). No shared renderer may assume one type.
 * 2. `count` on `POST /api/plan/complete` REPLACES the day's total — it does not add.
 * 3. `video` only arrives with `?media=1` AND once the server's `MEDIA_READY` set
 *    lists the exercise id. It is empty today, so treat clips as optional forever.
 *    The API also sends a `poster` still; the app ignores it and shows no frame
 *    behind the clip — see `ExerciseVideo`.
 */

/** Pillars that appear as plan tasks. Nutrition is never a task — it has its own section. */
export type PlanPillar = 'movement' | 'relaxation' | 'habit';

/** How often a task is meant to happen. Read together with `target`. */
export type PlanCadence = 'daily' | 'weekly' | 'per_day';

/** `past` and `current` carry tasks; `locked` never does. */
export type PlanWeekState = 'past' | 'current' | 'locked';

export type HabitKind = 'build' | 'resist';

/**
 * What an exercise's dose is measured in.
 *
 * **Every unit is time.** A set is a number of seconds and the session counts
 * them down; there are no repetitions to keep track of anywhere in the plan.
 * The unit only says what she is doing with those seconds.
 *
 * - `timed`    — sets of work for time, at her own tempo. Most of the catalog.
 * - `hold`     — an isometric. Same clock, one position.
 * - `carry`    — a loaded carry, honestly measured in time.
 * - `duration` — one continuous block: all cardio, plus the mobility flow.
 *
 * A unit this build does not know is treated as `timed` everywhere, so a server
 * that adds one never leaves a session unable to run.
 */
export type DoseUnit = 'timed' | 'hold' | 'carry' | 'duration';

/**
 * The runnable dose for one exercise, as the server resolves it.
 *
 * Two sources meet here. The catalog owns `unit`, `perSide` and `restSeconds` —
 * whether a wall sit is held still or worked through is a fact about the
 * exercise, the same for every woman and every week, and rest is
 * safety-adjacent. The generated plan owns the numbers: how many sets, how many
 * seconds, and how those grow from week 1 to week 8. The server clamps them into
 * a safe band before they ever reach us, so this can be rendered as given.
 *
 * Optional because the app may be running against an API that predates it —
 * always go through `resolveDose()` in planFormat rather than reading it raw.
 */
export type ExerciseDose = {
  unit: DoseUnit;
  /** True when the set runs twice, once per side — the seconds are per side. */
  perSide: boolean;
  /** Working sets. Always at least 1; `duration` is always exactly 1. */
  sets: number;
  /** Seconds per set, per side when `perSide`. `duration` — the whole block. */
  seconds?: number;
  /** Between sets. Zero for `duration`. A prescription, not a UI default. */
  restSeconds: number;
  /** Total including rest between sets — sum these for the session's length. */
  estimatedSeconds: number;
};

/** One exercise inside a movement task, joined against the catalog server-side. */
export type PlanExercise = {
  /**
   * Catalog id, e.g. "L01". The raw stored dose follows in one of two shapes:
   * `sets`+`seconds` for a set, `minutes` for one continuous block. Prefer
   * `dose` — these are the unresolved form. `reps` only ever arrives on a plan
   * stored before the dose became time, and the server converts it for us.
   */
  id: string;
  sets?: number;
  reps?: number;
  seconds?: number;
  minutes?: number;
  /** Joined from the catalog — e.g. "Box squat". Never stored on the plan itself. */
  name: string;
  /** Equipment, e.g. "Sturdy chair". */
  props: string;
  /** Absent on an API older than 2026-08-14. Read it via `resolveDose()`. */
  dose?: ExerciseDose;
  /** Only with `?media=1` and only for ids the server has clips for. */
  video?: string;
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
  /**
   * Which eight weeks are being written. Absent on an API older than
   * 2026-08-23; present from a server that knows about cycles.
   *
   * It rides along on `generating` for one reason: at a rollover this is the
   * only signal available *while she waits*, and the wait is exactly when the
   * recap of the eight weeks she just finished should be on screen.
   */
  cycle?: number;
};

export type PlanReady = {
  status: 'ready';
  /** The date the server resolved — echo of what we sent, unless it was rejected. */
  date: string;
  /**
   * Which eight weeks these are. 1 is the plan she bought; every 56 days the
   * server scores what she did, writes her the next one, and this goes up.
   *
   * Optional only because an older server does not send it — read it through
   * `planCycle()`, which treats a missing value as her first plan.
   */
  cycle?: number;
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

/** Days one cycle covers, and therefore how often she is written a new plan. */
export const PLAN_DAYS = PLAN_WEEKS * 7;

/** Her cycle number, defaulting to her first plan on a server that predates cycles. */
export function planCycle(plan: PlanResponse | null | undefined): number {
  return plan?.cycle ?? 1;
}

export function isPlanReady(plan: PlanResponse): plan is PlanReady {
  return plan.status === 'ready';
}

/** The log key for one of her own habits. */
export function habitTaskKey(habitId: string): string {
  return `habit_${habitId}`;
}
