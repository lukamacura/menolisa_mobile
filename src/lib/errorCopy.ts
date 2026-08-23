import { ApiError, ApiTimeoutError } from './api';

/**
 * Turning a thrown error into something she should actually be shown.
 *
 * Screens used to render `e.message` straight into a banner or an Alert. That
 * message is written for a log file, not for her: `ApiTimeoutError` says
 * "Request to /api/symptoms timed out after 20000ms", and `apiFetchWithAuth`
 * falls back to `HTTP 500` whenever the server sends no error body. Twenty call
 * sites did this, so any of them could put a status code in front of someone
 * who came here to log a hot flush.
 *
 * The rule: say what happened and what she can do about it. Keep the server's
 * own text only where the server is talking to her rather than to us — a 400
 * saying "Symptom name is required" is more useful than anything generic we
 * could substitute for it.
 */

/** `HTTP 500`, `HTTP 502` — the placeholder from a response with no error body. */
const BARE_STATUS = /^HTTP \d{3}$/;

/**
 * The request never reached anyone. Matches what React Native, the fetch
 * polyfill and Android's cleartext blocker each call this, since none of them
 * agree on the wording.
 */
const NETWORK_PATTERN =
  /failed to fetch|network request failed|network error|load failed|cleartext|connection/i;

export function isNetworkError(err: unknown): boolean {
  if (err instanceof ApiTimeoutError) return true;
  const message = err instanceof Error ? err.message : String(err);
  return NETWORK_PATTERN.test(message);
}

/**
 * Human copy for a failed request.
 *
 * `fallback` is what to say when nothing more specific applies — pass something
 * that names the action that failed ("We could not load your symptoms."), not a
 * bare "Error".
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiTimeoutError) {
    return 'That is taking longer than it should. Check your connection and try again.';
  }

  if (isNetworkError(err)) {
    return 'No connection. Check your signal and try again — nothing you have saved is lost.';
  }

  if (err instanceof ApiError) {
    if (err.status === 401) return 'Your session has expired. Please sign in again.';
    if (err.status === 403) return 'Your subscription does not cover this yet.';
    if (err.status === 429) return 'That was a lot at once. Give it a moment and try again.';
    if (err.status >= 500) return 'Something went wrong on our side. Please try again in a moment.';
    // A 4xx below 500: the server wrote this for her, so let it speak — unless
    // it is the bare-status placeholder, which says nothing.
    if (err.message && !BARE_STATUS.test(err.message)) return err.message;
    return fallback;
  }

  return fallback;
}
