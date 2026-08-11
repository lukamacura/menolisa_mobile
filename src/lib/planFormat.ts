/**
 * Display helpers for plan content. Every string here is derived from the API
 * response — none of them name an exercise, a nutrition row, or a protocol.
 */

import { daysBetween } from './planApi';
import { PLAN_WEEKS, type PlanExercise, type PlanReady, type PlanTask, type RelaxationDetail } from './planTypes';

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

/** How long a relaxation practice takes, whichever kind it is. */
export function relaxationLength(detail: RelaxationDetail): string {
  return detail.kind === 'breathing'
    ? formatDuration(detail.totalSeconds)
    : `${detail.minutes} min`;
}

/**
 * The dose on an exercise card: "3 × 10" for strength, "15 min" for cardio.
 * Returns null when the catalog gave neither, so the card can omit the chip.
 */
export function exerciseDose(exercise: PlanExercise): string | null {
  if (exercise.minutes) return `${exercise.minutes} min`;
  if (exercise.sets && exercise.reps) return `${exercise.sets} × ${exercise.reps}`;
  if (exercise.reps) return `${exercise.reps} reps`;
  return null;
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
