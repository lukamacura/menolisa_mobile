/**
 * API Configuration for Mobile App
 *
 * This file handles API calls to your Next.js backend.
 * - Production: set EXPO_PUBLIC_API_URL to your deployed API (e.g. https://yourapp.com).
 * - Dev: if unset, Android emulator uses 10.0.2.2:3000; iOS simulator and web use localhost:3000.
 * - Physical device: set EXPO_PUBLIC_API_URL to your computer's IP (e.g. http://192.168.1.5:3000).
 */

import { Linking, Platform } from 'react-native';
import { supabase } from './supabase';

const PRODUCTION_API_URL = 'https://www.menolisa.com';

/** Canonical access check. Never gated, so it must never trigger the 403 handler below. */
export const ACCOUNT_STATUS_ENDPOINT = '/api/account/status';

/** An error from the backend, carrying the HTTP status so callers can branch on it. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** True when the backend denied access for lack of a subscription — route to the paywall. */
export function isSubscriptionRequiredError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403;
}

/**
 * Called whenever a gated route answers 403. AuthContext registers a status refetch
 * here, so losing access anywhere re-syncs the navigator and lands the user on the
 * paywall instead of leaving a screen showing a bare error.
 */
let subscriptionRequiredHandler: (() => void) | null = null;

export function setSubscriptionRequiredHandler(handler: (() => void) | null): void {
  subscriptionRequiredHandler = handler;
}

/** Base URL for opening web app pages in the browser (dashboard, terms, privacy, etc.). Always production. */
export const WEB_APP_BASE_URL = PRODUCTION_API_URL;

function getDefaultApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (__DEV__) {
    // Android emulator: host machine is 10.0.2.2 (localhost is the emulator itself)
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:3000';
    }
    // iOS simulator and Expo Web: same machine as dev server
    return 'http://localhost:3000';
  }
  // Production fallback so the app never crashes if EAS secret is missing
  return PRODUCTION_API_URL;
}

const API_BASE_URL = getDefaultApiBaseUrl();

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  endpoints: {
    symptomLogs: '/api/symptom-logs',
    symptomLogsDelete: '/api/symptom-logs/delete',
    symptoms: '/api/symptoms',
    chatSessions: '/api/chat-sessions',
    chat: '/api/langchain-rag',
    /** Save 8-step funnel quiz. Body: { quiz: { age_band, here_for, goals, symptoms, what_tried, how_long, qualifier, name } }. Backend upserts user_profiles. */
    intake: '/api/intake',
    saveQuiz: '/api/intake',
    /** Same as web gate: creates profile + user_trials. Body: { quizAnswers } only — the user id comes from the Bearer token. */
    saveQuizAuth: '/api/auth/save-quiz',
    notifications: '/api/notifications',
    notificationsUnreadCount: '/api/notifications/unread-count',
    notificationsPreferences: '/api/notifications/preferences',
    notificationsPushToken: '/api/notifications/push-token',
    userPreferences: '/api/user-preferences',
    goodDays: '/api/good-days',
    healthSummary: '/api/health-summary',
    doctorReport: '/api/doctor-report',
    accountDelete: '/api/account/delete',
    /** The generated 8-week plan, hydrated and scored for one day. Send `?date=&media=1`. */
    plan: '/api/plan',
    /** Tick a plan task, a nutrition row, or one of her habits. `count` replaces the day's total. */
    planComplete: '/api/plan/complete',
    /** POST to create one of her own habits, DELETE `?id=` to remove it. */
    planHabits: '/api/plan/habits',
    /** XP, level, streak and every achievement, derived from her logs. Send `?date=`. Read-only. */
    rewards: '/api/rewards',
  },
};

/**
 * Helper to get full API URL (for backend API calls; may be local in dev).
 */
export const getApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.baseURL}${endpoint}`;
};

/**
 * URL for opening a web app page in the browser. Always uses menolisa.com so links
 * (dashboard, terms, privacy, forgot-password) open the real site (www.menolisa.com) even when testing on same WiFi.
 */
export function getWebAppUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${WEB_APP_BASE_URL}${normalized}`;
}

