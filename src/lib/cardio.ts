/**
 * The aerobic pillar: what a cardio task is, and how to say what it asks for.
 *
 * Every week of every plan now carries one or two movement tasks that are not
 * workouts — a walk, a bike ride, a row. They arrive on the same `movement`
 * pillar as the strength session, with the same `cadence`, `target` and
 * `doneThisWeek`, and they are counted, ringed and scored exactly like it (see
 * §20 of `docs/mobile-app-changes.md` in the web app). What differs is only how
 * one is *run*: one exercise, one continuous countdown, no sets, no rest, no
 * warm-up, no cool-down, no power block, and no clip — ever.
 *
 * ─── Never match on the log key ─────────────────────────────────────────────
 * The keys are `w3_cardio` and `w3_intervals` today and `w3_movement` for the
 * strength session, which was `w3_movement0` until 2026-08-29 and may change
 * again. Logs are keyed by whatever the plan row says, so a key this app
 * recognised would be a key this app could get wrong. The **exercise id** is
 * the contract instead — `lib/plan/catalog.ts` calls it that in as many words —
 * and every cardio row is in the `K` family.
 *
 * Kept clear of React and React Native so `scripts/verify-session.ts` can reach
 * it.
 */

import type { PlanExercise, PlanTask } from './planTypes';

/** Zone 2 — minutes at a pace where she could talk but not sing, on anything. */
export const ZONE2_ID = 'K01';
/** The one hard day: a fixed protocol, and the only one in the catalog. */
export const INTERVALS_ID = 'K02';

/** The catalog family every cardio row belongs to. Matches `isCardioId()` server-side. */
const CARDIO_PREFIX = 'K';

/** A dose rather than a movement — nothing to demonstrate, so never a clip. */
export function isCardioExercise(exercise: PlanExercise): boolean {
  return exercise.id.startsWith(CARDIO_PREFIX);
}

/**
 * The single exercise a cardio task holds, or null for anything else.
 *
 * Deliberately one function rather than a predicate plus a lookup: every caller
 * that wants to know "is this cardio" also wants the exercise, and the two
 * questions drifting apart is how a screen ends up rendering a cardio layout
 * around a strength session's first squat.
 *
 * Strict about the shape it accepts. A task is cardio only when the movement
 * pillar's whole session is one `K` row with nothing bracketing it — the same
 * test the server applies before it decides a task wants no bookends. A future
 * task that mixed a walk into a workout would fall through to the ordinary
 * session runner, which is the safe way round.
 */
export function cardioExercise(task: PlanTask | null | undefined): PlanExercise | null {
  if (!task || task.pillar !== 'movement') return null;
  if (task.exercises?.length !== 1) return null;
  if (task.warmup?.length || task.cooldown?.length || task.power?.length) return null;
  const exercise = task.exercises[0];
  return isCardioExercise(exercise) ? exercise : null;
}

/** True when the task is a walk or a bike ride rather than a workout. */
export function isCardioTask(task: PlanTask | null | undefined): boolean {
  return cardioExercise(task) !== null;
}

/** One line of a protocol: what she is doing, and for how long. */
export type CardioStep = {
  /** The effort, in a word or two — "Easy", "3 rounds". */
  label: string;
  /** How long, and at what. */
  detail: string;
};

/**
 * The shape of the interval session, written out.
 *
 * `K02` is a **fixed** protocol — 5-10 minutes easy, three rounds of 30 seconds
 * hard against 2 minutes easy, 5 minutes easy — and the API sends it as a
 * nineteen-minute duration and nothing else. A single countdown with no
 * structure printed beside it is a nineteen-minute walk, which is the one thing
 * this task is not; so the structure is written here until the plan carries it.
 *
 * Two guards on that, because copy that duplicates a server's decision is copy
 * that can quietly start lying:
 *
 * - It is keyed off the catalog **id**, not off the task's key or title, so a
 *   row that is not this protocol can never pick it up.
 * - It names no total. The minutes come from the dose, and the dose is the
 *   server's; if the protocol ever grows a fourth round the clock will say so
 *   even before this text does.
 *
 * Returns null for Zone 2, which has no structure to explain — the props line
 * ("Any activity — walk, bike, swim, row, elliptical") already says everything
 * there is to say about it.
 */
export function cardioProtocol(exercise: PlanExercise): CardioStep[] | null {
  if (exercise.id !== INTERVALS_ID) return null;
  return [
    { label: 'Warm up', detail: '5-10 min easy, at a pace you could talk at' },
    { label: '3 rounds', detail: '30 sec hard, then 2 min easy' },
    { label: 'Cool down', detail: '5 min easy' },
  ];
}
