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

const PRODUCTION_API_URL = 'https://menolisa.com';

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
    symptoms: '/api/symptoms',
    chatSessions: '/api/chat-sessions',
    chat: '/api/langchain-rag',
    intake: '/api/intake',
    notifications: '/api/notifications',
    notificationsUnreadCount: '/api/notifications/unread-count',
    notificationsPreferences: '/api/notifications/preferences',
    notificationsPushToken: '/api/notifications/push-token',
    userPreferences: '/api/user-preferences',
    trackerInsights: '/api/tracker-insights',
    insights: '/api/insights',
    dailyMood: '/api/daily-mood',
    goodDays: '/api/good-days',
    healthSummary: '/api/health-summary',
    doctorReport: '/api/doctor-report',
    accountDelete: '/api/account/delete',
    referralCode: '/api/referral/code',
    referralDiscountEligible: '/api/referral/discount-eligible',
  },
};

/**
 * Helper function for API calls with error handling
 */
export const apiFetch = async (
  endpoint: string,
  options?: RequestInit
): Promise<any> => {
  const url = `${API_CONFIG.baseURL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error: Failed to fetch');
  }
};

/**
 * Helper to get full API URL (for backend API calls; may be local in dev).
 */
export const getApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.baseURL}${endpoint}`;
};

/**
 * URL for opening a web app page in the browser. Always uses menolisa.com so links
 * (dashboard, terms, privacy, forgot-password) open the real site even when testing on same WiFi.
 */
export function getWebAppUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${WEB_APP_BASE_URL}${normalized}`;
}

/** Open the MenoLisa web dashboard where users can manage subscription and billing. */
export async function openWebDashboard(): Promise<void> {
  const url = getWebAppUrl('/dashboard');
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) throw new Error('Cannot open dashboard URL');
  await Linking.openURL(url);
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
    const err = new Error('Not authenticated');
    (err as Error & { status?: number }).status = 401;
    throw err;
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
    const err = new Error('Session expired or unauthorized');
    (err as Error & { status?: number }).status = 401;
    throw err;
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({
      error: `HTTP ${response.status}: ${response.statusText}`,
    }));
    throw new Error(errorBody.error || `HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }
  return response.text();
};

/** Permanently delete the current user's account and all data. Call after confirmation. */
export async function deleteAccount(): Promise<void> {
  await apiFetchWithAuth(API_CONFIG.endpoints.accountDelete, {
    method: 'POST',
  });
}
