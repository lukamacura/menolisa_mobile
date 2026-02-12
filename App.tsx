import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';

SplashScreen.preventAutoHideAsync().catch(() => {
  // no-op
});

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (!fontsLoaded) return;

    // Set default typography across the app (Text only; TextInput needs explicit styles)
    // @ts-expect-error - RN types don't include defaultProps, but it's supported at runtime
    Text.defaultProps = Text.defaultProps || {};
    // @ts-expect-error - same as above
    Text.defaultProps.style = [{ fontFamily: 'Poppins_400Regular', color: '#1F2937' }, Text.defaultProps.style];

    SplashScreen.hideAsync().catch(() => {
      // no-op
    });
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#ff8da1" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}
