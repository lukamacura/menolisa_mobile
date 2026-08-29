/**
 * The reminders MenoLisa raises from the device itself.
 *
 * These are local `expo-notifications`, not push. Three reasons, and all three
 * are things a server cron cannot do:
 *
 * 1. **Her clock.** The alert crons fire at one UTC wall time for everybody
 *    (`vercel.json`), which is 04:00 for a woman on the US east coast. "Time to
 *    hydrate" at four in the morning is an uninstall. A local trigger runs on
 *    the device's own timezone for free, and follows her when she travels.
 * 2. **Instant suppression.** A reminder must disappear the moment she ticks
 *    the box, not at the next cron pass. Ticking is a local event, so cancelling
 *    is a local call.
 * 3. **No round trip.** Nothing to schedule, nothing to deliver, nothing to fail.
 *
 * Money alerts stay on the server — a declined card is not something the phone
 * can know, and it has to arrive whether or not the app is ever opened. See
 * `lib/alerts/catalog.ts` in the web app for those.
 */

import type { TrainingWindow } from '../accountStatus';

export type { TrainingWindow };

/** Every reminder this app can raise locally. */
export type ReminderId = 'plan' | 'water' | 'movement' | 'streak' | 'week_start';

/** One reminder's finished words. Written in `copy.ts`, never assembled elsewhere. */
export type ReminderCopy = { title: string; body: string };

/** A local wall-clock time. Interpreted against the device's own timezone. */
export type HourMinute = { hour: number; minute: number };

/**
 * What she has chosen. Persisted on the device only — there is no server-side
 * consumer, because there is no server-side sender.
 */
export type ReminderPrefs = {
  /** The master switch for everything in this file. */
  enabled: boolean;
  /** When the day's opening nudge lands. */
  morning: HourMinute;
  /** When the day's closing nudge lands. */
  evening: HourMinute;
  /**
   * When the movement reminder lands, or `null` to follow her quiz answer.
   *
   * Null is the meaningful default, not an unset field: `q_training_time` in the
   * web funnel already asked her when she has time to exercise, and asking again
   * in Settings on day one would be asking a woman to repeat herself. It becomes
   * a time here only if she moves it, and from then on her choice wins — she is
   * editing the reminder in front of her, not revising a quiz answer.
   */
  movement: HourMinute | null;
};

/** One reminder, resolved down to the words and the minute it fires. */
export type Reminder = {
  id: ReminderId;
  /** Lower wins when two reminders are too close together to both be sent. */
  rank: number;
  time: HourMinute;
  copy: ReminderCopy;
  /**
   * Deep-link payload, read by the tap handler in `AppNavigator`. Deliberately
   * the same `{ screen }` shape the server's pushes carry, so one router
   * handles both.
   */
  data: Record<string, string>;
};

/**
 * Everything the selector needs to know about today, derived from
 * `PlanContext` and `RewardsContext` by `useDailyReminders`.
 *
 * Kept as a plain value rather than the contexts themselves so the decision of
 * *what to send* is a pure function that can be reasoned about — and changed —
 * without touching notification plumbing.
 */
export type DayState = {
  /** True once anything at all is logged today. The single most important input. */
  activeToday: boolean;
  /** Her first name, or null. Never write a sentence that breaks without it. */
  firstName: string | null;
  /**
   * The part of the day she said she trains in, from the quiz. Null when she was
   * never asked — every account created before `q_training_time` existed.
   */
  trainingWindow: TrainingWindow | null;
  /**
   * The week's first unfinished movement task, if any is still open.
   *
   * The *week's*, not today's: this stays set on a day she has already trained,
   * because movement is counted across the week and tomorrow's blind reminder
   * needs to know the session is still owed. `trainedToday` is what suppresses
   * it for today.
   */
  movement: { taskKey: string; title: string; remaining: string } | null;
  /** True once any movement task has been logged today. Suppresses today's nudge. */
  trainedToday: boolean;
  /** Where her water count stands, when the plan carries a water row. */
  water: { count: number; target: number } | null;
  /** Consecutive active days ending yesterday. Only meaningful when not active today. */
  streak: number;
  /** The plan week that begins tomorrow, on the one evening a week that is true. */
  weekStartingTomorrow: { number: number; title: string | null } | null;
};
