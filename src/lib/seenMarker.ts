/**
 * "She has already been shown this" markers, kept per user on the device.
 *
 * Two screens in the app appear exactly once at a moment in her subscription —
 * the end-of-cycle recap and the pre-renewal screen — and both have the same
 * awkward shape: the component that *decides* to open the screen and the
 * component that *dismisses* it are different components. Two independent
 * `useState` copies would leave the opener still saying "yes, show it" after
 * the screen had been dismissed, and send her straight back into it, forever.
 *
 * So the marker lives in a module-level store that every caller shares, and the
 * hook subscribes to it. Writes land in memory first and reach AsyncStorage
 * afterwards: the navigator pops back to the deciding screen immediately, and
 * that decision cannot be left waiting on a disk write.
 *
 * Markers are stored on the device rather than the server on purpose. The worst
 * failure is that a reinstall shows her one warm screen a second time, which is
 * not worth a column, an endpoint and an acknowledgement round trip.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

/** storageKey → stored value. An empty string means "read, and nothing was set". */
const cache = new Map<string, string>();
const listeners = new Set<() => void>();
/** Keys with a read in flight, so five screens mounting at once make one read. */
const reading = new Set<string>();

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const emit = () => listeners.forEach((fn) => fn());

export type SeenMarker = {
  /** What was stored, or null when nothing was — and while it is still loading. */
  value: string | null;
  /** False until the read has finished. Nothing may render a once-only screen before this. */
  loaded: boolean;
  save: (value: string) => void;
};

/**
 * Read and write one marker. Pass null for the key — usually because there is
 * no signed-in user yet — and the hook stays inert and unloaded.
 *
 * Keys are namespaced by user id by the caller, which is what makes signing
 * into a second account on the same device read that account's own marker
 * rather than inherit the first one's.
 */
export function useSeenMarker(key: string | null): SeenMarker {
  const raw = useSyncExternalStore(subscribe, () => (key ? cache.get(key) ?? null : null));

  useEffect(() => {
    if (!key || cache.has(key) || reading.has(key)) return;
    reading.add(key);
    AsyncStorage.getItem(key)
      .then((value) => cache.set(key, value ?? ''))
      .catch((err) => {
        // Unreadable storage counts as "nothing seen" rather than "everything
        // seen": showing a screen twice is a small cost, never showing it is
        // the whole feature missing.
        logger.error('Could not read a seen marker', err);
        cache.set(key, '');
      })
      .finally(() => {
        reading.delete(key);
        emit();
      });
  }, [key]);

  const save = useCallback(
    (value: string) => {
      if (!key) return;
      cache.set(key, value);
      emit();
      AsyncStorage.setItem(key, value).catch((err) =>
        // A marker that failed to persist means she may see the screen once
        // more on the next cold start. Not worth surfacing to her.
        logger.error('Could not save a seen marker', err)
      );
    },
    [key]
  );

  return { value: raw ? raw : null, loaded: key !== null && raw !== null, save };
}
