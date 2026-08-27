/**
 * Which reminders today actually earns — the entire volume policy, as one pure
 * function.
 *
 * Deliberately separate from both the copy and the scheduling. What a woman is
 * interrupted for is a product decision that will be argued about and changed;
 * it should be readable, testable and changeable without anyone having to
 * understand `expo-notifications`.
 *
 * The rule, in full:
 *
 *   **At most one reminder in the morning half of the day, and at most one in
 *   the evening half.** Two a day, ever. Zero on a day she has finished.
 *
 * That is what makes the difference between an app that helps and an app that
 * nags, and it is enforced structurally rather than by everyone remembering to
 * be restrained. Adding a sixth reminder to this file cannot raise the ceiling.
 */

import {
  movementCopy,
  planCopy,
  streakCopy,
  waterCopy,
  weekStartCopy,
} from './copy';
import type {
  DayState,
  HourMinute,
  Reminder,
  ReminderHalf,
  ReminderId,
  ReminderPrefs,
  TrainingWindow,
} from './types';

/**
 * What each answer to "when is the best time for you to exercise?" means on a
 * clock.
 *
 * Stored as a window rather than a time on purpose (see the quiz step's comment
 * in the web app): she is describing the shape of her day, not booking an
 * appointment, and the hour can be retuned here without a migration or a second
 * question. She can move it exactly in Settings if these are wrong for her.
 *
 * Each sits a little *before* the window it names, because a reminder to train
 * is only useful while the window is still open.
 */
export const TRAINING_TIMES: Record<TrainingWindow, HourMinute> = {
  morning: { hour: 8, minute: 0 },
  midday: { hour: 12, minute: 30 },
  evening: { hour: 18, minute: 0 },
};

/** Everybody trained in the evening before the quiz asked. Nothing changes for them. */
const DEFAULT_TRAINING_WINDOW: TrainingWindow = 'evening';

/**
 * Where the day splits in two.
 *
 * Every reminder's half is derived from its time and nothing else, so the cap
 * cannot be dodged by mislabelling one. The movement reminder is why the
 * boundary has to exist at all: a woman who trains before work and one who
 * trains after it are asking for opposite things from the same feature, and
 * hers moves across this line.
 *
 * 16:00 rather than noon because the afternoon belongs with the morning here —
 * the water check at 15:00 is the *late* option of the first half, not the
 * opening of the second.
 */
const EVENING_FROM_HOUR = 16;

/**
 * When the water check lands. Not configurable, unlike her other times.
 *
 * Anywhere earlier and there is nothing to report yet; anywhere later and there
 * is no day left to act on it.
 */
export const WATER_HOUR: HourMinute = { hour: 15, minute: 0 };

/** A shorter run than this is not yet worth naming, so it is never at risk. */
export const STREAK_WORTH_SAVING = 3;

/** Below this share of the day's target, the afternoon check is worth making. */
const WATER_BEHIND_RATIO = 0.5;

/**
 * Who wins when two reminders land in the same half of the day. Lower wins.
 *
 * One global order rather than a per-half one, so the whole policy is five lines
 * you can read at once. It runs rarest-and-most-specific first: `week_start`
 * comes round seven times in eight weeks, `streak` only when there is something
 * real to lose, and `water` last because it is the assist, not the ask.
 *
 * `plan` outranks `movement` on purpose. It is only ever a candidate on a day
 * she has not touched at all, and on such a day her whole plan is a better thing
 * to say than one pillar of it — the movement nudge comes into its own the
 * moment she has started and still has a session open.
 */
const RANK: Record<ReminderId, number> = {
  week_start: 1,
  streak: 2,
  plan: 3,
  movement: 4,
  water: 5,
};

/**
 * Every reminder today is eligible for, before the one-per-half cut.
 *
 * Each `if` is one product rule and reads as one. Note that `plan` and `water`
 * are mutually exclusive by construction — one asks whether she has started, the
 * other assumes she has — so the earlier half rarely has to choose at all.
 */
