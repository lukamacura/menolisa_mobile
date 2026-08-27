/**
 * The `expo-notifications` side: turn a decision into scheduled local alerts.
 *
 * The model is **cancel and rebuild**, not incremental edits. Every pass wipes
 * the reminders this module owns and schedules the current answer from scratch.
 * It costs a handful of native calls and it removes the entire class of bug
 * where a stale reminder survives the state change that should have killed it —
 * which, for a notification, is the bug that actually loses you the user.
 *
 * Nothing here decides *what* to send. That is `select.ts`.
 */

import { Platform } from 'react-native';
import { getNativeExpoNotifications } from '../expoNotificationsGate';
import { logger } from '../logger';
import { lookaheadReminder, remindersForDay } from './select';
import type { DayState, HourMinute, Reminder, ReminderPrefs } from './types';

/**
 * Stamped on every reminder this module schedules.
 *
 * The cancel pass matches on it rather than calling
 * `cancelAllScheduledNotificationsAsync()`, so anything else in the app — now
 * or later — that schedules a local notification is never silently wiped by a
 * plan refresh.
 */
export const REMINDER_SOURCE = 'menolisa.reminder';

/**
 * Its own Android channel, at DEFAULT importance.
 *
 * The `default` channel that carries server pushes is HIGH: it takes over the
 * screen and vibrates in a pattern, which is right for a declined card and
 * wrong for "you're at 3 of 6 glasses". These land quietly in the shade with a
 * single soft buzz. She can retune or silence the channel from Android settings
 * without touching the rest, which is exactly what channels are for.
 */
const CHANNEL_ID = 'reminders';

/**
 * How many days ahead the gentle re-engagement nudge is scheduled.
 *
 * Days beyond today are scheduled blind, so only the always-true morning
 * reminder goes out on them (see `lookaheadReminder`). The window doubles as
 * the decay: a woman who stops opening the app gets one quiet nudge a day for a
 * week and then silence, rather than a daily nudge forever from a server that
 * cannot tell she has gone. If she comes back, the next pass refills it.
 */
const LOOKAHEAD_DAYS = 7;

/**
 * Headroom before a reminder is considered still schedulable.
 *
 * A `DATE` trigger in the past fires immediately. Without this, opening the app
 * at 8:31 am would set off the 8:30 reminder in her hand.
 */
const MIN_LEAD_MS = 60_000;

/** True for a notification this module scheduled — used by the foreground handler. */
export function isLocalReminder(data: unknown): boolean {
  return (data as { source?: string } | null | undefined)?.source === REMINDER_SOURCE;
}

/**
 * Which sync pass is the current one.
 *
 * Each pass cancels before it schedules, and both halves are `await`ed against
 * native. Without this, a second pass starting mid-flight cancels the first
 * pass's work and then the first pass calmly finishes writing the rest of it —
 * leaving reminders nothing will ever cancel, because the newer pass never knew
 * they existed. Every pass bumps this and checks it before each native write.
 */
let generation = 0;

type Notifications = NonNullable<ReturnType<typeof getNativeExpoNotifications>>;

/**
 * Create the reminders channel. Idempotent — Android updates the existing one.
 * Must run before the first schedule, or the notification lands on no channel
 * and is dropped without an error.
 */
async function ensureChannel(Notifications: Notifications): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Daily reminders',
    description: 'Your plan, movement and water, at the times you chose.',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180],
  });
}

/**
 * Cancel every reminder this module owns, leaving anything else alone.
 *
 * Bumps the generation, so an in-flight sync cannot finish writing reminders
 * after a sign-out has cleared them.
 */
export async function cancelScheduledReminders(): Promise<void> {
  generation += 1;
  const Notifications = getNativeExpoNotifications();
  if (!Notifications) return;
  await clearOurs(Notifications);
}

/** The cancel half, without claiming a new generation. */
async function clearOurs(Notifications: Notifications): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((item) => isLocalReminder(item.content.data))
        .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier))
    );
  } catch (err) {
    logger.warn('Failed to clear scheduled reminders', err);
  }
}

/**
 * Rebuild the whole schedule from the current state of her day.
 *
 * Safe to call as often as anything changes — it is idempotent, and cheap
 * enough that debouncing it is about avoiding native chatter, not cost.
 */
export async function syncScheduledReminders(input: {
  state: DayState;
  prefs: ReminderPrefs;
}): Promise<void> {
  const Notifications = getNativeExpoNotifications();
  if (!Notifications) return;

  const { state, prefs } = input;
  const pass = (generation += 1);

  try {
    await clearOurs(Notifications);
    if (!prefs.enabled || pass !== generation) return;

    await ensureChannel(Notifications);

    const now = new Date();
    const planned: { reminder: Reminder; at: Date }[] = [];

    // Today, from what we actually know.
    for (const reminder of remindersForDay(state, prefs)) {
      const at = atLocalTime(now, 0, reminder.time);
      if (at.getTime() > now.getTime() + MIN_LEAD_MS) planned.push({ reminder, at });
    }

    // The days after, blind.
    const ahead = lookaheadReminder(state.firstName, prefs);
    if (ahead) {
      for (let day = 1; day < LOOKAHEAD_DAYS; day += 1) {
        planned.push({ reminder: ahead, at: atLocalTime(now, day, ahead.time) });
      }
    }

    for (const { reminder, at } of planned) {
      // A newer pass has taken over and already cancelled what we wrote above.
      if (pass !== generation) return;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.copy.title,
          body: reminder.copy.body,
          sound: true,
          // `active` and not `timeSensitive`: none of this is urgent enough to
          // deserve breaking through a Focus mode she turned on deliberately.
          interruptionLevel: 'active',
          data: { source: REMINDER_SOURCE, id: reminder.id, ...reminder.data },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: at,
          channelId: CHANNEL_ID,
        },
      });
    }
  } catch (err) {
    logger.warn('Failed to schedule reminders', err);
  }
}

/**
 * `days` from now, at a local wall-clock time.
 *
 * Built by mutating a local `Date` rather than by arithmetic on a timestamp, so
 * a daylight-saving change keeps the reminder at the hour she chose instead of
 * sliding it by one.
 */
function atLocalTime(from: Date, days: number, time: HourMinute): Date {
  const at = new Date(from);
  at.setDate(at.getDate() + days);
  at.setHours(time.hour, time.minute, 0, 0);
  return at;
}
