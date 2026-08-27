import { apiFetchWithAuth, ACCOUNT_STATUS_ENDPOINT } from './api';
import { logger } from './logger';

/** `account_status` column on user_trials. There is no trial — one plan, paid at checkout. */
export type AccountStatusValue = 'paid' | 'pending_payment' | 'expired';

/** The part of the day she said she trains in. Mirrors `user_profiles.training_time`. */
export type TrainingWindow = 'morning' | 'midday' | 'evening';

/**
 * Access state as decided by the server (`lib/getAccountState.ts` on the web app).
 * `active`, `canceling` and `past_due` all keep access; `canceling` keeps it until `ends_at`.
 */
export type AccountState = 'active' | 'canceling' | 'past_due' | 'ended' | 'disputed';

export type AccountDecision = 'allow' | 'paywall' | 'no-onboarding';

/** Response shape of GET /api/account/status. */
export type AccountStatus = {
  expired: boolean;
  decision: AccountDecision;
  state: AccountState;
  /** Access boundary. For a canceling subscription this is the last day she keeps access. */
  ends_at: string | null;
  /** Whole days until `ends_at`, floored at 0. Null when there is no end date. */
  days_left: number | null;
  previously_paid: boolean;
  /** True for Apple/Google-managed subscriptions — manage in the store, not on the web. */
  is_third_party_provider: boolean;
  has_access: boolean;
  account_status: AccountStatusValue | null;
  subscription_ends_at: string | null;
  subscription_canceled: boolean;
  payment_failed_at: string | null;
  has_onboarding: boolean;
  /**
   * Her first name, already trimmed to one word by the server. Null when the
   * quiz never captured one — every surface that uses it must read fine
   * without it, so never build a sentence that needs it to be there.
   */
  first_name: string | null;
  /**
   * When she told the quiz she has time to exercise — "morning" | "midday" |
   * "evening", or null for an account that predates the question.
   *
   * The app's local movement reminder is scheduled against it. Null falls back
   * to an evening reminder, which is what everybody received before the
   * question existed; her own choice in Settings overrides it either way.
   */
  training_time: TrainingWindow | null;
};

const STATUS_TIMEOUT_MS = 10_000;

/** Deny-by-default status. Used when the status call fails — never leave access ambiguous. */
export const DENIED_ACCOUNT_STATUS: AccountStatus = {
  expired: true,
  decision: 'paywall',
  state: 'ended',
  ends_at: null,
  days_left: null,
  previously_paid: false,
  is_third_party_provider: false,
  has_access: false,
  account_status: 'expired',
  subscription_ends_at: null,
  subscription_canceled: false,
  payment_failed_at: null,
  has_onboarding: false,
  first_name: null,
  training_time: null,
};

/**
 * Fetch the canonical account/subscription status from the web API.
 *
 * This is the single source of truth for access. Do not re-derive it from a
 * direct `user_trials` query — the client cannot see disputes, dunning or the
 * fail-closed rules, and a schema change silently breaks the read.
 */
export async function fetchAccountStatus(): Promise<AccountStatus> {
  // The transport timeout actually aborts the request, where the old promise
  // race only stopped waiting on one that carried on running in the background.
  const data = await apiFetchWithAuth(ACCOUNT_STATUS_ENDPOINT, {
    method: 'GET',
    timeoutMs: STATUS_TIMEOUT_MS,
  });

  if (!data || typeof data !== 'object' || !('state' in data)) {
    logger.warn('fetchAccountStatus: unexpected response shape', data);
    throw new Error('Unexpected account status response');
  }

  return data as AccountStatus;
}
