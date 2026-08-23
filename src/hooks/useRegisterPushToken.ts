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

  const requestPermissionAndRegister = useCallback(async () => {
    if (!userId) return;
    const Notifications = getNativeExpoNotifications();
    if (!Notifications) return;
    try {
      const { status: requested } = await Notifications.requestPermissionsAsync();
      setPermissionStatus(requested === 'granted' ? 'granted' : requested === 'denied' ? 'denied' : 'undetermined');
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
        const status: NotificationPermissionStatus =
          existing === 'granted' ? 'granted' : existing === 'denied' ? 'denied' : 'undetermined';
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
  };
}

export { NOTIFICATION_PROMPT_SHOWN_KEY };
