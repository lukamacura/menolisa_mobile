import { apiFetchWithAuth, API_CONFIG } from './api';
import { getNativeExpoNotifications } from './expoNotificationsGate';
import { logger } from './logger';

/**
 * How long the Expo push service gets to answer before we give up on it.
 *
 * `getExpoPushTokenAsync()` does a network round trip and carries no timeout of
 * its own, so without this it can hang for as long as the socket stays open.
 * That matters because sign-out awaits it: an unreachable push service was able
 * to leave the Log out button doing nothing at all.
 */
const PUSH_TOKEN_TIMEOUT_MS = 5_000;

/**
 * And how long the unregister call itself gets.
 *
 * Deliberately far below the 20s default: sign-out waits on this, and a woman
 * tapping Log out should not watch a dead button while a best-effort cleanup
 * exhausts a timeout meant for requests she is actually waiting on. If it does
 * not make it, the device may keep receiving pushes — logged, and a much better
 * outcome than appearing not to log out at all.
 */
const PUSH_UNREGISTER_TIMEOUT_MS = 6_000;

/** Resolves to `fallback` if `promise` has not settled in time. Never rejects. */
async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.catch(() => fallback),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * The device's Expo push token, or `null` when the native module can't be loaded
 * (Expo Go on Android, web), the token can't be read, or the push service does
 * not answer in time.
 */
async function getDevicePushToken(): Promise<string | null> {
  const Notifications = getNativeExpoNotifications();
  if (!Notifications) return null;
  return withTimeout(
    (async () => (await Notifications.getExpoPushTokenAsync())?.data ?? null)(),
    PUSH_TOKEN_TIMEOUT_MS,
    null
  );
}

/** Bind this device's push token to the signed-in account. */
export async function registerPushToken(token: string): Promise<void> {
  await apiFetchWithAuth(API_CONFIG.endpoints.notificationsPushToken, {
    method: 'PUT',
    body: JSON.stringify({ token }),
  });
}

/**
 * Unbind this device's push token so the account stops pushing to it. Must run
 * *before* `supabase.auth.signOut()` — the call needs the still-valid Bearer token.
 * Never throws: a failed unregister must not block signing out.
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await getDevicePushToken();
    // No token readable — clear every token on the account rather than leaving
    // this device subscribed under a stale row.
    await apiFetchWithAuth(API_CONFIG.endpoints.notificationsPushToken, {
      method: 'DELETE',
      body: JSON.stringify(token ? { token } : {}),
      timeoutMs: PUSH_UNREGISTER_TIMEOUT_MS,
    });
  } catch (err) {
    logger.warn('unregisterPushToken failed — device may keep receiving pushes', err);
  }
}

export { getDevicePushToken };
