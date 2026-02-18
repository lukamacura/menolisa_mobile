import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useRegisterPushToken, NOTIFICATION_PROMPT_SHOWN_KEY } from '../hooks/useRegisterPushToken';
import { NotificationPromptModal } from '../components/NotificationPromptModal';
import { colors, typography } from '../theme/tokens';
import { DashboardScreen } from '../screens/home/DashboardScreen';
import { SymptomsScreen } from '../screens/home/SymptomsScreen';
import { SymptomLogsScreen } from '../screens/home/SymptomLogsScreen';
import { ChatListScreen } from '../screens/chat/ChatListScreen';
import { ChatThreadScreen } from '../screens/chat/ChatThreadScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { NotificationPrefsScreen } from '../screens/settings/NotificationPrefsScreen';
import { InviteFriendsScreen } from '../screens/settings/InviteFriendsScreen';

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const ChatStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();

function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Dashboard" component={DashboardScreen} />
      <HomeStack.Screen
        name="Symptoms"
        component={SymptomsScreen}
        options={{
          headerShown: true,
          headerTitle: 'Track symptoms',
          headerBackTitle: 'Back',
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
        }}
      />
      <HomeStack.Screen
        name="SymptomLogs"
        component={SymptomLogsScreen}
        options={{
          headerShown: true,
          headerTitle: 'Symptom history',
          headerBackTitle: 'Back',
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
        }}
      />
    </HomeStack.Navigator>
  );
}

function PlaceholderTabScreen({ title }: { title: string }) {
  return (
    <View style={tabStyles.container}>
      <Text style={tabStyles.text}>{title}</Text>
      <Text style={tabStyles.subtext}>Screen coming soon...</Text>
    </View>
  );
}

function ChatStackScreen() {
  return (
    <ChatStack.Navigator screenOptions={{ headerShown: false }}>
      <ChatStack.Screen name="ChatList" component={ChatListScreen} />
      <ChatStack.Screen
        name="ChatThread"
        component={ChatThreadScreen}
        options={{
          headerShown: true,
          headerTitle: 'Chat with Lisa',
          headerBackTitle: 'Back',
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: '#FDF8FA' },
          headerShadowVisible: false,
        }}
      />
    </ChatStack.Navigator>
  );
}
function SettingsStackScreen() {
  return (
    <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStack.Screen name="Settings" component={SettingsScreen} />
      <SettingsStack.Screen
        name="InviteFriends"
        component={InviteFriendsScreen}
        options={{
          headerShown: true,
          headerTitle: 'Invite friends',
          headerBackTitle: 'Back',
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
        }}
      />
      <SettingsStack.Screen
        name="NotificationPrefs"
        component={NotificationPrefsScreen}
        options={{
          headerShown: true,
          headerTitle: 'Notification preferences',
          headerBackTitle: 'Back',
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
        }}
      />
    </SettingsStack.Navigator>
  );
}

export function MainTabs() {
  const { user } = useAuth();
  const { permissionStatus, requestPermissionAndRegister } = useRegisterPushToken(user?.id);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!user || permissionStatus !== 'undetermined') return;
    AsyncStorage.getItem(NOTIFICATION_PROMPT_SHOWN_KEY).then((value) => {
      if (value !== 'true') setShowNotificationPrompt(true);
    });
  }, [user, permissionStatus]);

  const handleNotificationEnable = useCallback(() => {
    requestPermissionAndRegister();
    AsyncStorage.setItem(NOTIFICATION_PROMPT_SHOWN_KEY, 'true');
    setShowNotificationPrompt(false);
  }, [requestPermissionAndRegister]);

  const handleNotificationNotNow = useCallback(() => {
    AsyncStorage.setItem(NOTIFICATION_PROMPT_SHOWN_KEY, 'true');
    setShowNotificationPrompt(false);
  }, []);

  // Tab bar extends into bottom safe area (no gap); content is inset so labels stay fully visible
  const bottomInset = Math.max(insets.bottom, 12);
  const contentBottomPadding = bottomInset + 6; // extra space so descenders (e.g. "g") aren't clipped

  return (
    <>
    <NotificationPromptModal
      visible={showNotificationPrompt}
      onEnable={handleNotificationEnable}
      onNotNow={handleNotificationNotNow}
    />
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: typography.family.medium,
          marginBottom: 0,
          paddingBottom: 2,
        },
        tabBarItemStyle: {
          paddingTop: 6,
          paddingBottom: contentBottomPadding,
        },
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: 0,
          height: 60 + 22 + contentBottomPadding,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ChatTab"
        component={ChatStackScreen}
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="NotificationsTab"
        component={NotificationsScreen}
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsStackScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
    </>
  );
}

const tabStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    fontSize: 24,
    fontFamily: typography.family.bold,
    color: colors.text,
    marginBottom: 10,
  },
  subtext: {
    fontSize: 16,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
  },
});
