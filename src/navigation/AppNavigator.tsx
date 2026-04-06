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
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { RefetchTrialContext } from '../context/RefetchTrialContext';
import { openAccountBillingEntry } from '../lib/api';
import { logger } from '../lib/logger';
import { syncIosReceiptStatus } from '../lib/iap';
import { LandingScreenWithButton } from '../screens/LandingScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { LoginScreen } from '../screens/LoginScreen';
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
  const { user, loading } = useAuth();
  const refetchTrialRef = useRef<(() => Promise<void>) | null>(null);
  const [disclaimerVisible, setDisclaimerVisible] = useState(false);

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

  // iOS launch sync: re-check local App Store purchases and push receipt to backend.
  useEffect(() => {
    if (Platform.OS !== 'ios' || !user) return;
    syncIosReceiptStatus()
      .then(() => refetchTrialRef.current?.().catch(() => {}))
      .catch(() => {});
  }, [user]);

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

  // Handle web auth callback (tokens in URL hash)
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleWebAuthCallback = async () => {
      // Check if we have tokens in the URL hash
      if (typeof window !== 'undefined' && window.location.hash) {
        const hash = window.location.hash.substring(1);
        
        if (hash.includes('access_token') && hash.includes('refresh_token')) {
          logger.log('Auth tokens detected in URL hash');
          
          try {
            const params = new URLSearchParams(hash);
            const access_token = params.get('access_token');
            const refresh_token = params.get('refresh_token');
            
            if (access_token && refresh_token) {
              logger.log('Setting session from URL tokens...');
              const { data, error } = await supabase.auth.setSession({
                access_token,
                refresh_token,
              });
              
              if (error) {
                logger.error('Error setting session:', error);
                return;
              }
              
              if (data?.session) {
                logger.log('Session established from URL hash!');
                // Auth state will update via onAuthStateChange
                
                // Clean up the URL hash
                if (window.history.replaceState) {
                  window.history.replaceState({}, document.title, window.location.pathname);
                }
              }
            }
          } catch (err) {
            logger.error('Error handling web auth callback:', err);
          }
        }
      }
    };

    handleWebAuthCallback();
  }, []);

  // Handle deep link authentication (for mobile)
  useEffect(() => {
    if (Platform.OS === 'web') return; // Skip on web, handled above

    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      logger.log('Deep link received');

      // Return from web dashboard: refresh trial/subscription status
      if (url.startsWith('menolisa://settings')) {
        refetchTrialRef.current?.().catch(() => {});
        return;
      }
      
      // Check if this is an auth callback
      if (url.includes('/auth/callback') || url.includes('access_token=') || url.includes('refresh_token=')) {
        logger.log('Auth callback detected');
        
        try {
          // Extract tokens from URL
          const urlObj = new URL(url.replace('menolisa://', 'https://www.menolisa.com/'));
          const hash = urlObj.hash.substring(1); // Remove the # symbol
          const params = new URLSearchParams(hash);
          
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          
          if (access_token && refresh_token) {
            // Set the session with the tokens
            const { data, error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            
            if (error) {
              logger.error('Error setting session:', error);
              return;
            }
            
            if (data?.session) {
              logger.log('Session established from deep link!');
            }
          } else {
            // Fallback: try to get session normally
            const { data, error } = await supabase.auth.getSession();
            
            if (error) {
              logger.error('Error getting session after deep link:', error);
              return;
            }
            
            if (data?.session) {
              logger.log('Session established from deep link (fallback method)');
            }
          }
        } catch (err) {
          logger.error('Error handling deep link:', err);
        }
      }
    };

    // Get the initial URL if app was opened from a link
    Linking.getInitialURL().then((url) => {
      if (url) {
        logger.log('Initial URL received');
        handleDeepLink({ url }).catch((err) => logger.error('Initial deep link handling failed:', err));
      }
    });

    // Listen for deep links while app is open
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
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

  // User with temp_password (signed up at gate) must complete set-password on Register; don't show Main yet
  const needsPassword = !!user?.user_metadata?.temp_password;
  const showMain = !!user && !needsPassword;

  return (
    <RefetchTrialContext.Provider value={refetchTrialRef}>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          key={showMain ? 'main' : 'auth'}
          screenOptions={{ headerShown: false }}
          initialRouteName={showMain ? 'Main' : needsPassword ? 'Register' : 'Landing'}
        >
          {showMain ? (
            <Stack.Screen name="Main" component={MainTabs} />
          ) : (
            <>
              <Stack.Screen name="Landing" component={LandingScreenWithButton} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
            </>
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
