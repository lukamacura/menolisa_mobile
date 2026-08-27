/**
 * Her reminder settings, on the device.
 *
 * Local rather than on `user_preferences` because the sender is local: the
 * times are read by the scheduler running on this phone, in this phone's
 * timezone, and nothing on the server has any use for them. Putting them behind
 * an API would add a round trip, a failure mode and a race to a value the only
 * consumer already has in hand.
 *
 * The consequence — settings do not follow her to a second device — is the
 * right behaviour anyway: "remind me at 8am" is a statement about the phone she
 * wants to be interrupted on, not about her account.
 *
 * A module-level cache with subscribers sits in front of AsyncStorage so the
 * settings screen and the scheduler are never looking at different answers. The
 * screen writes; the scheduler is told, and rebuilds.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../logger';
import { TRAINING_TIMES } from './select';
import type { HourMinute, ReminderPrefs } from './types';

const STORAGE_KEY = '@menolisa:reminders_v1';

/**
 * What she gets before she has chosen anything.
 *
 * On by default, because a reminder she has to go and find is one almost nobody
 * turns on, and this set is capped at two a day by construction. The times sit
 * either side of a working day: early enough to shape the morning, late enough
 * that the evening one still leaves her time to act on it.
 */
export const DEFAULT_PREFS: ReminderPrefs = {
  enabled: true,
  morning: { hour: 8, minute: 30 },
  evening: { hour: 18, minute: 30 },
  // Null, not a time: her quiz answer decides until she says otherwise here.
  movement: null,
};

/** The morning times she can pick from. Any more and it becomes a decision. */
export const MORNING_CHOICES: HourMinute[] = [
  { hour: 7, minute: 0 },
  { hour: 8, minute: 30 },
  { hour: 10, minute: 0 },
];

/** The evening times she can pick from. Nothing past nine — that is bedtime. */
export const EVENING_CHOICES: HourMinute[] = [
  { hour: 17, minute: 0 },
  { hour: 18, minute: 30 },
  { hour: 20, minute: 30 },
];

/**
 * The movement times she can pick from — the three windows the quiz offered,
 * as the clock times they mean.
 *
 * Built from `TRAINING_TIMES` rather than written out again, so the row in
 * Settings and the answer she gave in the funnel can never drift apart.
 */
export const MOVEMENT_CHOICES: HourMinute[] = [
  TRAINING_TIMES.morning,
  TRAINING_TIMES.midday,
  TRAINING_TIMES.evening,
];

/** "8:30 am" — how a time is written everywhere she can read one. */
export function formatTime({ hour, minute }: HourMinute): string {
  const suffix = hour < 12 ? 'am' : 'pm';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function sameTime(a: HourMinute, b: HourMinute): boolean {
  return a.hour === b.hour && a.minute === b.minute;
}

// ---------------------------------------------------------------------------
// Store
//
// `null` means "not read yet" and is deliberately distinct from the defaults:
// nothing may be scheduled before the real answer is known, or a cold start
// races the read and briefly schedules reminders she has switched off.
// ---------------------------------------------------------------------------

let cached: ReminderPrefs | null = null;
let loading: Promise<ReminderPrefs> | null = null;
const listeners = new Set<() => void>();

/** The current settings, or `null` while the first read is still in flight. */
export function getReminderPrefs(): ReminderPrefs | null {
  return cached;
}

export function subscribeReminderPrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Read her settings, falling back to the defaults on anything unexpected.
 *
 * Never throws and never returns a partial object: a half-read preference would
 * schedule a reminder at `NaN`, which `expo-notifications` accepts and then
 * never fires. Concurrent callers share one read.
 */
export function loadReminderPrefs(): Promise<ReminderPrefs> {
  if (cached) return Promise.resolve(cached);
  if (loading) return loading;

  loading = (async () => {
    let prefs = DEFAULT_PREFS;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ReminderPrefs>;
        prefs = {
          enabled:
            typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_PREFS.enabled,
          morning: validTime(parsed.morning) ?? DEFAULT_PREFS.morning,
          evening: validTime(parsed.evening) ?? DEFAULT_PREFS.evening,
          // Unlike the two above, an unreadable value here falls back to null
          // rather than to a default time — "she has not chosen" is a real
          // state, and it is the one that lets her quiz answer through.
          movement: validTime(parsed.movement),
        };
      }
    } catch (err) {
      logger.warn('Reminder prefs unreadable, using defaults', err);
    }
    publish(prefs);
    loading = null;
    return prefs;
  })();

  return loading;
}

/**
 * Apply and persist. The new value is published before the write, so the
 * scheduler reacts at the speed of the switch rather than the speed of the disk.
 * Never throws — the caller has already shown the change on screen.
 */
export async function saveReminderPrefs(prefs: ReminderPrefs): Promise<void> {
  publish(prefs);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (err) {
    logger.warn('Failed to save reminder prefs', err);
  }
}

function publish(prefs: ReminderPrefs): void {
  cached = prefs;
  listeners.forEach((listener) => listener());
}

function validTime(value: unknown): HourMinute | null {
  if (!value || typeof value !== 'object') return null;
  const { hour, minute } = value as Partial<HourMinute>;
  if (typeof hour !== 'number' || typeof minute !== 'number') return null;
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}