/**
 * Open the web Account page (plan, trial, subscription, billing).
 * When the user is signed in on the device, requests a short-lived handoff from the production
 * web API so the browser gets a Supabase cookie session without typing email again.
 */
export async function openWebAccount(webPath: string = '/dashboard/account'): Promise<void> {
  const fallbackUrl = getWebAppUrl(webPath);
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token || !session.refresh_token) {
    const canOpen = await Linking.canOpenURL(fallbackUrl);
    if (!canOpen) throw new Error('Cannot open account URL');
    await Linking.openURL(fallbackUrl);
    return;
  }

  const handoffRequestUrl = `${WEB_APP_BASE_URL}/api/auth/mobile-web-handoff`;
  try {
    const res = await fetch(handoffRequestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });

    if (!res.ok) {
      const canOpen = await Linking.canOpenURL(fallbackUrl);
      if (!canOpen) throw new Error('Cannot open account URL');
      await Linking.openURL(fallbackUrl);
      return;
    }

    const data = (await res.json()) as { token?: string };
    if (typeof data.token !== 'string' || !data.token) {
      const canOpen = await Linking.canOpenURL(fallbackUrl);
      if (!canOpen) throw new Error('Cannot open account URL');
      await Linking.openURL(fallbackUrl);
      return;
    }

    const bridgeUrl = `${WEB_APP_BASE_URL}/auth/mobile-bridge#${encodeURIComponent(data.token)}`;
    const canOpenBridge = await Linking.canOpenURL(bridgeUrl);
    if (!canOpenBridge) throw new Error('Cannot open account URL');
    await Linking.openURL(bridgeUrl);
  } catch {
    const canOpen = await Linking.canOpenURL(fallbackUrl);
    if (!canOpen) throw new Error('Cannot open account URL');
    await Linking.openURL(fallbackUrl);
  }
}

/**
 * Account/billing entry point — same on iOS, Android, and web.
 * Stripe (web) is the only payment path; IAP has been removed.
 */
export async function openAccountBillingEntry(webPath: string = '/dashboard/account'): Promise<void> {
  await openWebAccount(webPath);
}

/**
 * Authenticated API fetch: adds Bearer token from Supabase session.
 * Use for all backend calls from mobile. On 401, caller may need to refresh or redirect to login.
 */
export const apiFetchWithAuth = async (
  endpoint: string,
  options?: RequestInit
): Promise<any> => {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new ApiError('Not authenticated', 401);
  }

  const url = `${API_CONFIG.baseURL}${endpoint}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
    ...(options?.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    throw new ApiError('Session expired or unauthorized', 401);
  }

  if (!response.ok) {
    // Always carry the status. Callers must branch on it — notably 403, which
    // means "no subscription, show the paywall", not "something went wrong".
    // The 403 copy is not stable; the status code is.
    const errorBody = await response.json().catch(() => ({
      error: `HTTP ${response.status}: ${response.statusText}`,
    }));

    // Access was revoked mid-session (ended, refunded, disputed). Re-sync so the
    // navigator moves her to the paywall. Skipped for the status endpoint itself,
    // which is never gated — refetching on it would recurse.
    if (response.status === 403 && endpoint !== ACCOUNT_STATUS_ENDPOINT) {
      subscriptionRequiredHandler?.();
    }

    throw new ApiError(errorBody.error || `HTTP ${response.status}`, response.status);
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return {};
  }
  if (isJson) {
    return response.json().catch(() => ({}));
  }
  return response.text();
};

/** Delete one symptom log by id. Uses POST /api/symptom-logs/delete with body { id } for reliability. */
export async function deleteSymptomLog(logId: string): Promise<void> {
  await apiFetchWithAuth(API_CONFIG.endpoints.symptomLogsDelete, {
    method: 'POST',
    body: JSON.stringify({ id: logId }),
  });
}

/** Permanently delete the current user's account and all data. Call after confirmation. */
export async function deleteAccount(): Promise<void> {
  await apiFetchWithAuth(API_CONFIG.endpoints.accountDelete, {
    method: 'POST',
  });
}
