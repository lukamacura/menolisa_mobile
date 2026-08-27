import { useEffect, useRef, useState, useCallback } from 'react';
import { getNativeExpoNotifications } from '../lib/expoNotificationsGate';
import { getDevicePushToken, registerPushToken } from '../lib/pushToken';

const NOTIFICATION_PROMPT_SHOWN_KEY = 'notification_prompt_shown';

export type NotificationPermissionStatus = 'undetermined' | 'granted' | 'denied';

/**
 * Registers the current Expo push token with the backend when permission is granted.
 * Does not request permission by default; use requestPermissionAndRegister() after
 * the user has seen a pre-prompt (e.g. NotificationPromptModal).
 */
export function useRegisterPushToken(userId: string | undefined): {
  permissionStatus: NotificationPermissionStatus;
  requestPermissionAndRegister: () => Promise<void>;
  refreshPermissionStatus: () => Promise<void>;
} {
  const lastTokenRef = useRef<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionStatus>('undetermined');

  const fetchAndRegisterToken = useCallback(async () => {
    const token = await getDevicePushToken();
    if (!token) return;
    if (lastTokenRef.current === token) return;
    lastTokenRef.current = token;
    await registerPushToken(token);
  }, []);

  /**
   * Re-read the OS setting and register if it has become `granted`.
   *
   * Called on the way back from system settings, where she may have turned
   * notifications on outside the app entirely — without this the app keeps
   * showing the "blocked" banner over a permission that is no longer blocked.
   */
  const refreshPermissionStatus = useCallback(async () => {
    const Notifications = getNativeExpoNotifications();
    if (!Notifications) return;
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setPermissionStatus(toStatus(status));
      if (status === 'granted' && userId) await fetchAndRegisterToken();
    } catch {
      // Leave the last known answer standing rather than guess at a worse one.
    }
  }, [userId, fetchAndRegisterToken]);

  const requestPermissionAndRegister = useCallback(async () => {
    if (!userId) return;
    const Notifications = getNativeExpoNotifications();
    if (!Notifications) return;
    try {
      const { status: requested } = await Notifications.requestPermissionsAsync();
      setPermissionStatus(toStatus(requested));
      if (requested === 'granted') {
        await fetchAndRegisterToken();
      }
    } catch {
      setPermissionStatus('denied');
    }
  }, [userId, fetchAndRegisterToken]);

  useEffect(() => {
    if (!userId) {
      setPermissionStatus('undetermined');
      return;
    }

    const Notifications = getNativeExpoNotifications();
    if (!Notifications) {
      return;
    }

    let subscription: { remove: () => void } | null = null;

    const run = async () => {
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        const status = toStatus(existing);
        setPermissionStatus(status);

        if (status === 'granted') {
          await fetchAndRegisterToken();
        }
      } catch {
        setPermissionStatus('undetermined');
      }
    };

    run();

    subscription = Notifications.addPushTokenListener((e: { data: string }) => {
      const t = e.data;
      if (typeof t === 'string' && t !== lastTokenRef.current) {
        lastTokenRef.current = t;
        registerPushToken(t).catch(() => {});
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [userId, fetchAndRegisterToken]);

  return {
    permissionStatus,
    requestPermissionAndRegister,
    refreshPermissionStatus,
  };
}

/** Everything that is not an explicit yes or no is still an open question. */
function toStatus(status: string): NotificationPermissionStatus {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export { NOTIFICATION_PROMPT_SHOWN_KEY };
