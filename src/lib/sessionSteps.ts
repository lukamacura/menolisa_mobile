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
 * inside them — "skip set" moves on early and "+ time" buys more when today is
 * slower — but nothing on the screen asks her to keep a count in her head.
 */

import { isWorkPhase, type ExerciseDose, type PlanExercise, type SessionPhase } from './planTypes';

/** Between the two sides of a unilateral exercise. Just long enough to switch. */
export const SWITCH_SECONDS = 10;

/** The "next up" card between exercises: read the name, get into position. */
export const TRANSITION_SECONDS = 12;

/** Movement snacks run ~5 minutes total, so the card between exercises is a beat. */
export const SNACK_TRANSITION_SECONDS = 5;

/** Movement snacks run ~5 minutes total. A 90-second rest inside one is absurd. */
export const SNACK_MAX_REST_SECONDS = 20;

/**
 * The card between two warm-up moves, or two cool-down moves.
 *
 * Shorter than the one before a working set, because it is doing less. Before a
 * heavy set the card is where she loads the bar and gets set; before a hip
 * circle it only has to name the move. Twelve seconds of standing still between
 * every move is how a four-minute warm-up becomes a seven-minute one.
 */
export const PREP_TRANSITION_SECONDS = 6;

/**
 * Rest ceiling inside a warm-up or cool-down.
 *
 * The server should be sending zero here — a warm-up you rest in is not warming
 * anything — but rest is prescribed per exercise in the catalog, and the same
 * mobility flow may be reused as a main-work block where its rest is real. This
 * is the same defence `SNACK_MAX_REST_SECONDS` is: the phase, not the catalog
 * row, decides what a rest is worth.
 */
export const PREP_MAX_REST_SECONDS = 15;

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

/**
 * One runnable exercise, with everything the ordering needs to place it.
 *
 * `phase` rides on the item rather than on the step for one reason: the step
 * machine below does not branch on it at all. A warm-up move is an exercise
 * with a dose, so `nextStep` walks warm-up, work and cool-down with the single
 * sequence it has always had — the phase only changes how long the pauses
 * around it are, and what colour and words the screen wears while it runs.
 */
export type SessionExercise = {
  exercise: PlanExercise;
  dose: ExerciseDose;
  phase: SessionPhase;
};

/**
 * Rest after a set, capped by the cadence and by the phase it sits in.
 *
 * The cap is a bookend rule, not an everything-but-`main` rule. Power sets are
 * hops and landings, and the rest between them is the whole point of the dose —
 * plyometrics done tired stop being plyometrics and start being a fall risk. So
 * the power block keeps every second the catalog prescribed.
 */
export function restFor(item: SessionExercise, compact: boolean): number {
  const rest = item.dose.restSeconds;
  if (compact) return Math.min(rest, SNACK_MAX_REST_SECONDS);
  if (!isWorkPhase(item.phase)) return Math.min(rest, PREP_MAX_REST_SECONDS);
  return rest;
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

  const item = items[step.index];
  if (!item) return null;

  if (step.kind === 'transition') {
    if (compact) return SNACK_TRANSITION_SECONDS;
    // The full card before a working set, the short one before a bookend move.
    // A power exercise gets the full card: she has to fetch a step or clear a
    // patch of floor before she can hop onto anything.
    return isWorkPhase(item.phase) ? TRANSITION_SECONDS : PREP_TRANSITION_SECONDS;
  }
  if (step.kind === 'switch') return SWITCH_SECONDS;
  if (step.kind === 'rest') return restFor(item, compact);
  return item.dose.seconds ?? null;
}

/**
 * The step after this one.
 *
 * A pure function of the current step, so that a timer firing and a "skip set"
 * tap take the same path — there is no second copy of the ordering anywhere to
 * drift out of sync with this one. It is the only way through a session: there
 * is no jump that abandons an exercise whole.
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

/**
 * How long one exercise takes, exactly as the player will run it.
 *
 * The dose carries the server's own `estimatedSeconds`, but it cannot know the
 * switch between sides or the shortened rest inside a snack — and the session is
 * on a clock end to end, so "about 20 min" has to be the clock's answer, not a
 * second opinion.
 */
export function exerciseSeconds(item: SessionExercise, compact = false): number {
  const { dose } = item;
  const work = dose.seconds ?? 0;
  // A unilateral exercise runs the work twice per set, with a switch between.
  const setSeconds = dose.perSide ? work * 2 + SWITCH_SECONDS : work;
  return dose.sets * setSeconds + Math.max(0, dose.sets - 1) * restFor(item, compact);
}

/** Whether an item counts toward a phase-filtered tally. No filter counts everything. */
function counts(item: SessionExercise | undefined, only?: SessionPhase): boolean {
  return Boolean(item) && (!only || item!.phase === only);
}

/**
 * Total sets the session asks for.
 *
 * `only` narrows it to one phase. The progress bar wants every set, warm-up
 * included — she is watching it cross the whole session. The "have you done
 * enough for this to count" question wants `'main'` and nothing else: a warm-up
 * and a stretch is not a training session, however many bars it filled.
 */
export function totalSets(items: SessionExercise[], only?: SessionPhase): number {
  return items.reduce((n, item) => n + (counts(item, only) ? item.dose.sets : 0), 0);
}

/** Sets fully finished at this step, for the progress bar and the "log it?" prompt. */
export function completedSets(
  step: SessionStep,
  items: SessionExercise[],
  only?: SessionPhase
): number {
  if (step.kind === 'done') return totalSets(items, only);
  const before = items
    .slice(0, step.index)
    .reduce((n, item) => n + (counts(item, only) ? item.dose.sets : 0), 0);
  // Standing in a phase the caller is not counting: everything before it is
  // either all of that phase or none of it, and `before` already has it.
  if (!counts(items[step.index], only)) return before;
  if (step.kind === 'transition') return before;
  // Rest belongs to the set she just finished, so it counts. A switch sits
  // *inside* a set with one side still to go, so it does not.
  return before + (step.kind === 'rest' ? step.set : step.set - 1);
}
