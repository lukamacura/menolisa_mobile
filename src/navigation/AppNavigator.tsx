import React, { useEffect, useRef, useState } from 'react';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { getNativeExpoNotifications } from '../lib/expoNotificationsGate';
import { isLocalReminder } from '../lib/reminders/schedule';
import { useAuth } from '../context/AuthContext';
import { useAppUpdate } from '../hooks/useAppUpdate';
import { MedicalConsentProvider } from '../context/ConsentContext';
import { openAccountBillingEntry } from '../lib/api';
import { logger } from '../lib/logger';
import { LandingScreenWithButton } from '../screens/LandingScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { AccountNotFoundScreen } from '../screens/AccountNotFoundScreen';
import { SubscriptionRequiredScreen } from '../screens/SubscriptionRequiredScreen';
import { UpdateRequiredScreen } from '../screens/UpdateRequiredScreen';
import { MainTabs } from './MainTabs';
import { MedicalDisclaimerModal } from '../components/MedicalDisclaimerModal';
import { colors } from '../theme/tokens';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

// Loading screen
function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.subtext}>Loading...</Text>
    </View>
  );
}

/**
 * Bump the version whenever the modal gains something she has not agreed to.
 *
 * A new key means everyone sees the gate once more, which is the point: consent
 * already given cannot cover text that did not exist when she gave it. The old
 * key is deliberately left behind in AsyncStorage — it is a few bytes, and
 * clearing it would destroy the record that she accepted the earlier version.
 *
 * `v3` (2026-08-29) added the exercise-safety section — when to check with a
 * doctor before starting, and the stop signals — and said plainly that the plan
 * is built from her quiz answers rather than a medical assessment. `v2` carried
 * the medical and AI/data sections only, so nobody still on `v2` has been shown
 * any of that.
 */
const DISCLAIMER_KEY = '@menolisa:consent_v3_accepted';

