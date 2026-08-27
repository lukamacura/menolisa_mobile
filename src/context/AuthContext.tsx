import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { apiFetchWithAuth, setSubscriptionRequiredHandler } from '../lib/api';
import { unregisterPushToken } from '../lib/pushToken';
import { cancelScheduledReminders } from '../lib/reminders/schedule';
import { logger } from '../lib/logger';
import {
  fetchAccountStatus,
  DENIED_ACCOUNT_STATUS,
  type AccountStatus,
} from '../lib/accountStatus';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  accountStatus: AccountStatus | null;
  accountStatusLoading: boolean;
  /**
   * True when the last status read failed and what we hold is a guess, not the
   * server's answer. The paywall uses it to say "we couldn't check" instead of
   * "your subscription ended" — the two are not the same sentence to a woman
   * who paid this morning.
   */
  accountStatusUnavailable: boolean;
  /** Plain status read. Cheap — safe to call on every screen focus. */
  refetchAccountStatus: () => Promise<void>;
  /**
   * Nudge Stripe to catch up, then re-read status.
   *
   * Only for the moments where a missed webhook is the likely explanation —
   * returning from checkout, or tapping "I've completed checkout". It costs a
   * round trip to Stripe, so it must never sit on a focus handler.
   */
  reconcileAccountStatus: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [accountStatusLoading, setAccountStatusLoading] = useState(false);
  const [accountStatusUnavailable, setAccountStatusUnavailable] = useState(false);
  const userRef = useRef<User | null>(null);
  /** The last answer the server actually gave us, to fall back on when it can't be reached. */
  const lastKnownStatus = useRef<AccountStatus | null>(null);

  /**
   * Read the canonical access status.
   *
   * Only a successful response revokes access. A timeout, a dropped connection
   * or a 500 means we do not know — and treating "we could not ask" as "she did
   * not pay" is how a subscriber on a train gets shown a paywall for a
   * subscription that is perfectly current. So:
   *
   * - Server answered → trust it, whatever it says.
   * - Could not reach it, but we have a previous answer → keep that answer.
   * - Could not reach it and never had one → fail closed, but flagged as
   *   unavailable so the paywall offers a retry rather than an eulogy.
   */
  const refetchAccountStatus = useCallback(async () => {
    if (!userRef.current) {
      setAccountStatus(null);
      lastKnownStatus.current = null;
      setAccountStatusUnavailable(false);
      return;
    }
    setAccountStatusLoading(true);
    try {
      const status = await fetchAccountStatus();
      lastKnownStatus.current = status;
      setAccountStatus(status);
      setAccountStatusUnavailable(false);
    } catch (err) {
      logger.warn('refetchAccountStatus failed', err);
      setAccountStatusUnavailable(true);
      // Never leave accountStatus null after an authed attempt — that hangs the navigator.
      setAccountStatus(lastKnownStatus.current ?? DENIED_ACCOUNT_STATUS);
    } finally {
      setAccountStatusLoading(false);
    }
  }, []);

  /** Mirrors `accountStatus` so `reconcileAccountStatus` can stay referentially stable. */
  const statusRef = useRef<AccountStatus | null>(null);
  statusRef.current = accountStatus;

  const reconcileAccountStatus = useCallback(async () => {
    const current = statusRef.current;
    // Apple/Google subscriptions reconcile through their own server
    // notifications, so there is no Stripe record to sync.
    if (current?.account_status === 'paid' && !current.is_third_party_provider) {
      try {
        await apiFetchWithAuth('/api/stripe/sync-subscription', { method: 'POST' });
      } catch {
        // Best-effort; the status read below is what actually matters.
      }
    }
    await refetchAccountStatus();
  }, [refetchAccountStatus]);

  // Any gated route answering 403 means access ended mid-session. Re-read status so
  // AppNavigator moves her to the paywall instead of a screen stuck on an error.
  useEffect(() => {
    setSubscriptionRequiredHandler(() => {
      if (userRef.current) refetchAccountStatus();
    });
    return () => setSubscriptionRequiredHandler(null);
  }, [refetchAccountStatus]);

  /**
   * Sign out, and actually stay signed out.
   *
   * Everything before the `finally` is best-effort, because none of it is
   * allowed to decide whether she gets logged out. Two ways this used to fail
   * silently, both of which end with a Log out button that does nothing:
   *
   * 1. **The push unregister hung.** It runs first (it needs the still-valid
   *    Bearer token), and `getExpoPushTokenAsync()` had no timeout, so an
   *    unreachable push service blocked the whole thing. It is time-boxed now —
   *    see `pushToken.ts`.
   * 2. **The stored session survived.** `supabase.auth.signOut()` returns
   *    `{ error }` rather than throwing, and it forgives 401/403/404 — but on a
   *    network failure it skips removing the persisted session, so the app
   *    signed her straight back in on the next launch. A `scope: 'local'`
   *    retry is pure storage and cannot fail for network reasons.
   */
  const signOut = useCallback(async () => {
    // Drop this device's push token first — it needs the still-valid Bearer token,
    // and a signed-out phone must not keep buzzing with the account's reminders.
    await unregisterPushToken();

    // The local ones have to go too, and they have to go from here. They are
    // scheduled with the OS rather than held in memory, so nothing stops them
    // by being unmounted: the tabs are torn down the moment the session clears,
    // and a week of her plan reminders would go on firing at whoever is holding
    // the phone. Not awaited — it is device-local and cannot block a sign-out.
    cancelScheduledReminders().catch(() => {});

    try {
      // Global scope revokes the refresh token server-side, so a copy of it
      // lifted off the device stops working. Worth attempting; not worth
      // staying signed in over.
      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.warn('Global sign-out failed; clearing the local session', error);
        await supabase.auth.signOut({ scope: 'local' });
      }
    } catch (err) {
      logger.warn('Sign-out threw; clearing local state anyway', err);
    } finally {
      setUser(null);
      userRef.current = null;
      setAccountStatus(null);
      lastKnownStatus.current = null;
      setAccountStatusUnavailable(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const hasConfig = !!(
      process.env.EXPO_PUBLIC_SUPABASE_URL &&
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.EXPO_PUBLIC_SUPABASE_URL !== '' &&
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY !== ''
    );

    if (!hasConfig) {
      setUser(null);
      setLoading(false);
      return;
    }

    const applyUser = (next: User | null) => {
      if (!mounted) return;
      const prevId = userRef.current?.id ?? null;
      const nextId = next?.id ?? null;
      userRef.current = next;
      setUser(next);
      if (nextId && nextId !== prevId) {
        // New session — nothing the previous account knew applies here.
        lastKnownStatus.current = null;
        refetchAccountStatus();
      } else if (!nextId) {
        setAccountStatus(null);
        lastKnownStatus.current = null;
        setAccountStatusUnavailable(false);
      }
    };

    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (!mounted) return;
        if (error) {
          logger.warn('Auth check error:', error);
        }
        applyUser(session?.user ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (mounted) {
          logger.warn('Auth check failed:', err);
          setLoading(false);
        }
      });

    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null);
    });
    subscription = authSub;

    return () => {
      mounted = false;
      subscription?.unsubscribe?.();
    };
  }, [refetchAccountStatus]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        accountStatus,
        accountStatusLoading,
        accountStatusUnavailable,
        refetchAccountStatus,
        reconcileAccountStatus,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
