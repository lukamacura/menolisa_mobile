import React, { createContext, useRef, type RefObject } from 'react';

/**
 * Ref used to trigger a trial/subscription refetch after the user returns from the web dashboard.
 * Set by a component that uses useTrialStatus (e.g. Dashboard, Settings); called by the deep link handler (e.g. menolisa://settings).
 */
export type RefetchTrialRef = RefObject<(() => Promise<void>) | null>;

export const RefetchTrialContext = createContext<RefetchTrialRef | null>(null);
