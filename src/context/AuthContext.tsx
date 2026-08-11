import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { setSubscriptionRequiredHandler } from '../lib/api';
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
  refetchAccountStatus: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [accountStatusLoading, setAccountStatusLoading] = useState(false);
  const userRef = useRef<User | null>(null);

  const refetchAccountStatus = useCallback(async () => {
    if (!userRef.current) {
      setAccountStatus(null);
      return;
    }
    setAccountStatusLoading(true);
    try {
      const status = await fetchAccountStatus();
      setAccountStatus(status);
    } catch (err) {
      logger.warn('refetchAccountStatus failed — failing closed to expired', err);
      // Never leave accountStatus null after an authed fetch attempt — that hangs the navigator.
      // Fail-closed: route the user to SubscriptionRequiredScreen where they can retry or sign out.
      setAccountStatus(DENIED_ACCOUNT_STATUS);
    } finally {
      setAccountStatusLoading(false);
    }
  }, []);

  // Any gated route answering 403 means access ended mid-session. Re-read status so
  // AppNavigator moves her to the paywall instead of a screen stuck on an error.
  useEffect(() => {
    setSubscriptionRequiredHandler(() => {
      if (userRef.current) refetchAccountStatus();
    });
    return () => setSubscriptionRequiredHandler(null);
  }, [refetchAccountStatus]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    userRef.current = null;
    setAccountStatus(null);
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
        // New session — fetch status
        refetchAccountStatus();
      } else if (!nextId) {
        setAccountStatus(null);
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
        refetchAccountStatus,
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
