import { apiFetchWithAuth } from './api';
import { logger } from './logger';

export type AccountStatusValue = 'trial' | 'paid' | 'pending_payment' | 'expired';

export type AccountStatus = {
  expired: boolean;
  account_status: AccountStatusValue;
  subscription_ends_at: string | null;
  trial_end: string | null;
};

const STATUS_ENDPOINT = '/api/account/status';
const FALLBACK_GATED_ENDPOINT = '/api/notifications/unread-count';
const STATUS_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      (err as Error & { code?: string }).code = 'TIMEOUT';
      reject(err);
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Fetch the canonical account/subscription status from the web API.
 * The web API runs the same checkTrialExpired() rules used by every gated
 * route, so this is the single source of truth for whether the user can
 * access the dashboard.
 *
 * If /api/account/status is not yet deployed (404), we fall back to probing
 * a known gated endpoint and infer expiry from a 403 response.
 */
export async function fetchAccountStatus(): Promise<AccountStatus> {
  try {
    const data = await withTimeout(
      apiFetchWithAuth(STATUS_ENDPOINT, { method: 'GET' }),
      STATUS_TIMEOUT_MS,
      'fetchAccountStatus',
    );
    if (data && typeof data === 'object' && 'account_status' in data) {
      return data as AccountStatus;
    }
    return inferFromGatedEndpoint();
  } catch (err) {
    const status = (err as { status?: number })?.status;
    const message = err instanceof Error ? err.message : '';
    if (status === 404 || /not found/i.test(message)) {
      return inferFromGatedEndpoint();
    }
    logger.warn('fetchAccountStatus failed:', err);
    throw err;
  }
}

async function inferFromGatedEndpoint(): Promise<AccountStatus> {
  try {
    await withTimeout(
      apiFetchWithAuth(FALLBACK_GATED_ENDPOINT, { method: 'GET' }),
      STATUS_TIMEOUT_MS,
      'inferFromGatedEndpoint',
    );
    return {
      expired: false,
      account_status: 'paid',
      subscription_ends_at: null,
      trial_end: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (/trial expired|expired/i.test(message)) {
      return {
        expired: true,
        account_status: 'expired',
        subscription_ends_at: null,
        trial_end: null,
      };
    }
    throw err;
  }
}
