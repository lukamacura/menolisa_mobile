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

  /**
   * Read the device token and bind it to the account, once per distinct token.
   *
   * The ref is only stamped **after** the PUT succeeds, and that ordering is the
   * whole point of it. Stamping first turned one failed request into permanent
   * silence: the guard below then matched on every later attempt — the return
   * from system settings, the next foreground, the push-token listener — so a
   * single offline moment during sign-in meant the server never learned the
   * token, and nothing it sends (the weekly summary, and every alert about her
   * card) could reach the phone until the app was killed and relaunched.
   */
  const fetchAndRegisterToken = useCallback(async () => {
    const token = await getDevicePushToken();
    if (!token) return;
    if (lastTokenRef.current === token) return;
    await registerPushToken(token);
    lastTokenRef.current = token;
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
    // A different account (or none) on this phone means the binding this ref
    // stands for no longer exists — sign-out deletes it server-side. Without
    // this the guard in `fetchAndRegisterToken` would recognise the token and
    // skip the PUT, leaving the new session with no push route at all.
    lastTokenRef.current = null;

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

    // A rotated token. Same rule as above — only remember it once the server has
    // it, or a failure here strands the account on the token it replaced.
    subscription = Notifications.addPushTokenListener((e: { data: string }) => {
      const t = e.data;
      if (typeof t === 'string' && t !== lastTokenRef.current) {
        registerPushToken(t)
          .then(() => {
            lastTokenRef.current = t;
          })
          .catch(() => {});
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