export function AppNavigator() {
  const { user, loading, accountStatus, reconcileAccountStatus } = useAuth();
  /**
   * Whether this build is still one the API supports. Only `required`
   * matters here; the soft nudge is the daily loop's business.
   */
  const { requirement: updateRequirement, openStore, recheck } = useAppUpdate();
  /**
   * `null` while the stored flag is still being read — neither "show the gate"
   * nor "consent is done". Anything downstream that waits on consent has to sit
   * out that gap rather than treat an unread flag as acceptance.
   */
  const [disclaimerAccepted, setDisclaimerAccepted] = useState<boolean | null>(null);
  const disclaimerVisible = disclaimerAccepted === false;

  /**
   * Read through a ref so the deep-link listener can stay mounted for the life
   * of the app. This used to route through a shared `RefetchTrialContext` ref
   * that SettingsScreen also wrote to — and nulled on unmount, so once she had
   * opened Settings the return-from-checkout refresh silently did nothing for
   * the rest of the session.
   */
  const reconcileRef = useRef(reconcileAccountStatus);
  reconcileRef.current = reconcileAccountStatus;

  // Notification runtime hardening: foreground behavior + Android channel.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const Notifications = getNativeExpoNotifications();
    if (!Notifications) return;

    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        /**
         * A local reminder that fires while she is already in the app is noise:
         * it exists to bring her here, and she is here. It is dropped silently
         * rather than banner-ed over the very screen it was pointing at. Server
         * alerts still show — those carry news she has no other way to see.
         */
        const reminder = isLocalReminder(notification.request.content.data);
        return {
          shouldPlaySound: !reminder,
          shouldSetBadge: !reminder,
          shouldShowBanner: !reminder,
          shouldShowList: !reminder,
        };
      },
    });

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: colors.primary,
      }).catch((err) => logger.warn('Failed to set notification channel', err));
    }
  }, []);

  // Show medical disclaimer on first launch
  useEffect(() => {
    AsyncStorage.getItem(DISCLAIMER_KEY)
      .then((value) => setDisclaimerAccepted(!!value))
      .catch(() => {
        // If AsyncStorage fails, show the modal as a safe fallback
        setDisclaimerAccepted(false);
      });
  }, []);

  const handleDisclaimerAccept = async () => {
    try {
      await AsyncStorage.setItem(DISCLAIMER_KEY, 'true');
    } catch {
      // Non-fatal: modal will be hidden regardless
    }
    setDisclaimerAccepted(true);
  };

  // Handle return-from-web deep links: refresh subscription status when the user
  // comes back from menolisa.com after completing or managing checkout.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      if (url.startsWith('menolisa://settings') || url.startsWith('menolisa://account')) {
        // She is coming back from the web, most likely from checkout or the
        // billing portal — the one moment a missed Stripe webhook is worth a
        // round trip to rule out.
        reconcileRef.current().catch(() => {});
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, []);

  // Where a tapped notification lands — server push and local reminder alike.
  //
  // The server payload is written by the alert catalog (web:
  // lib/alerts/catalog.ts): `action: 'upgrade'` for anything about money, which
  // is managed on the web, and otherwise `screen` naming a tab. Local reminders
  // (src/lib/reminders) deliberately use the same `{ screen }` shape so there is
  // one router rather than two.
  //
  // An alert that opens nowhere is worse than no alert — she acts on it and the
  // app ignores her — so an unrecognised payload still opens the Alerts tab,
  // where the same words are waiting as a row she can read. The one exception is
  // a local reminder, which was never written to the Alerts tab: it falls back
  // to the plan itself, which is what it was about.
  useEffect(() => {
    if (Platform.OS === 'web' || !user) return;
    const Notifications = getNativeExpoNotifications();
    if (!Notifications) return;

    let cancelled = false;

    const route = (response: {
      notification: { request: { identifier: string; content: { data?: unknown } } };
    }) => {
      const data = response.notification.request.content.data as
        | Record<string, string>
        | undefined;

      if (data?.action === 'upgrade') {
        openAccountBillingEntry().catch((e) => logger.warn('Open account page failed', e));
        return;
      }

      const navigate = (navigationRef as unknown as {
        navigate: (name: string, params?: object) => void;
      }).navigate;

      /** Any screen on the Today stack, with the params that screen needs. */
      const today = (screen: string, params?: object) =>
        navigate('Main', { screen: 'TodayTab', params: { screen, params } });

      const go = () => {
        if (cancelled || !navigationRef.isReady()) return;
        switch (data?.screen) {
          case 'DailyLoop':
            return today('DailyLoop');
          case 'PlanContinue':
            return today('PlanContinue');
          case 'Nutrition':
            return today('Nutrition');
          // The movement reminder names the task it is about, so she lands on
          // the session rather than on a hub she has to find it in again.
          case 'Movement':
            return data.taskKey
              ? today('Movement', { taskKey: data.taskKey })
              : today('DailyLoop');
          default:
            return isLocalReminder(data)
              ? today('DailyLoop')
              : navigate('Main', { screen: 'NotificationsTab' });
        }
      };

      // On a cold start the navigator is still mounting when this resolves, and
      // navigating into a tree that does not exist yet is silently dropped.
      if (navigationRef.isReady()) go();
      else setTimeout(go, 300);
    };

    /**
     * The tap that launched the app.
     *
     * The listener below only sees taps that arrive while it is mounted, so a
     * push tapped from a killed app — the common case, since that is what a
     * reminder is for — opened the app on the default tab and dropped whatever
     * she tapped it for. Deduped by notification id against the listener, which
     * may also deliver the same response.
     */
    const handled = new Set<string>();
    const routeOnce = (response: {
      notification: { request: { identifier: string; content: { data?: unknown } } };
    }) => {
      const id = response.notification.request.identifier;
      if (handled.has(id)) return;
      handled.add(id);
      route(response);
    };

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!cancelled && response) routeOnce(response);
      })
      .catch((e) => logger.warn('Reading launch notification failed', e));

    const sub = Notifications.addNotificationResponseReceivedListener(routeOnce);

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [user]);

  /**
   * Above everything, including the loading screen and the auth branch.
   *
   * A build below the server's `minimum` is one we no longer support, which
   * means the calls the screens behind this are about to make cannot be
   * trusted. Sitting her on a spinner, or on a login form that will fail in a
   * way she cannot diagnose, is strictly worse than telling her to update.
   * Anything other than `required` — including the `unknown` of a check that
   * has not answered yet or could not — falls through and the app runs.
   */
  if (updateRequirement === 'required') {
    return <UpdateRequiredScreen onUpdate={openStore} onRecheck={recheck} />;
  }

  if (loading) {
    return <LoadingScreen />;
  }

  // Routing logic:
  // - No session → auth stack (Landing → Login).
  // - Session, but accountStatus says expired/pending_payment → SubscriptionRequired.
  // - Session and active subscription → Main tabs.
  // While accountStatus is null right after login, hold on the loading screen so we
  // don't flash MainTabs to a user who turns out to be expired.
  const isAuthed = !!user;
  // Trust the server's own access boolean rather than re-deriving it client-side.
  const hasAccess = !!accountStatus && accountStatus.has_access;
  const awaitingStatus = isAuthed && accountStatus === null;

  // Hold the loading screen rather than flashing MainTabs at someone who turns
  // out to be expired.
  if (awaitingStatus) {
    return <LoadingScreen />;
  }

  // Remounts the navigator when the branch changes, so no route from the
  // previous branch survives in the history.
  const stackKey: 'auth' | 'main' | 'gated' = !isAuthed ? 'auth' : hasAccess ? 'main' : 'gated';

  return (
    // Anything inside the navigator that wants to interrupt her — the push
    // pre-prompt, for one — waits its turn behind the consent gate below.
    <MedicalConsentProvider accepted={disclaimerAccepted === true}>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          key={stackKey}
          screenOptions={{ headerShown: false }}
        >
          {!isAuthed ? (
            <>
              <Stack.Screen name="Landing" component={LandingScreenWithButton} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="AccountNotFound" component={AccountNotFoundScreen} />
            </>
          ) : hasAccess ? (
            <Stack.Screen name="Main" component={MainTabs} />
          ) : (
            <Stack.Screen name="SubscriptionRequired" component={SubscriptionRequiredScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
      <MedicalDisclaimerModal
        visible={disclaimerVisible}
        onAccept={handleDisclaimerAccept}
      />
    </MedicalConsentProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  subtext: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 12,
  },
});
