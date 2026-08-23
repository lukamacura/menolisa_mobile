import type { TimeSelection } from './symptomTrackerConstants';

/**
 * Turning "when did this happen" into a timestamp.
 *
 * Both the log flow and the edit flow used to inline the same three-branch
 * calculation over `customTime.split(':').map(Number)`. With a free-text field
 * behind it that is a crash: "9", "9am" and a half-typed "1" all yield NaN,
 * `setHours(NaN, …)` makes an Invalid Date, and `.toISOString()` throws
 * RangeError from inside the submit handler — so she gets "Invalid time value"
 * where the symptom she just described should have been saved.
 *
 * A symptom log is the one thing in this app she cannot reconstruct later, so
 * the rule here is: never guess at a malformed time, and never record one that
 * hasn't happened yet.
 */

export const TIME_INPUT_PLACEHOLDER = 'HH:MM';
/** "HH:MM" — the field can hold nothing longer. */
export const TIME_INPUT_MAX_LENGTH = 5;

/** How far back "Earlier today" means when she doesn't name a time. */
const DEFAULT_EARLIER_HOURS = 2;

export type ParsedTime = { hours: number; minutes: number };

/**
 * Parse a 24-hour "HH:MM". Returns null for anything that is not a real time —
 * including the partial input she is still typing.
 */
export function parseTimeInput(value: string): ParsedTime | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

/**
 * Keep the field to digits and one colon, and insert the colon for her.
 *
 * Typing "0930" becomes "09:30" without her hunting for the colon key on a
 * numeric keypad — the reason the raw field produced so much unparseable input.
 */
export function formatTimeInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export type LoggedAtResult =
  | {
      valid: true;
      /** ISO instant to record, or undefined for "now" — let the server stamp it. */
      loggedAt: string | undefined;
    }
  | { valid: false; message: string };

/**
 * Resolve the timestamp for a log, or say why it can't be resolved.
 *
 * Callers gate the submit button on `valid` and show `message` inline, so a
 * malformed time is caught while she can still fix it rather than after the
 * request has failed.
 */
export function resolveLoggedAt(
  selection: TimeSelection,
  customTime: string,
  now: Date = new Date()
): LoggedAtResult {
  if (selection === 'now') return { valid: true, loggedAt: undefined };

  const trimmed = customTime.trim();
  const parsed = trimmed ? parseTimeInput(trimmed) : null;
  if (trimmed && !parsed) {
    return { valid: false, message: 'Enter a time as HH:MM, like 14:30.' };
  }

  if (selection === 'earlier-today') {
    const logTime = new Date(now);
    if (parsed) {
      logTime.setHours(parsed.hours, parsed.minutes, 0, 0);
      // She chose "Earlier today" — a time still ahead of the clock is a typo,
      // not a prediction, and silently storing it would corrupt her history.
      if (logTime.getTime() > now.getTime()) {
        return { valid: false, message: "That's later today. Pick a time that has already passed." };
      }
    } else {
      logTime.setHours(logTime.getHours() - DEFAULT_EARLIER_HOURS);
    }
    return { valid: true, loggedAt: logTime.toISOString() };
  }

  // Yesterday: same clock time as now unless she names one.
  const logTime = new Date(now);
  logTime.setDate(logTime.getDate() - 1);
  if (parsed) logTime.setHours(parsed.hours, parsed.minutes, 0, 0);
  else logTime.setHours(now.getHours(), now.getMinutes(), 0, 0);
  return { valid: true, loggedAt: logTime.toISOString() };
}
