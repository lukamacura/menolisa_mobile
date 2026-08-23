/**
 * Display helpers for plan content. Every string here is derived from the API
 * response — none of them name an exercise, a nutrition row, or a protocol.
 */

import { daysBetween } from './planApi';
import { exerciseSeconds } from './sessionSteps';
import {
  PLAN_WEEKS,
  type ExerciseDose,
  type PlanExercise,
  type PlanReady,
  type PlanTask,
  type RelaxationDetail,
} from './planTypes';

/** Day of the plan, 1-based. Day 1 is `startedAt`. */
export function dayInPlan(plan: PlanReady): number {
  return daysBetween(plan.startedAt, plan.date) + 1;
}

/**
 * True once she is past day 56.
 *
 * The server clamps `currentWeek` to 8 forever, so the plan keeps rendering —
 * but week 8's counting window is `startedAt+49 … +55`, and today is outside
 * it. That makes `doneThisWeek` structurally 0 from day 57 on, for good. Any
 * weekly progress read has to fall back to the day once this is true, or she
 * gets a permanent "0 of 2 this week" that no amount of exercise will move.
 */
export function isPlanFinished(plan: PlanReady): boolean {
  return dayInPlan(plan) > PLAN_WEEKS * 7;
}

/** "2 min" / "15 min" / "1:36" for anything under two minutes with seconds that matter. */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds} sec`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (seconds === 0) return `${minutes} min`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * A live countdown face: "45", "1:30", "15:00".
 *
 * Bare seconds under a minute, unlike `formatDuration` — this goes inside a ring
 * where "45 sec" would run past the stroke, and a number counting down needs no
 * unit to be understood.
 */
export function formatClock(totalSeconds: number): string {
  if (totalSeconds < 60) return String(totalSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

/** How long a relaxation practice takes, whichever kind it is. */
export function relaxationLength(detail: RelaxationDetail): string {
  return detail.kind === 'breathing'
    ? formatDuration(detail.totalSeconds)
    : `${detail.minutes} min`;
}

/**
 * The dose on an exercise card: "3 × 40 sec" for a set, "15 min" for cardio.
 * Returns null when the catalog gave nothing, so the card can omit the chip.
 */
export function exerciseDose(exercise: PlanExercise): string | null {
  const dose = resolveDose(exercise);
  if (!dose) return null;
  if (dose.unit === 'duration') return formatDuration(dose.seconds ?? 0);

  const side = dose.perSide ? ' each side' : '';
  return `${dose.sets} × ${formatDuration(dose.seconds ?? 0)}${side}`;
}

// ─── Dose ───────────────────────────────────────────────────────────────────

/** Client-side stand-ins, used only when the API is older than the dose object. */
const FALLBACK_SETS = 3;
const FALLBACK_REST_SECONDS = 60;
/** Only for a stored plan old enough to carry reps. A controlled tempo, unhurried. */
const LEGACY_SECONDS_PER_REP = 3;

/**
 * The runnable dose for an exercise, whatever the API is old enough to send.
 *
 * `dose` is always the better answer: only the server knows a step-up is per
 * side, and only the server has clamped the numbers. The fallback below
 * reconstructs a timed set from the raw fields so a build shipped ahead of the
 * API still runs a session — it cannot recover `perSide`, and a plan stored
 * before the dose became time gives it reps, which become seconds here for the
 * same reason the server converts them.
 *
 * Returns null only when there is genuinely nothing to run.
 */
export function resolveDose(exercise: PlanExercise): ExerciseDose | null {
  if (exercise.dose) return exercise.dose;

  if (exercise.minutes) {
    const seconds = exercise.minutes * 60;
    return {
      unit: 'duration',
      perSide: false,
      sets: 1,
      seconds,
      restSeconds: 0,
      estimatedSeconds: seconds,
    };
  }

  const seconds = exercise.seconds ?? (exercise.reps ? exercise.reps * LEGACY_SECONDS_PER_REP : 0);
  if (!seconds) return null;

  const sets = exercise.sets ?? FALLBACK_SETS;
  return {
    unit: 'timed',
    perSide: false,
    sets,
    seconds,
    restSeconds: FALLBACK_REST_SECONDS,
    estimatedSeconds: sets * seconds + (sets - 1) * FALLBACK_REST_SECONDS,
  };
}

/** "40 sec each side" / "15 min" — what she does in ONE set. */
export function setInstruction(dose: ExerciseDose): string {
  if (dose.unit === 'duration') return formatDuration(dose.seconds ?? 0);
  return `${formatDuration(dose.seconds ?? 0)}${dose.perSide ? ' each side' : ''}`;
}

/**
 * Roughly how long the whole session runs, in seconds.
 *
 * Summed from the step durations the player actually uses, not from the dose's
 * `estimatedSeconds` — the guided session is on a clock from the first step to
 * the last, and the number on the card has to be that clock. Still shown as
 * "about 20 min": she can finish a set early, or take more time on it.
 */
export function sessionSeconds(exercises: PlanExercise[], compact = false): number {
  return exercises.reduce((total, exercise) => {
    const dose = resolveDose(exercise);
    return total + (dose ? exerciseSeconds(dose, compact) : 0);
  }, 0);
}

/** Every distinct piece of equipment the session needs, in the order met. */
export function sessionProps(exercises: PlanExercise[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const exercise of exercises) {
    for (const raw of exercise.props.split(',')) {
      const prop = raw.trim();
      // "None" is the catalog's way of saying bodyweight — not a thing to fetch.
      if (!prop || prop.toLowerCase() === 'none') continue;
      const key = prop.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(prop);
    }
  }
  return out;
}

/**
 * Whether a task counts across the plan week or across today.
 *
 * `finished` comes from `isPlanFinished()` — past day 56 the weekly window has
 * closed, so a weekly task has to be read as a daily one or it reads 0 forever.
 */
function countsByWeek(task: PlanTask, finished: boolean): boolean {
  return task.cadence === 'weekly' && !finished;
}

/** True once the task's period is fully done — the week for weekly, the day otherwise. */
export function isTaskComplete(task: PlanTask, finished = false): boolean {
  return countsByWeek(task, finished)
    ? task.doneThisWeek >= task.target
    : task.doneToday >= (finished && task.cadence === 'weekly' ? 1 : task.target);
}

/** Progress numerator/denominator for a task, in the timeframe its cadence implies. */
export function taskProgress(task: PlanTask, finished = false): { value: number; total: number } {
  if (countsByWeek(task, finished)) {
    return { value: task.doneThisWeek, total: task.target };
  }
  // A weekly task after day 56 becomes "did you do one today", since the week's
  // counting window has closed and can never fill again.
  const total = finished && task.cadence === 'weekly' ? 1 : task.target;
  return { value: task.doneToday, total };
}

/** "1 of 2 this week" / "Done today" / "Not yet today" — always naming the timeframe. */
export function taskProgressLabel(task: PlanTask, finished = false): string {
  if (countsByWeek(task, finished)) {
    return `${task.doneThisWeek} of ${task.target} this week`;
  }
  if (!finished && task.target > 1) {
    return `${task.doneToday} of ${task.target} today`;
  }
  return task.doneToday > 0 ? 'Done today' : 'Not yet today';
}

/**
 * How often the task asks to be done, in her words — "2 sessions a week",
 * "4 times a day", "Every day".
 *
 * Nutrition rows have carried this line since the beginning ("Every meal", "6 or
 * more") and it is the reason that screen reads as a list of instructions rather
 * than a list of counters. A movement task is the one place the number was only
 * ever implied — "1 of 2 this week" tells her where she is, not what she was
 * asked for, and on the first day of a week those are the same sentence with
 * very different meanings.
 */
export function taskCadenceHint(task: PlanTask): string | null {
  const movement = task.pillar === 'movement';
  const noun = movement ? 'session' : 'time';
  const period = task.cadence === 'weekly' ? 'week' : 'day';

  if (task.target > 1) return `${task.target} ${noun}s a ${period}`;
  // Phrased as a count rather than "Every day" so it survives being dropped into
  // a sentence — "your plan asks for one session a day" reads; "…for every day"
  // does not. A pillar with no session to count keeps the plain form.
  if (movement) return `One ${noun} a ${period}`;
  return period === 'week' ? 'Once a week' : 'Every day';
}

/**
 * What is still owed, in the timeframe the cadence implies — "1 more session
 * this week", "All done this week".
 *
 * Deliberately not a fraction. `taskProgressLabel` already carries the count;
 * this is the line that answers "am I finished?", which is the question she
 * actually opens the screen with.
 */
export function taskRemainingLabel(task: PlanTask, finished = false): string {
  const { value, total } = taskProgress(task, finished);
  const weekly = task.cadence === 'weekly' && !finished;
  const period = weekly ? 'this week' : 'today';
  const noun = task.pillar === 'movement' ? 'session' : 'time';

  if (value >= total) {
    return total > 1 ? `All ${total} done ${period}` : `Done ${period}`;
  }
  const left = total - value;
  return `${left} more ${left === 1 ? noun : `${noun}s`} ${period}`;
}
