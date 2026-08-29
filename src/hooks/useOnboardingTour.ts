/**
 * Whether she still owes herself the welcome tour, and the bookkeeping that
 * keeps it to exactly once.
 *
 * She bought on the web and arrives here already paid for, so the tour is not a
 * pitch — it is the handover. Four cards that say what the app is for before
 * she is dropped into a plan she did not watch being built.
 *
 * Two things gate it:
 *
 * - **Consent.** `MedicalDisclaimerModal` is rendered by `AppNavigator` above
 *   the navigator and this sits inside it, so without the gate a first launch
 *   opens the disclaimer on top of a tour she can see but not read. Same
 *   reasoning as the push pre-prompt — see `ConsentContext`.
 * - **The marker having loaded.** `pending` is false while the read is in
 *   flight, so the tour can never flash at a woman who finished it last week.
 *
 * The marker is per user and lives on the device (`lib/seenMarker.ts`). One
 * consequence worth naming: a woman already six weeks into her plan when this
 * ships has no marker either, so she is shown the tour once as well. That is
 * the honest cost of not spending a column and an endpoint on it, and one warm
 * screen re-introducing an app she is mid-way through is a small thing to be
 * wrong about.
 *
 * And it gates in turn: the push pre-prompt and the once-only plan screens both
 * wait on `settled` below, so the first launch runs disclaimer, then tour, then
 * anything else that wants her attention — in that order, one at a time.
 *
 * Bump `VERSION` only to deliberately show everyone a rewritten tour again.
 */

import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMedicalConsentAccepted } from '../context/ConsentContext';
import { useSeenMarker } from '../lib/seenMarker';

const VERSION = 'v1';

export type OnboardingTourState = {
  /** True only when the tour is owed to her right now. */
  pending: boolean;
  /**
   * True once the tour is behind her — seen on a previous launch, or finished
   * just now. Gate anything of your own that would interrupt her on this rather
   * than on `!pending`: `pending` is also false while the marker is still being
   * read, and treating that gap as "the tour is done" is how a modal ends up on
   * top of it. Same shape as `disclaimerAccepted === true` in `AppNavigator`.
   */
  settled: boolean;
  /** Call when she has finished or skipped it. Idempotent. */
  markSeen: () => void;
};

export function useOnboardingTour(): OnboardingTourState {
  const { user } = useAuth();
  const consentAccepted = useMedicalConsentAccepted();

  const { value, loaded, save } = useSeenMarker(
    user?.id ? `onboarding.seen.${VERSION}.${user.id}` : null
  );

  const markSeen = useCallback(() => save('1'), [save]);

  return {
    pending: consentAccepted && loaded && !value,
    settled: consentAccepted && loaded && !!value,
    markSeen,
  };
}
