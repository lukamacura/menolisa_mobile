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
import { useAuth } from '../context/AuthContext';
import { RefetchTrialContext } from '../context/RefetchTrialContext';
import { openAccountBillingEntry } from '../lib/api';
import { logger } from '../lib/logger';
import { LandingScreenWithButton } from '../screens/LandingScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { AccountNotFoundScreen } from '../screens/AccountNotFoundScreen';
import { SubscriptionRequiredScreen } from '../screens/SubscriptionRequiredScreen';
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

const DISCLAIMER_KEY = '@menolisa:consent_v2_accepted';

export function AppNavigator() {
  const { user, loading, accountStatus, refetchAccountStatus } = useAuth();
  const refetchTrialRef = useRef<(() => Promise<void>) | null>(null);
  const [disclaimerVisible, setDisclaimerVisible] = useState(false);

  // Keep RefetchTrialContext consumers in sync with AuthContext's accountStatus refetch.
  useEffect(() => {
    refetchTrialRef.current = refetchAccountStatus;
    return () => {
      if (refetchTrialRef.current === refetchAccountStatus) {
        refetchTrialRef.current = null;
      }
    };
  }, [refetchAccountStatus]);

  // Notification runtime hardening: foreground behavior + Android channel.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const Notifications = getNativeExpoNotifications();
    if (!Notifications) return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#ff8da1',
      }).catch((err) => logger.warn('Failed to set notification channel', err));
    }
  }, []);

  // Show medical disclaimer on first launch
  useEffect(() => {
    AsyncStorage.getItem(DISCLAIMER_KEY).then((value) => {
      if (!value) {
        setDisclaimerVisible(true);
      }
    }).catch(() => {
      // If AsyncStorage fails, show the modal as a safe fallback
      setDisclaimerVisible(true);
    });
  }, []);

  const handleDisclaimerAccept = async () => {
    try {
      await AsyncStorage.setItem(DISCLAIMER_KEY, 'true');
    } catch {
      // Non-fatal: modal will be hidden regardless
    }
    setDisclaimerVisible(false);
  };

  // Handle return-from-web deep links: refresh subscription status when the user
  // comes back from menolisa.com after completing or managing checkout.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      if (url.startsWith('menolisa://settings') || url.startsWith('menolisa://account')) {
        refetchTrialRef.current?.().catch(() => {});
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, []);

  // Push notification response: open dashboard (trial) or deep link to Notifications tab
  useEffect(() => {
    if (Platform.OS === 'web' || !user) return;
    const Notifications = getNativeExpoNotifications();
    if (!Notifications) return;

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (!data) return;
      if (data.action === 'upgrade') {
        openAccountBillingEntry().catch((e) => logger.warn('Open account page failed', e));
        return;
      }
      if (data.screen === 'Notifications' && navigationRef.isReady()) {
        (navigationRef as unknown as { navigate: (name: string, params?: { screen: string }) => void }).navigate('Main', { screen: 'NotificationsTab' });
      }
    });

    return () => sub.remove();
  }, [user]);

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

  let stackKey: 'auth' | 'main' | 'gated' | 'pending';
  let initialRoute: 'Landing' | 'Main' | 'SubscriptionRequired';
  if (!isAuthed) {
    stackKey = 'auth';
    initialRoute = 'Landing';
  } else if (awaitingStatus) {
    stackKey = 'pending';
    initialRoute = 'SubscriptionRequired';
  } else if (hasAccess) {
    stackKey = 'main';
    initialRoute = 'Main';
  } else {
    stackKey = 'gated';
    initialRoute = 'SubscriptionRequired';
  }

  if (awaitingStatus) {
    return <LoadingScreen />;
  }

  return (
    <RefetchTrialContext.Provider value={refetchTrialRef}>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          key={stackKey}
          screenOptions={{ headerShown: false }}
          initialRouteName={initialRoute}
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
    </RefetchTrialContext.Provider>
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
