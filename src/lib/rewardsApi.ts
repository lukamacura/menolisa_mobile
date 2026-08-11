/**
 * Calls against `GET /api/rewards` on the Next.js app.
 *
 * Subscription-gated like every other plan route: a 403 flows out as `ApiError`
 * and `apiFetchWithAuth` has already told AuthContext to re-sync, which moves
 * the navigator to the paywall. Do not add a second paywall path here.
 */

import { apiFetchWithAuth, API_CONFIG } from './api';
import type { RewardsPayload } from './rewardTypes';

/**
 * Read her rewards for one day.
 *
 * The date is sent for the same reason the plan sends it: "today" is a local
 * question, and the server would otherwise score her against UTC — which is
 * tomorrow all evening west of Greenwich, quietly breaking the streak she is
 * looking at.
 */
export async function fetchRewards(date: string): Promise<RewardsPayload> {
  const query = `?date=${encodeURIComponent(date)}`;
  return (await apiFetchWithAuth(`${API_CONFIG.endpoints.rewards}${query}`)) as RewardsPayload;
}
