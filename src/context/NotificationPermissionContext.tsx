import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlan } from './PlanContext';
import { useAuth } from './AuthContext';
import { useMedicalConsentAccepted } from './ConsentContext';
import {
  useRegisterPushToken,
  NOTIFICATION_PROMPT_SHOWN_KEY,
  type NotificationPermissionStatus,
} from '../hooks/useRegisterPushToken';
import { NotificationPromptModal } from '../components/NotificationPromptModal';
import { COMPLETION_REWARD_MS } from '../components/rewards/CompletionReward';

/**
 * How long after her finished task the ask waits.
 *
 * `PlanContext.completion` is cleared on the frame `CompletionReward` *appears*,
 * not the frame it leaves — so a gate on that value alone opened this modal
 * straight over the confetti of the very task that earned the right to ask. The
 * card's own life plus a breath is what actually separates the two moments.
 */
const AFTER_REWARD_MS = COMPLETION_REWARD_MS + 400;

/**
 * Who may turn notifications on, and when she is asked.
 *
 * One owner for the whole question, because there are now two places that need
 * the answer — this provider decides when to ask, and `NotificationPrefsScreen`
 * has to be able to ask again — and two copies of `useRegisterPushToken` would
 * mean two permission reads that can disagree.
 *
 * **When she is asked changed, and it matters more than any of the code below.**
 * The prompt used to fire on first launch, behind the medical disclaimer,
 * before she had seen a single screen: a woman who had just been asked to
 * accept a medical caveat was immediately asked to accept notifications, with
 * nothing yet in the app to explain what they would be for. Worse, "Not now"
 * wrote the same one-shot marker as "Enable", and no screen offered a way back
 * — so one tap in the first ten seconds silenced the app permanently, while
 * Settings went on showing two switches in the "on" position.
 *
 * Now she is asked after her first finished task, which is the first moment the
 * app has given her anything, and "Not now" is only ever a *no for now*:
 * Settings can always ask again.
 */

type NotificationPermissionValue = {
  status: NotificationPermissionStatus;
  /** Show the system prompt (or no-op if already decided) and register the token. */
  request: () => Promise<void>;
  /** Re-read the OS setting — after a trip to system settings, say. */
  refresh: () => Promise<void>;
};

const NotificationPermissionContext =
  createContext<NotificationPermissionValue | null>(null);

export function NotificationPermissionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const { completion } = usePlan();
  // Belt and braces. Finishing a task already puts her well past the disclaimer,
  // but this is the gate that exists to stop two modals opening at once, and the
  // cost of keeping it honoured here is one boolean.
  const consentAccepted = useMedicalConsentAccepted();
  const { permissionStatus, requestPermissionAndRegister, refreshPermissionStatus } =
    useRegisterPushToken(user?.id);

  const [promptVisible, setPromptVisible] = useState(false);
  /**
   * She has finished something, and the ask is now owed to her.
   *
   * Two things at once is a bug this codebase has already had once, between the
   * medical disclaimer and this prompt — on Android they z-order unreliably and
   * the wrong one can end up behind. So the ask waits out the reward card in
   * full (`AFTER_REWARD_MS`) rather than waiting on `completion`, which clears
   * while the confetti is still falling.
   */
  const earned = useRef(false);
  /** The wait in progress, so a second completion can restart it. */
  const waiting = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (waiting.current) clearTimeout(waiting.current);
    };
  }, []);

  /**
   * Re-read the OS setting every time she comes back to the app.
   *
   * Without it, a woman who turned notifications on in system settings — the
   * only route left to her once iOS has taken its one shot at the dialog — came
   * back to an app still holding `denied`, which made the reminder scheduler
   * cancel everything it had for the rest of the session. It corrected itself on
   * the next cold start, which is not a thing she can be expected to know.
   */
  useEffect(() => {
    if (!user) return;
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') refreshPermissionStatus().catch(() => {});
    });
    return () => subscription.remove();
  }, [user, refreshPermissionStatus]);

  useEffect(() => {
    if (!user || !consentAccepted || permissionStatus !== 'undetermined') return;

    if (completion) {
      earned.current = true;
      // A second finished task restarts the wait: the new card gets its own full
      // life on screen, and the ask goes behind that one too.
      if (waiting.current) {
        clearTimeout(waiting.current);
        waiting.current = null;
      }
      return;
    }
    if (!earned.current || promptVisible || waiting.current) return;

    waiting.current = setTimeout(() => {
      waiting.current = null;
      AsyncStorage.getItem(NOTIFICATION_PROMPT_SHOWN_KEY)
        .then((value) => {
          if (mounted.current && value !== 'true') setPromptVisible(true);
        })
        .catch(() => {
          // Unreadable marker: stay quiet rather than risk asking every launch.
          // Settings still offers the way in.
        });
    }, AFTER_REWARD_MS);
  }, [user, consentAccepted, permissionStatus, completion, promptVisible]);

  const dismissPrompt = useCallback(() => {
    setPromptVisible(false);
    // Marks "we have asked once", not "she said no forever" — `request()` below
    // ignores it entirely, which is what makes the Settings route work.
    AsyncStorage.setItem(NOTIFICATION_PROMPT_SHOWN_KEY, 'true').catch(() => {});
  }, []);

  const handleEnable = useCallback(() => {
    dismissPrompt();
    requestPermissionAndRegister();
  }, [dismissPrompt, requestPermissionAndRegister]);

  const value = useMemo<NotificationPermissionValue>(
    () => ({
      status: permissionStatus,
      request: requestPermissionAndRegister,
      refresh: refreshPermissionStatus,
    }),
    [permissionStatus, requestPermissionAndRegister, refreshPermissionStatus]
  );

  return (
    <NotificationPermissionContext.Provider value={value}>
      <NotificationPromptModal
        visible={promptVisible}
        onEnable={handleEnable}
        onNotNow={dismissPrompt}
      />
      {children}
    </NotificationPermissionContext.Provider>
  );
}

export function useNotificationPermission(): NotificationPermissionValue {
  const context = useContext(NotificationPermissionContext);
  if (!context) {
    throw new Error(
      'useNotificationPermission must be used within a NotificationPermissionProvider'
    );
  }
  return context;
}
