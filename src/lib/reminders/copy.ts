/**
 * Every word a local reminder can say.
 *
 * The voice rules are the ones the server's alert catalog already follows
 * (`lib/alerts/catalog.ts` in the web app), and they are repeated here because
 * these two systems have to sound like one app on one lock screen:
 *
 * - Sentence case. No exclamation marks. No emoji.
 * - **Never imply she failed.** "Your movement is still open", never "You
 *   haven't done your movement". She is managing a body that changed under her
 *   without asking; a phone that scolds her about it gets turned off.
 * - Say the thing in the notification itself. A body ending in "tap to see"
 *   promises a destination and delivers a list.
 * - One line each — a push truncates around 100 characters on iOS.
 * - Numbers are credit, not a score. "You're at 3 of 6 glasses" names the three
 *   she has had. It must never read as a report card.
 */

import type { ReminderCopy } from './types';

/**
 * The morning nudge, on a day she has not touched yet.
 *
 * Word-for-word the server's old `dailyNudgeCopy`, kept identical on purpose:
 * she has been receiving this sentence since she subscribed, and moving where
 * it is generated is not a reason to change what it says.
 */
export function planCopy(firstName: string | null): ReminderCopy {
  return {
    title: "Today's plan is ready",
    body: firstName
      ? `${firstName}, your movement, nutrition and one calm moment are waiting.`
      : 'Your movement, nutrition and one calm moment are waiting.',
  };
}

/**
 * The mid-afternoon water check.
 *
 * One a day, never a drip. The water row asks for six glasses, and the naive
 * version of this feature is six notifications — which is the exact shape of
 * the thing this whole module exists to avoid. Afternoon because that is when
 * the morning's glass has worn off and there is still a whole evening to fix it
 * in; a reminder at nine at night is only a reproach.
 */
export function waterCopy(count: number, target: number): ReminderCopy {
  if (count <= 0) {
    return {
      title: `${target} glasses of water today`,
      body: 'Thirst gets quieter with age, so this is one to count rather than feel.',
    };
  }
  return {
    title: `You're at ${count} of ${target} glasses`,
    body: 'A glass now and the rest of the day is easy.',
  };
}

/**
 * The water check on a day we know nothing about yet.
 *
 * Days beyond today are scheduled before she has drunk anything, so the count
 * cannot be named — a body reading "you're at 0 of 6" written at 8am and
 * delivered at 3pm is simply wrong, and being wrong about her own numbers is
 * the fastest way to lose the right to speak at all. So this says the true
 * thing that needs no count, and the same-day pass replaces it with the
 * counted version the moment she opens the app.
 */
export function waterLookaheadCopy(target: number): ReminderCopy {
  return {
    title: `${target} glasses of water today`,
    body: 'Thirst gets quieter with age, so this is one to count rather than feel.',
  };
}

/**
 * The evening movement nudge.
 *
 * `remaining` is `taskRemainingLabel()` — "1 more session this week" — because
 * the honest answer to "should I bother tonight?" is how much is left, not how
 * much is done.
 */
export function movementCopy(title: string, remaining: string): ReminderCopy {
  return {
    title: 'Your movement is still open',
    body: `${title} — ${remaining.toLowerCase()}.`,
  };
}

/**
 * The movement nudge on a day we know nothing about yet.
 *
 * No `remaining`, for the same reason `waterLookaheadCopy` names no count: this
 * is written the day before, and she may well train tonight — at which point
 * "2 more sessions this week" is simply untrue by the time it arrives. The task
 * itself is the useful half of that sentence anyway.
 */
export function movementLookaheadCopy(title: string): ReminderCopy {
  return {
    title: 'Your movement is still open',
    body: `${title} is there whenever your window is.`,
  };
}

/**
 * A run of days about to break.
 *
 * Never sent below three days (`STREAK_WORTH_SAVING`): a two-day "streak" is
 * not something she would be sad to lose, and calling it one that early teaches
 * her the word means nothing.
 */
export function streakCopy(streak: number): ReminderCopy {
  return {
    title: `Your ${streak}-day streak is still going`,
    body: 'One tick before bed keeps it alive.',
  };
}

/** The evening before the plan rolls into a new week. Seven of these per cycle. */
export function weekStartCopy(week: number, weekTitle: string | null): ReminderCopy {
  return {
    title: `Week ${week} starts tomorrow`,
    body: weekTitle
      ? `${weekTitle}. Your plan updates in the morning.`
      : 'Your plan updates in the morning.',
  };
}
