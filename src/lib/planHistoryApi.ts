/**
 * `GET /api/plan/history` — her eight weeks, scored day by day.
 *
 * Subscription-gated like the rest of `/api/plan/*`: a 403 flows out as
 * `ApiError` and `apiFetchWithAuth` has already told AuthContext to re-sync.
 * A 404 means she has no generated plan yet — the caller shows an empty state
 * rather than treating it as a failure.
 *
 * `cycle` picks which eight weeks. Omit it for the ones she is living in; pass
 * a number to read a plan she has finished. Either way the response carries the
 * full `cycles` list, so the switcher never needs a request of its own.
 */

import { apiFetchWithAuth, API_CONFIG } from './api';
import type { PlanHistory } from './planHistoryTypes';

export async function fetchPlanHistory(
  date: string,
  cycle?: number | null
): Promise<PlanHistory> {
  const query =
    `?date=${encodeURIComponent(date)}` +
    (cycle ? `&cycle=${encodeURIComponent(String(cycle))}` : '');
  return (await apiFetchWithAuth(
    `${API_CONFIG.endpoints.planHistory}${query}`
  )) as PlanHistory;
}
