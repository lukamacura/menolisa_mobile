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
 *    lists the exercise id, so it is optional forever — K01 Zone 2 cardio and
 *    K02 Sprint intervals are doses rather than movements and will never have a
 *    clip. The key is absent, not null or "", so `Boolean(exercise.video)` is
 *    the test; never build a URL from `id`. A row without one renders as name
 *    and props, with no player, poster, spinner or apology — see
 *    `ExerciseVideo`. The API also sends a `poster` still; the app ignores it
 *    and shows no frame behind the clip.
 * 4. A movement task's session is `warmup` + `exercises` + `power` +
 *    `cooldown`, and `exercises` stayed meaning the main work only — every read
 *    that asks "how much did she train" goes through it, so nothing may be
 *    folded in. All three of the others are optional, and `power` is further
 *    gated on `powerSessions`. Never read the four arrays yourself — build a
 *    session with `buildSessionItems()` and render a list with
 *    `sessionBlocks()`. A screen that wants the whole session adds them up.
 */

/** Pillars that appear as plan tasks. Nutrition is never a task — it has its own section. */
export type PlanPillar = 'movement' | 'relaxation' | 'habit';

/**
 * Which part of a movement session an exercise belongs to.
 *
 * A session runs `warmup` → `main` → `power` → `cooldown`, in that order,
 * always. The phase is not a label on the card — it changes how the session is
 * *run*: the prep phases take a short card between exercises and a capped rest,
 * and the runner's traffic light goes quiet in them (see `stageTone` in
 * MovementSessionScreen). Only `main` sets decide whether the session counts.
 */
export type SessionPhase = 'warmup' | 'main' | 'power' | 'cooldown';

/** Run order. Anything that walks a whole session must walk it in this order. */
export const SESSION_PHASES: readonly SessionPhase[] = ['warmup', 'main', 'power', 'cooldown'];

/** What each phase is called, everywhere she can read it. */
export const SESSION_PHASE_LABEL: Record<SessionPhase, string> = {
  warmup: 'Warm-up',
  main: 'Main work',
  power: 'Jumping',
  cooldown: 'Cool-down',
};

/**
 * True for the two phases that are real training, false for the two bookends.
 *
 * The line every phase-conditional behaviour in the session is actually drawn
 * on. A power set is hops off a step: it is worked, it earns its full
 * prescribed rest, it wants the twelve seconds of getting-into-position before
 * it, and the traffic light has to mean something while she is doing it. All of
 * that is true of the main work and none of it is true of a hip circle, so the
 * checks read `isWorkPhase(phase)` rather than `phase === 'main'`.
 *
 * The one thing it does **not** decide is whether the session counts. That
 * question is `'main'` and nothing else — see `totalSets(items, 'main')`.
 */
export function isWorkPhase(phase: SessionPhase): boolean {
  return phase === 'main' || phase === 'power';
}

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
  /**
   * One or two plain sentences on why this movement is on the list — e.g.
   * "Stairs are one leg at a time, so train them one leg at a time."
   *
   * Catalog copy: the same for everyone, fixed, and reworded server-side
   * whenever the wording is improved. **Never cache or hardcode it**, and never
   * confuse it with `PlanTask.why`, which is written per plan and says why
   * *this week's session* is what it is. Both are shown; neither substitutes
   * for the other.
   *
   * Optional in exactly the way `video` is: some rows have none and some never
   * will. Absent means draw nothing — no placeholder, no empty paragraph.
   */
  why?: string;
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
  /**
   * Movement tasks only — the working part of the session.
   *
   * Deliberately still called `exercises`, and deliberately still *only* the
   * main work. Everything in this app that asks "how much did she train" reads
   * this field, and folding a warm-up into it would silently change the answer
   * in every one of those places with nothing failing to compile.
   */
  exercises?: PlanExercise[];
  /**
   * Movement tasks only — what she does before and after the work.
   *
   * Both are optional and both may be absent forever: a server that has not
   * been taught to write them, a snack cadence too short to warrant one, or a
   * cardio session that is its own warm-up. Never render an empty section, and
   * never let the session refuse to run without them — go through
   * `buildSessionItems()` in planFormat, which handles all three cases.
   *
   * They are ordinary `PlanExercise`s with ordinary doses, so the runner needs
   * no second code path: a warm-up move is one set of `duration` seconds with
   * no rest, and the player already knows how to run that.
   */
  warmup?: PlanExercise[];
  cooldown?: PlanExercise[];
  /**
   * Movement tasks only — bone loading, run after the work and before the
   * cool-down. Hops, drops and marching landings.
   *
   * Ordinary `PlanExercise`es like the rest, so this needs no second card and
   * no second player. It is real work, though, not a bookend: full rest, full
   * transitions, and the runner's traffic light stays on through it.
   *
   * Absent on purpose and often — movement snacks (their loading is mixed into
   * `exercises`), cardio-only sessions, and every plan generated before
   * 2026-08-29. Unlike the bookends there is **no generic default** to fall
   * back on: a hip circle is safe for everyone and a plyometric is not, and
   * which ones she may be given depends on her fitness level and on whether she
   * reported joint pain. Absent means draw nothing.
   */
  power?: PlanExercise[];
  /**
   * How many of this week's `target` sessions carry the power block.
   *
   * The task holds *one* session she repeats `target` times, so the plan cannot
   * say "plyo on Tuesday and Friday" — it says "on 2 of your 3" and the app
   * picks which. `powerThisSession()` in planFormat is that decision, and it is
   * the only place allowed to make it.
   *
   * Missing beside a present `power` means every session.
   */
  powerSessions?: number;
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

