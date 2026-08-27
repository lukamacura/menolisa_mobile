import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
   * She has finished something, but the reward for it is still on screen.
   *
   * Two modals at once is a bug this codebase has already had once, between the
   * medical disclaimer and this prompt — on Android they z-order unreliably and
   * the wrong one can end up behind. So the ask waits for `completion` to clear,
   * which is the moment `CompletionReward` is dismissed.
   */
  const earned = useRef(false);

  useEffect(() => {
    if (!user || !consentAccepted || permissionStatus !== 'undetermined') return;

    if (completion) {
      earned.current = true;
      return;
    }
    if (!earned.current || promptVisible) return;

    let cancelled = false;
    AsyncStorage.getItem(NOTIFICATION_PROMPT_SHOWN_KEY)
      .then((value) => {
        if (!cancelled && value !== 'true') setPromptVisible(true);
      })
      .catch(() => {
        // Unreadable marker: stay quiet rather than risk asking every launch.
        // Settings still offers the way in.
      });
    return () => {
      cancelled = true;
    };
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
