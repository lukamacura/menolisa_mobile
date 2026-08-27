import { useEffect, useSyncExternalStore } from 'react';
import {
  getReminderPrefs,
  loadReminderPrefs,
  subscribeReminderPrefs,
} from '../lib/reminders/prefs';
import type { ReminderPrefs } from '../lib/reminders/types';

/**
 * Her reminder settings, live.
 *
 * `null` until the first read from storage completes — callers must treat that
 * as "do not act yet" rather than falling back to the defaults, or the
 * scheduler briefly writes reminders for someone who has switched them off.
 *
 * Every consumer sees the same object because the store behind it is a module
 * singleton, so a change in Settings reaches the scheduler with no plumbing in
 * between.
 */
export function useReminderPrefs(): ReminderPrefs | null {
  useEffect(() => {
    loadReminderPrefs();
  }, []);

  return useSyncExternalStore(subscribeReminderPrefs, getReminderPrefs);
}
