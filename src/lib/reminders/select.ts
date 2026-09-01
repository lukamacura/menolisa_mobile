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
 *   **At most two reminders a day, and never two within two hours of each
 *   other.** Zero on a day she has finished.
 *
 * That is what makes the difference between an app that helps and an app that
 * nags, and it is enforced structurally rather than by everyone remembering to
 * be restrained. Adding a sixth reminder to this file cannot raise the ceiling.
 *
 * This used to be "one per half-day", split at 16:00. It read well and it
 * silently threw work away: the water check sits at 15:00, so for every woman
 * who told the quiz she trains in the morning (08:00) or at midday (12:30) her
 * movement reminder and her water check were in the same half — and movement
 * outranks water. She could never receive a water reminder at all, on any day
 * she still had a session owed, which is most days. Counting reminders and
 * spacing them says the thing the halves were a proxy for, and says it about
 * every pair rather than about a boundary neither of them chose.
 */

import {
  movementCopy,
  movementLookaheadCopy,
  planCopy,
  streakCopy,
  waterCopy,
  waterLookaheadCopy,
  weekStartCopy,
} from './copy';
import type {
  DayState,
  HourMinute,
  Reminder,
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

/** The ceiling. Nothing in this file can raise it; see the header. */
const MAX_PER_DAY = 2;

/**
 * How far apart two reminders have to be to both be worth sending.
 *
 * Two hours, which is the smallest gap in the whole candidate set that still
 * reads as two separate thoughts rather than one nagging app: a midday trainer
 * gets her movement nudge at 12:30 and her water check at 15:00, and those are
 * plainly about different things. Anything closer — the streak and week-start
 * reminders both land on `prefs.evening`, and a morning trainer's 08:00 session
 * sits half an hour from the 08:30 plan nudge — is one interruption said twice,
 * and the lower rank wins outright.
 */
const MIN_GAP_MINUTES = 120;

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
 * Who wins when two reminders land too close together, or when the day is
 * already full. Lower wins.
 *
 * One global order, so the whole policy is five lines you can read at once. It runs rarest-and-most-specific first: `week_start`
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
 * The two blind-day reminders that take it in turns.
 *
 * On a day we can see, the rank order above is the whole answer and water
 * earning last place is correct — it is the assist, not the ask. On a **blind**
 * day it silently became "never". The morning plan nudge is always true there
 * (`lookaheadReminders` sets `activeToday: false` by definition), so it takes
 * one of the two slots every single day; movement outranks water and takes the
 * other on every day the week still owes a session, which is most of them. The
 * cap then breaks before water is ever looked at. A woman who stopped opening
 * the app got the plan nudge seven days running and nothing else — the exact
 * shape of the bug the blind day was rewritten to fix, one rank lower down.
 *
 * So the second slot alternates rather than being won outright. The cap stays
 * at two and no day gets noisier; across the lookahead window she hears about
 * both. Rotation rather than a raised ceiling, because the ceiling is the whole
 * point of this file.
 */
const ROTATING: ReminderId[] = ['movement', 'water'];

/**
 * Every reminder a day is eligible for, before the cap.
 *
 * Each `if` is one product rule and reads as one.
 *
 * `blind` is a day we are scheduling in advance and therefore know nothing
 * about — see `lookaheadReminders`. It changes two things and nothing else: the
 * reminders that would need today's numbers use copy that names none, and the
 * rules that can only be answered by watching her (has she started, is her
 * streak at risk) are simply not asked.
 */
function candidates(
  state: DayState,
  prefs: ReminderPrefs,
  blind: boolean
): Reminder[] {
  const list: Reminder[] = [];

  /** Rank is never chosen by hand — the id decides it. */
  const at = (
    id: ReminderId,
    time: HourMinute,
    copy: Reminder['copy'],
    data: Record<string, string>
  ): Reminder => ({ id, rank: RANK[id], time, copy, data });

  // She has not touched today yet. The one reminder that opens the day.
  if (!state.activeToday) {
    list.push(
      at('plan', prefs.morning, planCopy(state.firstName), { screen: 'DailyLoop' })
    );
  }

  // The water row is the one thing a nudge genuinely helps with — it is counted
  // rather than felt, so it is the one she forgets. On a day we can see, it goes
  // only to a woman who has started and is behind: stacking a counted water ping
  // on top of the morning nudge is two interruptions to say "you have not begun".
  // On a blind day neither of those can be known, so it goes out uncounted and
  // the same-day pass replaces it the moment she opens the app.
  if (state.water) {
    if (blind) {
      list.push(
        at('water', WATER_HOUR, waterLookaheadCopy(state.water.target), {
          screen: 'Nutrition',
        })
      );
    } else if (
      state.activeToday &&
      state.water.count < state.water.target * WATER_BEHIND_RATIO
    ) {
      list.push(
        at('water', WATER_HOUR, waterCopy(state.water.count, state.water.target), {
          screen: 'Nutrition',
        })
      );
    }
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
  // It goes in the part of the day she named in the quiz, because a nudge to
  // train that arrives four hours after her one window is worse than no nudge at
  // all — it is a reminder she can only fail.
  //
  // Suppressed on a day she has already trained, but *not* on the blind days
  // after it: movement is counted across the week, so a session done today says
  // nothing about tomorrow. The blind copy names the task without the count for
  // the same reason the water one does — she may well train again tonight, and
  // a reminder that is wrong about her own numbers is worse than none.
  if (state.movement && (blind || !state.trainedToday)) {
    list.push(
      at(
        'movement',
        movementTime(state, prefs),
        blind
          ? movementLookaheadCopy(state.movement.title)
          : movementCopy(state.movement.title, state.movement.remaining),
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

/**
 * The reminders for one day: the best candidates the cap will admit.
 *
 * Best first, so a reminder is only ever dropped for one that matters more,
 * then returned in the order they will fire — which is also the order they read
 * in.
 */
function admitted(list: Reminder[]): Reminder[] {
  const kept: Reminder[] = [];

  for (const reminder of [...list].sort((a, b) => a.rank - b.rank)) {
    if (kept.length >= MAX_PER_DAY) break;
    const crowded = kept.some(
      (held) =>
        Math.abs(minutesOfDay(held.time) - minutesOfDay(reminder.time)) <
        MIN_GAP_MINUTES
    );
    if (!crowded) kept.push(reminder);
  }

  return kept.sort((a, b) => minutesOfDay(a.time) - minutesOfDay(b.time));
}

/** The reminders for today, from what we can actually see of her day. */
export function remindersForDay(
  state: DayState,
  prefs: ReminderPrefs
): Reminder[] {
  if (!prefs.enabled) return [];
  return admitted(candidates(state, prefs, false));
}

/**
 * The reminders for a day we know nothing about yet.
 *
 * Days beyond today are scheduled blind — she may well do her whole plan
 * tomorrow morning and never see them, and if she does, the next scheduling
 * pass cancels them before they fire.
 *
 * **This used to return the morning plan nudge and nothing else, which is the
 * bug that made water and movement look broken in production.** Everything but
 * `plan` was written for today only, and only ever from a foreground session
 * that happened *before* the reminder was due. A woman whose quiz answer was
 * "morning" needed the app open before 07:59 to be reminded to train at 08:00;
 * the water check at 15:00 needed a session, and a tick, before 14:59. In
 * development the app is never closed and everything schedules. In her hands the
 * plan nudge was the only one that ever arrived.
 *
 * So the blind day now asks the same question the real one does, with the two
 * inputs that survive a night — the week's open movement task and the fact that
 * her plan has a water row — and lets the cap decide, exactly as it does today.
 * Everything that needs to be watched to be true (has she started, is her streak
 * at risk, does a new week begin tomorrow) is left out rather than guessed.
 *
 * This is also the only channel left for a woman who has stopped opening the
 * app, and it decays on its own — see `LOOKAHEAD_DAYS`.
 *
 * `day` exists because the cap and the rank order together are not enough here:
 * the plan nudge is always true on a blind day and movement almost always is,
 * so water lost every slot it was ever eligible for. The second slot rotates
 * across the window instead — see `ROTATING`.
 */
export function lookaheadReminders(
  state: DayState,
  prefs: ReminderPrefs,
  /** How many days out this one is. Only the rotation reads it — see `ROTATING`. */
  day: number
): Reminder[] {
  if (!prefs.enabled) return [];

  const blind: DayState = {
    ...state,
    // Tomorrow has not been touched yet, by definition — which is what keeps the
    // morning plan nudge, the one reminder that is always true, in the set.
    activeToday: false,
    trainedToday: false,
    // Unknowable a day out, and both are read only through rules that would have
    // to guess. A streak scheduled blind would name a number that is wrong by
    // the time it fires; a week start is a fact today's pass already knows.
    streak: 0,
    weekStartingTomorrow: null,
  };

  return admitted(rotate(candidates(blind, prefs, true), day));
}

/**
 * Give the day's turn to one of the rotating pair, by dealing their own ranks
 * back out in a different order.
 *
 * Dealing the pair's existing ranks rather than nudging them means the set of
 * ranks in play is always exactly the set `RANK` declares, so nothing here can
 * step on `plan`, `streak` or `week_start` however the pair is ordered. A
 * reminder the day does not carry is simply not in `list`, and the deal is
 * then a no-op for it.
 */
function rotate(list: Reminder[], day: number): Reminder[] {
  const size = ROTATING.length;
  const turn = ((day % size) + size) % size;
  /** Whoever has the turn, then the rest behind it, in their usual order. */
  const order = [...ROTATING.slice(turn), ...ROTATING.slice(0, turn)];
  const ranks = ROTATING.map((id) => RANK[id]).sort((a, b) => a - b);
  const dealt = new Map(order.map((id, index) => [id, ranks[index]]));

  return list.map((reminder) => {
    const rank = dealt.get(reminder.id);
    return rank === undefined ? reminder : { ...reminder, rank };
  });
}

function minutesOfDay(time: HourMinute): number {
  return time.hour * 60 + time.minute;
}
