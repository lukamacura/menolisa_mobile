import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';
import { apiFetchWithAuth, API_CONFIG, isSubscriptionRequiredError } from '../lib/api';
import { getNativeExpoNotifications } from '../lib/expoNotificationsGate';
import { logger } from '../lib/logger';

/**
 * How many alerts she has not seen, for the badge on the Alerts tab.
 *
 * Without this the whole system is invisible: every alert we send lands in a
 * tab she has no reason to open, and the push is the only chance she ever gets
 * to notice it. The badge is what makes a missed push recoverable.
 *
 * Kept in a context rather than the screen because the two consumers are on
 * opposite sides of the tree — the tab bar draws the number, the Alerts screen
 * is what clears it.
 */

type NotificationsContextValue = {
  unreadCount: number;
  /** Re-read the count from the server. */
  refresh: () => Promise<void>;
  /** Mark everything read, server-side, and clear the badge immediately. */
  markAllSeen: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await apiFetchWithAuth(API_CONFIG.endpoints.notificationsUnreadCount);
      if (!mounted.current) return;
      setUnreadCount(typeof res?.count === 'number' ? res.count : 0);
    } catch (err) {
      // A 403 means the navigator is already moving her to the paywall, and a
      // badge is never worth surfacing an error over.
      if (!isSubscriptionRequiredError(err)) logger.warn('Failed to read unread count', err);
    }
  }, [user?.id]);

  const markAllSeen = useCallback(async () => {
    if (!user?.id) return;
    // Cleared first: she is looking at the list, so the badge is already wrong.
    setUnreadCount(0);
    try {
      await apiFetchWithAuth(API_CONFIG.endpoints.notifications, {
        method: 'PUT',
        body: JSON.stringify({ markAllRead: true }),
      });
    } catch (err) {
      if (!isSubscriptionRequiredError(err)) logger.warn('Failed to mark alerts read', err);
      // Put it back rather than leave her permanently clear of alerts she has
      // not actually read.
      refresh().catch(() => {});
    }
  }, [user?.id, refresh]);

  // Sign-in, and every return to the foreground. A push that arrived while the
  // app was closed is only visible on the badge once we ask again.
  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }
    refresh();

    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') refresh();
    });
    return () => subscription.remove();
  }, [user?.id, refresh]);

  // A push that lands while she is already in the app never wakes the AppState
  // listener, so the badge would sit stale until she backgrounded it.
  useEffect(() => {
    if (Platform.OS === 'web' || !user?.id) return;
    const Notifications = getNativeExpoNotifications();
    if (!Notifications) return;

    const sub = Notifications.addNotificationReceivedListener(() => {
      refresh().catch(() => {});
    });
    return () => sub.remove();
  }, [user?.id, refresh]);

  const value = useMemo<NotificationsContextValue>(
    () => ({ unreadCount, refresh, markAllSeen }),
    [unreadCount, refresh, markAllSeen]
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationsProvider');
  return context;
}
