/**
 * The ordering rules for a guided movement session, as pure functions.
 *
 * Kept clear of React and React Native so the sequence can be simulated end to
 * end without a renderer — see `scripts/verify-session.ts`. `useSessionPlayer`
 * adds the clock and the haptics on top; it owns no ordering of its own.
 *
 * The one rule everything follows from: **every step is on a clock, so the
 * session runs itself.** She is on the floor with a band in her hands; asking
 * her to reach for the phone to say "set done" is asking her to stop training.
 *
 * Every dose is time now, so the clock means one thing on every step: these are
 * the seconds, and the countdown is the instruction. She still owns the tempo
 * inside them — "Done" moves on early and "+ time" buys more when today is
 * slower — but nothing on the screen asks her to keep a count in her head.
 */

import type { ExerciseDose, PlanExercise } from './planTypes';

/** Between the two sides of a unilateral exercise. Just long enough to switch. */
export const SWITCH_SECONDS = 10;

/** The "next up" card between exercises: read the name, get into position. */
export const TRANSITION_SECONDS = 12;

/** Movement snacks run ~5 minutes total, so the card between exercises is a beat. */
export const SNACK_TRANSITION_SECONDS = 5;

/** Movement snacks run ~5 minutes total. A 90-second rest inside one is absurd. */
export const SNACK_MAX_REST_SECONDS = 20;

/** What "+ time" adds, to whatever is currently on the clock. */
export const REST_BUMP_SECONDS = 20;

export type SessionStep =
  /** Doing the thing. The dose's seconds are the clock, whatever the unit. */
  | { kind: 'work'; index: number; set: number; side: 0 | 1 }
  /** Between the two sides of a unilateral exercise. */
  | { kind: 'switch'; index: number; set: number }
  /** Between sets of the same exercise. */
  | { kind: 'rest'; index: number; set: number }
  /** Between exercises. */
  | { kind: 'transition'; index: number }
  | { kind: 'done' };

export type SessionExercise = {
  exercise: PlanExercise;
  dose: ExerciseDose;
};

/** Rest after a set, shortened for the snack cadence. */
export function restFor(dose: ExerciseDose, compact: boolean): number {
  return compact ? Math.min(dose.restSeconds, SNACK_MAX_REST_SECONDS) : dose.restSeconds;
}

/**
 * How long a step runs. Null only where there is nothing to run at all.
 *
 * Every real step returns a number, which is what makes the session hands-free:
 * work, rest and the card between exercises all hand over to the next step on
 * their own, and every tap on the screen is an override rather than a duty.
 */
export function stepSeconds(
  step: SessionStep,
  items: SessionExercise[],
  compact: boolean
): number | null {
  if (step.kind === 'done') return null;
  if (step.kind === 'transition') return compact ? SNACK_TRANSITION_SECONDS : TRANSITION_SECONDS;

  const dose = items[step.index]?.dose;
  if (!dose) return null;

  if (step.kind === 'switch') return SWITCH_SECONDS;
  if (step.kind === 'rest') return restFor(dose, compact);
  return dose.seconds ?? null;
}

/**
 * The step after this one.
 *
 * A pure function of the current step, so that a timer firing, a "skip" tap and
 * a "set done" tap all take the same path — there is no second copy of the
 * ordering anywhere to drift out of sync with this one.
 */
export function nextStep(step: SessionStep, items: SessionExercise[]): SessionStep {
  if (step.kind === 'done') return step;

  const afterExercise = (index: number): SessionStep =>
    index + 1 >= items.length ? { kind: 'done' } : { kind: 'transition', index: index + 1 };

  if (step.kind === 'transition') return { kind: 'work', index: step.index, set: 1, side: 0 };

  const dose = items[step.index]?.dose;
  if (!dose) return afterExercise(step.index);

  if (step.kind === 'switch') return { kind: 'work', index: step.index, set: step.set, side: 1 };
  if (step.kind === 'rest') return { kind: 'work', index: step.index, set: step.set + 1, side: 0 };

  // Work finished. A unilateral exercise owes us the other side first — its
  // seconds are per side, so the set is only half done.
  if (dose.perSide && step.side === 0) {
    return { kind: 'switch', index: step.index, set: step.set };
  }

  if (step.set >= dose.sets) return afterExercise(step.index);
  return { kind: 'rest', index: step.index, set: step.set };
}

/** The step reached by abandoning the current exercise entirely. */
export function skipToNextExercise(step: SessionStep, items: SessionExercise[]): SessionStep {
  if (step.kind === 'done') return step;
  return step.index + 1 >= items.length ? { kind: 'done' } : { kind: 'transition', index: step.index + 1 };
}

/**
 * How long one exercise takes, exactly as the player will run it.
 *
 * The dose carries the server's own `estimatedSeconds`, but it cannot know the
 * switch between sides or the shortened rest inside a snack — and the session is
 * on a clock end to end, so "about 20 min" has to be the clock's answer, not a
 * second opinion.
 */
export function exerciseSeconds(dose: ExerciseDose, compact = false): number {
  const work = dose.seconds ?? 0;
  // A unilateral exercise runs the work twice per set, with a switch between.
  const setSeconds = dose.perSide ? work * 2 + SWITCH_SECONDS : work;
  return dose.sets * setSeconds + Math.max(0, dose.sets - 1) * restFor(dose, compact);
}

/** Total sets the session asks for, across every exercise. */
export function totalSets(items: SessionExercise[]): number {
  return items.reduce((n, item) => n + item.dose.sets, 0);
}

/** Sets fully finished at this step, for the progress bar and the "log it?" prompt. */
export function completedSets(step: SessionStep, items: SessionExercise[]): number {
  if (step.kind === 'done') return totalSets(items);
  const before = items.slice(0, step.index).reduce((n, item) => n + item.dose.sets, 0);
  if (step.kind === 'transition') return before;
  // Rest belongs to the set she just finished, so it counts. A switch sits
  // *inside* a set with one side still to go, so it does not.
  return before + (step.kind === 'rest' ? step.set : step.set - 1);
}
