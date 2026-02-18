import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { apiFetchWithAuth } from '../lib/api';

const MS = { DAY: 86_400_000 };

/** account_status from user_trials: paid = subscriber, expired, trial, etc. */
export type AccountStatus = 'paid' | 'expired' | 'trial' | string | null;

export type TrialStatus = {
  expired: boolean;
  loading: boolean;
  error: string | null;
  /** Days until trial end; 0 or negative when expired */
  daysLeft: number;
  /** Trial end date, or null if no trial; for paid = subscription_ends_at */
  end: Date | null;
  /** Subscriber (paid) vs trial vs expired */
  accountStatus: AccountStatus;
  /** True when subscription is set to cancel (show "Access until" not "Renews") */
  subscriptionCanceled: boolean;
  /** Call to refetch trial/subscription state (e.g. after checkout success) */
  refetch: () => Promise<void>;
};

export function useTrialStatus(): TrialStatus {
  const [status, setStatus] = useState<Omit<TrialStatus, 'refetch'>>({
    expired: false,
    loading: true,
    error: null,
    daysLeft: 0,
    end: null,
    accountStatus: null,
    subscriptionCanceled: false,
  });

  const fetchTrial = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_trials')
        .select('trial_start, trial_end, trial_days, account_status, subscription_ends_at, subscription_canceled')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { expired: false, daysLeft: 0, end: null, accountStatus: null, subscriptionCanceled: false };
        }
        return { expired: false, daysLeft: 0, end: null, accountStatus: null, subscriptionCanceled: false };
      }

      const accountStatus = (data?.account_status as AccountStatus) ?? null;
      const subscriptionCanceled = !!data?.subscription_canceled;

      if (accountStatus === 'paid') {
        const subEnd = data?.subscription_ends_at ? new Date(data.subscription_ends_at).getTime() : null;
        const endMs = subEnd ?? Date.now() + 365 * MS.DAY;
        const expired = data?.account_status === 'expired' || (subEnd != null && Date.now() >= subEnd);
        const daysLeft = expired ? 0 : Math.max(0, Math.ceil((endMs - Date.now()) / MS.DAY));
        const end = new Date(endMs);
        return { expired, daysLeft, end, accountStatus, subscriptionCanceled };
      }

      const trialDays = data?.trial_days ?? 3;
      const start = data?.trial_start ? new Date(data.trial_start).getTime() : Date.now();
      const endMs = data?.trial_end
        ? new Date(data.trial_end).getTime()
        : start + trialDays * MS.DAY;
      const expired =
        data?.account_status === 'expired' || Date.now() >= endMs;
      const daysLeft = expired ? 0 : Math.max(0, Math.ceil((endMs - Date.now()) / MS.DAY));
      const end = new Date(endMs);
      return { expired, daysLeft, end, accountStatus, subscriptionCanceled: false };
    } catch {
      return { expired: false, daysLeft: 0, end: null, accountStatus: null, subscriptionCanceled: false };
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id;
        if (!userId) {
          if (mounted) setStatus({ expired: false, loading: false, error: null, daysLeft: 0, end: null, accountStatus: null, subscriptionCanceled: false });
          return;
        }
        let result = await fetchTrial(userId);
        if (result.accountStatus === 'paid') {
          try {
            await apiFetchWithAuth('/api/stripe/sync-subscription', { method: 'POST' });
            result = await fetchTrial(userId);
          } catch {
            // ignore sync errors
          }
        }
        if (mounted) setStatus({ expired: result.expired, loading: false, error: null, daysLeft: result.daysLeft, end: result.end, accountStatus: result.accountStatus, subscriptionCanceled: result.subscriptionCanceled });
      } catch (e) {
        if (mounted) {
          setStatus({
            expired: false,
            loading: false,
            error: e instanceof Error ? e.message : 'Unknown error',
            daysLeft: 0,
            end: null,
            accountStatus: null,
            subscriptionCanceled: false,
          });
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [fetchTrial]);

  const refetch = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return;
      setStatus((s) => ({ ...s, loading: true }));
      let result = await fetchTrial(userId);
      if (result.accountStatus === 'paid') {
        try {
          await apiFetchWithAuth('/api/stripe/sync-subscription', { method: 'POST' });
          result = await fetchTrial(userId);
        } catch {
          // ignore sync errors
        }
      }
      setStatus({ expired: result.expired, loading: false, error: null, daysLeft: result.daysLeft, end: result.end, accountStatus: result.accountStatus, subscriptionCanceled: result.subscriptionCanceled });
    } catch (e) {
      setStatus((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : 'Unknown error',
      }));
    }
  }, [fetchTrial]);

  return { ...status, refetch };
}
