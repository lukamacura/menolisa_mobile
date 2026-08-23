/**
 * Turning history numbers into her words.
 *
 * Every sentence in the progress screen goes through here, so that the one
 * rule the grid depends on is stated once: **an absent pillar reads as a rest,
 * never as a zero.** Movement is two sessions somewhere in a week, so five days
 * out of seven have no movement to report — "Rest day" is the truth there and
 * "0 of 2" is not.
 */

import type { HistoryPillar, PillarProgress } from './planHistoryTypes';

export const PILLAR_LABELS: Record<HistoryPillar, string> = {
  movement: 'Movement',
  nutrition: 'Nutrition',
  relaxation: 'Relaxation',
};

export const PILLAR_ICONS: Record<HistoryPillar, 'barbell' | 'nutrition' | 'leaf'> = {
  movement: 'barbell',
  nutrition: 'nutrition',
  relaxation: 'leaf',
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** One pillar's line inside a single day. */
export function dayPillarSummary(
  pillar: HistoryPillar,
  progress: PillarProgress | null
): string {
  if (!progress) return pillar === 'movement' ? 'Rest day' : 'Nothing scheduled';

  switch (pillar) {
    case 'movement':
      return `${progress.done} ${plural(progress.done, 'session', 'sessions')}`;
    case 'nutrition':
      return `${progress.done} of ${progress.target} ${plural(progress.target, 'task', 'tasks')}`;
    case 'relaxation':
      return progress.done >= progress.target
        ? 'Done'
        : `${progress.done} of ${progress.target}`;
  }
}

/** One pillar's line across a week or the whole plan so far. */
export function spanPillarSummary(
  pillar: HistoryPillar,
  progress: PillarProgress | null
): string {
  if (!progress) return 'Nothing scheduled';

  switch (pillar) {
    case 'movement':
      return `${progress.done} of ${progress.target} ${plural(progress.target, 'session', 'sessions')}`;
    case 'nutrition':
      return `${progress.done} of ${progress.target} ${plural(progress.target, 'task', 'tasks')}`;
    case 'relaxation':
      return `${progress.done} of ${progress.target} ${plural(progress.target, 'practice', 'practices')}`;
  }
}

/**
 * The one line under the hero ring.
 *
 * Never a target and never a shortfall. She is looking at eight weeks of her
 * own life; the sentence names where she is, and the number above it already
 * says how much.
 */
export function overallHeadline(score: number, daysElapsed: number): string {
  if (daysElapsed <= 1) return 'Day one. This fills in as you go.';
  if (score >= 0.85) return `${daysElapsed} days in, and it shows.`;
  if (score >= 0.6) return `${daysElapsed} days in. You are keeping this up.`;
  if (score >= 0.3) return `${daysElapsed} days in. Every filled arc counted.`;
  return `${daysElapsed} days in. Anything you do from here adds to this.`;
}

/** "Tuesday, 11 August" in the device's locale, from a YYYY-MM-DD string. */
export function formatLongDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Single-letter weekday for a grid column header, e.g. "M". */
export function weekdayInitial(date: string): string {
  return new Date(`${date}T00:00:00`)
    .toLocaleDateString(undefined, { weekday: 'narrow' })
    .charAt(0);
}
