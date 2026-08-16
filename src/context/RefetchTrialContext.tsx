import { createContext, type RefObject } from 'react';

/**
 * Ref used to re-check subscription access after the user returns from the web.
 * Set by AppNavigator from AuthContext's refetch; called by the deep link handler
 * (e.g. menolisa://settings) and by Settings.
 */
export type RefetchTrialRef = RefObject<(() => Promise<void>) | null>;

export const RefetchTrialContext = createContext<RefetchTrialRef | null>(null);
