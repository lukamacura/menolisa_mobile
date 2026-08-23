import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import type { AccountState, AccountStatusValue } from '../lib/accountStatus';

/**
 * Subscription state for UI, derived from GET /api/account/status via AuthContext.
 *
 * This used to query `user_trials` directly for `trial_start`/`trial_end`/`trial_days`.
 * Those columns were dropped when the free trial was removed, which made the whole
 * select fail (Postgres 42703) for every user — the hook then reported "0 days left,
 * not a subscriber" to paying customers and popped an expiry paywall at them.
 *
 * The server is the only thing that knows the access rules (disputes, dunning,
 * canceled-but-still-paid-for). Read them from it; never re-derive them here.
 */

export type { AccountStatusValue as AccountStatus };

export type TrialStatus = {
  /** True when access has ended. Mirrors the server's decision — do not re-derive. */
  expired: boolean;
  loading: boolean;
  /** Days until access ends. Null when there is no end date — never treat that as 0. */
  daysLeft: number | null;
  /** Access boundary: renewal date, or last day of access when canceling. */
  end: Date | null;
  accountStatus: AccountStatusValue | null;
  /** True when the subscription will not renew — show "Access until", not "Renews". */
  subscriptionCanceled: boolean;
  /** Server access state: active | canceling | past_due | ended | disputed. */
  state: AccountState | null;
  /** True for Apple/Google-managed subscriptions — manage in the store, not on the web. */
  isThirdPartyProvider: boolean;
  /** Her first name, or null. Never build a sentence that breaks without it. */
  firstName: string | null;
  /**
   * Plain status read. Referentially stable, so it is safe as a `useFocusEffect`
   * dependency — an unstable one re-armed the effect on every response and
   * turned one focus into a loop of reads.
   */
  refetch: () => Promise<void>;
  /** Sync Stripe first, then read. Only for "I just paid" moments — it is expensive. */
  reconcile: () => Promise<void>;
};

export function useTrialStatus(): TrialStatus {
  const { accountStatus, accountStatusLoading, refetchAccountStatus, reconcileAccountStatus } =
    useAuth();

  return useMemo(
    () => ({
      expired: accountStatus ? !accountStatus.has_access : false,
      loading: accountStatusLoading || accountStatus === null,
      daysLeft: accountStatus?.days_left ?? null,
      end: accountStatus?.ends_at ? new Date(accountStatus.ends_at) : null,
      accountStatus: accountStatus?.account_status ?? null,
      subscriptionCanceled: accountStatus?.subscription_canceled ?? false,
      state: accountStatus?.state ?? null,
      isThirdPartyProvider: accountStatus?.is_third_party_provider ?? false,
      firstName: accountStatus?.first_name ?? null,
      refetch: refetchAccountStatus,
      reconcile: reconcileAccountStatus,
    }),
    [accountStatus, accountStatusLoading, refetchAccountStatus, reconcileAccountStatus],
  );
}
