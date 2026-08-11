/**
 * Calls against the plan endpoints on the Next.js app.
 *
 * All three routes are subscription-gated: a 403 flows out as `ApiError` and
 * `apiFetchWithAuth` has already told AuthContext to re-sync, which moves the
 * navigator to the paywall. Callers must not add a second paywall path.
 */

import { apiFetchWithAuth, API_CONFIG } from './api';
import type {
  AddHabitResponse,
  CompleteResponse,
  HabitKind,
  PlanResponse,
} from './planTypes';

/**
 * `YYYY-MM-DD` from the device's LOCAL calendar parts.
 *
 * Deliberately not `toISOString()`, which is UTC: west of Greenwich it returns
 * tomorrow's date all evening, and east of it yesterday's date in the early
 * morning. That matters more here than anywhere else in the app — the first
 * ever `GET /api/plan` stamps `started_at` from the date we send, once and
 * permanently, so a UTC slip moves day 1 of her eight weeks for good.
 */
export function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Whole days from `from` to `to`, both `YYYY-MM-DD`. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Read the plan for one day.
 *
 * `media=1` is always sent: it is the opt-in for exercise clip URLs, and asking
 * costs nothing while the server's ready-set is empty.
 */
export async function fetchPlan(date: string): Promise<PlanResponse> {
  const query = `?date=${encodeURIComponent(date)}&media=1`;
  return (await apiFetchWithAuth(`${API_CONFIG.endpoints.plan}${query}`)) as PlanResponse;
}

type CompleteArgs = {
  taskKey: string;
  date: string;
  /** The NEW TOTAL for that key on that date. It replaces; it does not add. */
  count: number;
};

/** Set the tick count for one key on one day. Idempotent — safe to replay. */
export async function completeTask({
  taskKey,
  date,
  count,
}: CompleteArgs): Promise<CompleteResponse> {
  return (await apiFetchWithAuth(API_CONFIG.endpoints.planComplete, {
    method: 'POST',
    body: JSON.stringify({ taskKey, date, done: true, count }),
  })) as CompleteResponse;
}

/** Clear a key for a day entirely. `count` is ignored server-side — the row is deleted. */
export async function clearTask(taskKey: string, date: string): Promise<CompleteResponse> {
  return (await apiFetchWithAuth(API_CONFIG.endpoints.planComplete, {
    method: 'POST',
    body: JSON.stringify({ taskKey, date, done: false }),
  })) as CompleteResponse;
}

/** Create one of her own habits. Rejected with a 400 past MAX_HABITS. */
export async function addHabit(title: string, kind: HabitKind): Promise<AddHabitResponse> {
  return (await apiFetchWithAuth(API_CONFIG.endpoints.planHabits, {
    method: 'POST',
    body: JSON.stringify({ title, kind }),
  })) as AddHabitResponse;
}

/** Delete a habit and every tick she logged against it. */
export async function deleteHabit(id: string): Promise<void> {
  await apiFetchWithAuth(`${API_CONFIG.endpoints.planHabits}?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
