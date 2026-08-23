/**
 * Whether she is standing in the few days before her subscription renews, and
 * has not yet been shown the screen about it.
 *
 * This is the one moment in eight weeks where continuing is an actual decision
 * rather than a default — the card is about to be charged, and she is at the
 * end of the plan she paid for. It is also the moment she is most likely to
 * quit, because the work is done and the next eight weeks look like more work.
 *
 * Three things worth keeping:
 *
 * 1. **The clock is `subscription_ends_at`, not the plan's day 56.** They run
 *    on different clocks — she is billed from checkout and her plan starts the
 *    day she first opened the app — and it is the charge that makes this a
 *    decision. `GET /api/account/status` is the only source of that date.
 * 2. **The marker is the renewal date itself.** Equal means "already shown for
 *    *this* renewal"; the next period end is a different string and re-arms the
 *    screen automatically. The server's `renewal_notice_sent_for` column plays
 *    exactly the same trick for the email, for the same reason: no reset ever
 *    has to be remembered.
 * 3. **A cancelled subscription never sees it.** She has already decided. Being
 *    told not to stop after choosing to stop is nagging, and she gets the
 *    honest `access_ending` alert instead.
 */

import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSeenMarker } from '../lib/seenMarker';

/**
 * How many days before the charge the screen opens.
 *
 * Matches `RENEWAL_NOTICE_DAYS` in the web app's `lib/pricing.ts`, which is
 * when the push and the email go out. They should agree — the notification is
 * what walks her to this screen.
 */
export const RENEWAL_PROMPT_DAYS = 3;

const DAY_MS = 86_400_000;

export type PlanRenewalPromptState = {
  /**
   * The renewal she has not been walked through, as the raw `subscription_ends_at`
   * string. Null when she is not in the window, has cancelled, or has seen it.
   */
  pendingRenewal: string | null;
  /** The date itself, for the screen's copy. */
  renewsOn: Date | null;
  markSeen: () => void;
};

export function usePlanRenewalPrompt(): PlanRenewalPromptState {
  const { user, accountStatus } = useAuth();

  const { value: seen, loaded, save } = useSeenMarker(
    user?.id ? `plan.renewalPromptSeen.${user.id}` : null
  );

  const endsAt = accountStatus?.subscription_ends_at ?? null;
  const renewsOn = endsAt ? new Date(endsAt) : null;

  // Whole days from now until the charge. Negative once it has passed, which
  // closes the window rather than reopening it.
  const daysAway =
    renewsOn && !Number.isNaN(renewsOn.getTime())
      ? Math.floor((renewsOn.getTime() - Date.now()) / DAY_MS)
      : null;

  const inWindow = daysAway !== null && daysAway >= 0 && daysAway <= RENEWAL_PROMPT_DAYS;

  const pendingRenewal =
    loaded &&
    endsAt &&
    inWindow &&
    accountStatus?.has_access &&
    !accountStatus.subscription_canceled &&
    seen !== endsAt
      ? endsAt
      : null;

  const markSeen = useCallback(() => {
    if (endsAt) save(endsAt);
  }, [endsAt, save]);

  return { pendingRenewal, renewsOn, markSeen };
}
