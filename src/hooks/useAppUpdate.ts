/**
 * Whether this build is out of date, shared by everything that asks.
 *
 * Two surfaces consume it — the blocking gate in `AppNavigator` and the
 * dismissible card on the daily loop — so the answer lives in a module-level
 * store rather than in either component. One check per launch, one more each
 * time she comes back to a session that has been backgrounded long enough for
 * a release to have happened in the meantime.
 *
 * The store keeps whatever it last heard. A failed re-check leaves the previous
 * answer standing rather than dropping back to "unknown": a blocked build that
 * un-blocks itself the moment the wifi wobbles is not a block.
 */

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useSeenMarker } from '../lib/seenMarker';
import { logger } from '../lib/logger';
import {
  fetchAppVersionInfo,
  openStoreListing,
  requirementFor,
  RUNNING_APP_VERSION,
  type AppVersionInfo,
  type UpdateRequirement,
} from '../lib/appVersion';

/** How old an answer may get before a foreground return is worth a re-check. */
const STALE_AFTER_MS = 30 * 60 * 1000;

let cached: AppVersionInfo | null = null;
let checkedAt = 0;
let inflight: Promise<void> | null = null;

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const emit = () => listeners.forEach((fn) => fn());
const snapshot = () => cached;

function load(force: boolean): Promise<void> {
  if (inflight) return inflight;
  if (!force && cached && Date.now() - checkedAt < STALE_AFTER_MS) {
    return Promise.resolve();
  }

  inflight = fetchAppVersionInfo()
    .then((info) => {
      cached = info;
      checkedAt = Date.now();
      emit();
    })
    .catch((err) => {
      // Fail open, and quietly. She has no action to take about a version check
      // that could not reach the server, so there is nothing to tell her.
      logger.warn('Version check failed', err);
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export type AppUpdate = {
  requirement: UpdateRequirement;
  /** The newest version the server knows about, once it has answered. */
  latest: string | null;
  /** What this build is running. Null when it cannot be read — no gate applies. */
  running: string | null;
  /** Open this platform's store listing. */
  openStore: () => void;
  /** Ask again now. The escape hatch on the blocking screen. */
  recheck: () => void;
};

export function useAppUpdate(): AppUpdate {
  const info = useSyncExternalStore(subscribe, snapshot);

  useEffect(() => {
    load(false);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load(false);
    });
    return () => sub.remove();
  }, []);

  const requirement = useMemo(
    () => requirementFor(RUNNING_APP_VERSION, info),
    [info]
  );

  const openStore = useCallback(() => {
    if (!info) return;
    openStoreListing(info).catch((err) => logger.warn('Open store failed', err));
  }, [info]);

  const recheck = useCallback(() => {
    load(true);
  }, []);

  return {
    requirement,
    latest: info?.latest ?? null,
    running: RUNNING_APP_VERSION,
    openStore,
    recheck,
  };
}

/**
 * Per-device, per-version. Dismissing the nudge for 1.4.0 silences 1.4.0 and
 * nothing else — 1.4.1 asks again. Not scoped by user, because the thing being
 * dismissed is a property of the install rather than of the account.
 */
const NUDGE_DISMISSED_KEY = '@menolisa:update_nudge_dismissed';

export type UpdateNudge = {
  /** True only for an optional update she has not already waved away. */
  visible: boolean;
  latest: string | null;
  openStore: () => void;
  dismiss: () => void;
};

/**
 * The soft nudge, ready to render. Kept separate from `useAppUpdate` so the
 * blocking gate never has to think about a dismissal marker — there is no
 * dismissing a required update.
 */
export function useUpdateNudge(): UpdateNudge {
  const { requirement, latest, openStore } = useAppUpdate();
  const { value: dismissedVersion, loaded, save } = useSeenMarker(NUDGE_DISMISSED_KEY);

  const dismiss = useCallback(() => {
    if (latest) save(latest);
  }, [latest, save]);

  return {
    visible:
      requirement === 'optional' && loaded && !!latest && dismissedVersion !== latest,
    latest,
    openStore,
    dismiss,
  };
}
