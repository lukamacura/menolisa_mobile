/**
 * "Is this build still the one we support?"
 *
 * A shipped binary cannot know a newer one exists, so the answer has to come
 * from the server: `GET /api/app-version` (public, unauthenticated) returns the
 * version below which the app blocks and the version below which it nudges.
 * See `app/api/app-version/route.ts` on the web app for the contract.
 *
 * Everything here is deliberately fail-open. A version check that cannot reach
 * the server, or that cannot read its own version, must land on "carry on" —
 * the cost of missing one update prompt is one stale install, and the cost of
 * getting it wrong the other way is a paying subscriber locked out of her plan
 * by a flaky connection.
 */

import * as Application from 'expo-application';
import { Linking, Platform } from 'react-native';
import { API_CONFIG } from './api';
import { logger } from './logger';

export const APP_VERSION_ENDPOINT = '/api/app-version';

/** How long to wait on the check before giving up and carrying on. */
const VERSION_TIMEOUT_MS = 8_000;

export type AppVersionInfo = {
  /** Below this, the app blocks. */
  minimum: string;
  /** Below this, the app nudges. Never behind `minimum` — the server guarantees it. */
  latest: string;
  iosUrl: string;
  androidUrl: string;
};

/**
 * - `unknown` — not checked yet, or the check failed. Show nothing.
 * - `ok` — running `latest` or newer.
 * - `optional` — newer build available. Dismissible nudge.
 * - `required` — below `minimum`. Blocking screen, no way past it.
 */
export type UpdateRequirement = 'unknown' | 'ok' | 'optional' | 'required';

/**
 * The version the store actually installed — `CFBundleShortVersionString` on
 * iOS, `versionName` on Android. Read from the native bundle rather than from
 * `Constants.expoConfig`, which reports the config that was embedded at build
 * time and can drift from what the store is serving.
 *
 * Null on web, and on any platform that cannot answer. Null means "unknown",
 * which means no gate.
 */
export const RUNNING_APP_VERSION: string | null =
  Platform.OS === 'web' ? null : Application.nativeApplicationVersion;

/** Numeric segment compare. Missing segments count as 0, so "1.4" === "1.4.0". */
export function compareVersions(a: string, b: string): number {
  const segments = (value: string): number[] =>
    value.split('.').map((part) => {
      const parsed = Number.parseInt(part, 10);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    });

  const left = segments(a);
  const right = segments(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

/** What this build should do about the versions the server just named. */
export function requirementFor(
  running: string | null,
  info: AppVersionInfo | null
): UpdateRequirement {
  if (!running || !info) return 'unknown';
  if (compareVersions(running, info.minimum) < 0) return 'required';
  if (compareVersions(running, info.latest) < 0) return 'optional';
  return 'ok';
}

function isVersionString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{1,5}(\.\d{1,5}){0,2}$/.test(value.trim());
}

/**
 * Ask the server what it supports. Throws on anything it cannot make sense of —
 * callers treat a throw as "unknown" and show nothing.
 *
 * Uses a bare `fetch` rather than `apiFetchWithAuth`: the route is not gated,
 * and it has to answer a signed-out or expired client too. Going through the
 * authenticated helper would make the one check that must always work depend on
 * a Supabase session being present.
 */
export async function fetchAppVersionInfo(): Promise<AppVersionInfo> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERSION_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_CONFIG.baseURL}${APP_VERSION_ENDPOINT}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`app-version responded ${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  if (!isVersionString(data.minimum) || !isVersionString(data.latest)) {
    throw new Error('app-version returned an unusable payload');
  }

  return {
    minimum: data.minimum.trim(),
    latest: data.latest.trim(),
    iosUrl: typeof data.ios_url === 'string' ? data.ios_url : '',
    androidUrl: typeof data.android_url === 'string' ? data.android_url : '',
  };
}

/**
 * The store links to try, best first.
 *
 * The native schemes open the store app directly, where the https links go
 * through the browser first. Both are tried because `market://` needs a
 * `<queries>` entry to be visible on Android 11+ and `itms-apps://` is
 * unavailable on a simulator — in either case the https link still lands on the
 * right listing, just with a redirect on the way.
 */
function storeCandidates(info: AppVersionInfo): string[] {
  if (Platform.OS === 'ios') {
    const web = info.iosUrl;
    if (!web) return [];
    return [web.replace(/^https:\/\//, 'itms-apps://'), web];
  }

  if (Platform.OS === 'android') {
    const web = info.androidUrl;
    if (!web) return [];
    const packageName = /[?&]id=([^&]+)/.exec(web)?.[1];
    return packageName ? [`market://details?id=${packageName}`, web] : [web];
  }

  return [info.iosUrl || info.androidUrl].filter(Boolean);
}

/**
 * Open the store listing for this platform.
 *
 * Tries each candidate with `openURL` rather than asking `canOpenURL` first:
 * `canOpenURL` answers false for a scheme the manifest has not declared even
 * when the store app is installed and would have handled it perfectly well.
 */
export async function openStoreListing(info: AppVersionInfo): Promise<void> {
  for (const url of storeCandidates(info)) {
    try {
      await Linking.openURL(url);
      return;
    } catch (err) {
      logger.warn('Could not open store listing', url, err);
    }
  }
}