/**
 * The guided meditation, offered beside whatever relaxation the plan asked for.
 *
 * It is not a task and not part of any week — it rides on the plan response, so
 * it is available on every plan the moment the server ships it rather than only
 * on plans written afterwards. Doing it completes the relaxation task she
 * already has; the plan cannot tell which route she took, and does not need to.
 *
 * Absent when the app did not ask for media, and absent from any server that
 * predates it. Both mean the same thing to the screen: no choice is offered and
 * the plan's own practice stands alone.
 */
export type PlanMeditation = {
  /** Stable id. Nothing is keyed off it yet — logging goes against the task. */
  id: string;
  /** "Guided meditation". Shown on the choice control and above the player. */
  title: string;
  /** One line on when to reach for it, same job as `RelaxationDetail.use`. */
  use: string;
  /**
   * The catalog's stated runtime, in seconds.
   *
   * What the choice control prints while she is deciding whether she has time —
   * it is known before a byte has been fetched. The player prefers the real
   * duration off the file once it loads, and only falls back to this.
   */
  seconds: number;
  /**
   * The full URL, built server-side. **Never construct one from `id`** — the
   * app must not know the bucket, the filename or its spelling, exactly as with
   * `PlanExercise.video`.
   */
  audio: string;
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
  /**
   * The alternative to whatever relaxation this week asked for. Only with
   * `?media=1`, and absent on a server older than 2026-08-29 — read it as
   * "offer no choice", never as an error.
   */
  meditation?: PlanMeditation;
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

/**
 * Whether *this* session carries the power block.
 *
 * The plan holds one session she repeats `target` times a week, so it cannot
 * name the days the bone loading happens on — it says "on 2 of your 3" and
 * leaves the choice here. The rule is the first `powerSessions` sessions of the
 * week: with `target: 3` and `powerSessions: 2` her first two run
 * warm-up → work → power → cool-down and her third drops the power block.
 * Beginners have `target: 2` and `powerSessions: 2`, so every session carries it.
 *
 * Driven off `doneThisWeek` and nothing else — no new state, no new marker, and
 * the same week boundary every other weekly count in the app already uses. Two
 * consequences of that, both deliberate:
 *
 * - Past day 56 `doneThisWeek` is structurally 0 forever (see `isPlanFinished`
 *   in planFormat), so a finished plan shows the block every session. That is
 *   the documented safe side to fall on: more impact than prescribed is fine,
 *   none at all is the plan losing its point.
 * - A missing `powerSessions` beside a present `power` means every session, and
 *   a `power` that is absent or empty means nothing to draw — never a default
 *   block invented here, because which plyometrics are safe for her depends on
 *   her fitness level and her joints, and neither is knowable from the task.
 *
 * Lives here rather than in planFormat so `scripts/verify-session.ts` can reach
 * it: that file imports React Native transitively, and this rule is exactly the
 * kind of quiet off-by-one the verifier exists to catch.
 */
export function powerThisSession(task: PlanTask): boolean {
  if (!task.power?.length) return false;
  if (task.powerSessions === undefined) return true;
  return task.doneThisWeek < task.powerSessions;
}

/** The log key for one of her own habits. */
export function habitTaskKey(habitId: string): string {
  return `habit_${habitId}`;
}
