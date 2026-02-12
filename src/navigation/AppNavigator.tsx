import React, { useEffect, useRef } from 'react';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { RefetchTrialContext } from '../context/RefetchTrialContext';
import { openWebDashboard } from '../lib/api';
import { LandingScreenWithButton } from '../screens/LandingScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MainTabs } from './MainTabs';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

// Loading screen
function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#ff8da1" />
      <Text style={styles.subtext}>Loading...</Text>
    </View>
  );
}

export function AppNavigator() {
  const { user, loading } = useAuth();
  const refetchTrialRef = useRef<(() => Promise<void>) | null>(null);

  // Handle web auth callback (tokens in URL hash)
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleWebAuthCallback = async () => {
      // Check if we have tokens in the URL hash
      if (typeof window !== 'undefined' && window.location.hash) {
        const hash = window.location.hash.substring(1);
        
        if (hash.includes('access_token') && hash.includes('refresh_token')) {
          console.log('Auth tokens detected in URL hash');
          
          try {
            const params = new URLSearchParams(hash);
            const access_token = params.get('access_token');
            const refresh_token = params.get('refresh_token');
            
            if (access_token && refresh_token) {
              console.log('Setting session from URL tokens...');
              const { data, error } = await supabase.auth.setSession({
                access_token,
                refresh_token,
              });
              
              if (error) {
                console.error('Error setting session:', error);
                return;
              }
              
              if (data?.session) {
                console.log('Session established from URL hash!');
                // Auth state will update via onAuthStateChange
                
                // Clean up the URL hash
                if (window.history.replaceState) {
                  window.history.replaceState({}, document.title, window.location.pathname);
                }
              }
            }
          } catch (err) {
            console.error('Error handling web auth callback:', err);
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
      console.log('Deep link received:', url);

      // Return from web dashboard: refresh trial/subscription status
      if (url.startsWith('menolisa://settings')) {
        refetchTrialRef.current?.().catch(() => {});
        return;
      }
      
      // Check if this is an auth callback
      if (url.includes('/auth/callback') || url.includes('access_token=') || url.includes('refresh_token=')) {
        console.log('Auth callback detected');
        
        try {
          // Extract tokens from URL
          const urlObj = new URL(url.replace('menolisa://', 'https://menolisa.com/'));
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
              console.error('Error setting session:', error);
              return;
            }
            
            if (data?.session) {
              console.log('Session established from deep link!');
            }
          } else {
            // Fallback: try to get session normally
            const { data, error } = await supabase.auth.getSession();
            
            if (error) {
              console.error('Error getting session after deep link:', error);
              return;
            }
            
            if (data?.session) {
              console.log('Session established from deep link (fallback method)');
            }
          }
        } catch (err) {
          console.error('Error handling deep link:', err);
        }
      }
    };

    // Get the initial URL if app was opened from a link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('Initial URL:', url);
        handleDeepLink({ url });
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

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (!data) return;
      if (data.action === 'upgrade') {
        openWebDashboard().catch((e) => console.warn('Open dashboard failed', e));
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

  return (
    <RefetchTrialContext.Provider value={refetchTrialRef}>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
        key={user ? 'main' : 'auth'}
        screenOptions={{ headerShown: false }}
        initialRouteName={user ? 'Main' : 'Landing'}
      >
        {user ? (
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
    </RefetchTrialContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  subtext: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
});