function candidates(state: DayState, prefs: ReminderPrefs): Reminder[] {
  const list: Reminder[] = [];

  /** Half and rank are never chosen by hand — the time and the id decide them. */
  const at = (
    id: ReminderId,
    time: HourMinute,
    copy: Reminder['copy'],
    data: Record<string, string>
  ): Reminder => ({ id, half: halfOf(time), rank: RANK[id], time, copy, data });

  // She has not touched today yet. The one reminder that opens the day.
  if (!state.activeToday) {
    list.push(
      at('plan', prefs.morning, planCopy(state.firstName), { screen: 'DailyLoop' })
    );
  }

  // She is already going, and the water row is the one thing a nudge genuinely
  // helps with — it is counted rather than felt, so it is the one she forgets.
  // Withheld on a day she has not started: stacking a water ping on top of the
  // morning nudge is two interruptions to say "you have not begun".
  if (
    state.activeToday &&
    state.water &&
    state.water.count < state.water.target * WATER_BEHIND_RATIO
  ) {
    list.push(
      at('water', WATER_HOUR, waterCopy(state.water.count, state.water.target), {
        screen: 'Nutrition',
      })
    );
  }

  // A new plan week tomorrow. The most useful thing we can say all week, and it
  // comes round only seven times in the whole eight, so it outranks everything.
  if (state.weekStartingTomorrow) {
    list.push(
      at(
        'week_start',
        prefs.evening,
        weekStartCopy(
          state.weekStartingTomorrow.number,
          state.weekStartingTomorrow.title
        ),
        { screen: 'DailyLoop' }
      )
    );
  }

  // A run of days she is hours from losing.
  if (!state.activeToday && state.streak >= STREAK_WORTH_SAVING) {
    list.push(
      at('streak', prefs.evening, streakCopy(state.streak), { screen: 'DailyLoop' })
    );
  }

  // The week's movement, still owed.
  //
  // The only reminder that can land in either half, and the reason the boundary
  // exists. It goes in the part of the day she named in the quiz, because a
  // nudge to train that arrives four hours after her one window is worse than no
  // nudge at all — it is a reminder she can only fail.
  if (state.movement) {
    list.push(
      at(
        'movement',
        movementTime(state, prefs),
        movementCopy(state.movement.title, state.movement.remaining),
        { screen: 'Movement', taskKey: state.movement.taskKey }
      )
    );
  }

  return list;
}

/**
 * When her movement reminder lands: her own choice, else her quiz answer, else
 * the evening.
 *
 * The order matters and only reads one way — Settings is where she edits *this
 * reminder*, so a time set there is a later and more specific statement than a
 * window she picked before she had ever seen her plan.
 */
export function movementTime(state: DayState, prefs: ReminderPrefs): HourMinute {
  if (prefs.movement) return prefs.movement;
  return TRAINING_TIMES[state.trainingWindow ?? DEFAULT_TRAINING_WINDOW];
}

function halfOf(time: HourMinute): ReminderHalf {
  return time.hour < EVENING_FROM_HOUR ? 'morning' : 'evening';
}

/**
 * The reminders for one day: the best candidate from each half, and nothing else.
 *
 * Returned in the order they will fire, which is also the order they read in.
 */
export function remindersForDay(
  state: DayState,
  prefs: ReminderPrefs
): Reminder[] {
  if (!prefs.enabled) return [];

  const best = new Map<Reminder['half'], Reminder>();
  for (const reminder of candidates(state, prefs)) {
    const held = best.get(reminder.half);
    if (!held || reminder.rank < held.rank) best.set(reminder.half, reminder);
  }

  return [...best.values()].sort(
    (a, b) => minutesOfDay(a.time) - minutesOfDay(b.time)
  );
}

/**
 * The gentle re-engagement reminder for a day we know nothing about.
 *
 * Days beyond today are scheduled blind — she may well do her whole plan
 * tomorrow morning and never see it, and if she does, the next scheduling pass
 * cancels it before it fires. So only the one reminder that is *always* true
 * goes out on those days: her plan is, in fact, ready.
 *
 * This is the only channel left for a woman who has stopped opening the app, and
 * it decays on its own — see `LOOKAHEAD_DAYS`.
 */
export function lookaheadReminder(
  firstName: string | null,
  prefs: ReminderPrefs
): Reminder | null {
  if (!prefs.enabled) return null;
  return {
    id: 'plan',
    half: halfOf(prefs.morning),
    rank: RANK.plan,
    time: prefs.morning,
    copy: planCopy(firstName),
    data: { screen: 'DailyLoop' },
  };
}

function minutesOfDay(time: HourMinute): number {
  return time.hour * 60 + time.minute;
}
