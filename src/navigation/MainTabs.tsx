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
import { PlanProvider } from '../context/PlanContext';
import { RewardsProvider } from '../context/RewardsContext';
import { RewardCelebrations } from '../components/rewards/RewardCelebrations';
import { CompletionReward } from '../components/rewards/CompletionReward';
import { RewardsScreen } from '../screens/rewards/RewardsScreen';
import { DailyLoopScreen } from '../screens/today/DailyLoopScreen';
import { MovementScreen } from '../screens/today/MovementScreen';
import { NutritionScreen } from '../screens/today/NutritionScreen';
import { RelaxationScreen } from '../screens/today/RelaxationScreen';
import { HabitsScreen } from '../screens/today/HabitsScreen';
import { SymptomsScreen } from '../screens/symptoms/SymptomsScreen';
import { SymptomLogsScreen } from '../screens/symptoms/SymptomLogsScreen';
import { ChatListScreen } from '../screens/chat/ChatListScreen';
import { ChatThreadScreen } from '../screens/chat/ChatThreadScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { NotificationPrefsScreen } from '../screens/settings/NotificationPrefsScreen';
import { innerStackScreenOptions } from './stackScreenOptions';

const Tab = createBottomTabNavigator();
const TodayStack = createNativeStackNavigator();
const ChatStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();

/** Header block shared by every pushed sub-screen in the app. */
const pushedScreenHeader = {
  headerShown: true,
  headerBackTitle: 'Back',
  headerTintColor: colors.primary,
  headerStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
} as const;

function TodayStackScreen() {
  return (
    <TodayStack.Navigator screenOptions={innerStackScreenOptions}>
      <TodayStack.Screen name="DailyLoop" component={DailyLoopScreen} />
      <TodayStack.Screen
        name="Movement"
        component={MovementScreen}
        options={{ ...pushedScreenHeader, headerTitle: 'Movement' }}
      />
      <TodayStack.Screen
        name="Nutrition"
        component={NutritionScreen}
        options={{ ...pushedScreenHeader, headerTitle: 'Nutrition' }}
      />
      <TodayStack.Screen
        name="Relaxation"
        component={RelaxationScreen}
        options={{ ...pushedScreenHeader, headerTitle: 'Relaxation' }}
      />
      <TodayStack.Screen
        name="Habits"
        component={HabitsScreen}
        options={{ ...pushedScreenHeader, headerTitle: 'Your habits' }}
      />
      <TodayStack.Screen
        name="Rewards"
        component={RewardsScreen}
        options={{ ...pushedScreenHeader, headerTitle: 'Rewards' }}
      />
      <TodayStack.Screen
        name="Symptoms"
        component={SymptomsScreen}
        options={{ ...pushedScreenHeader, headerTitle: 'Track symptoms' }}
      />
      <TodayStack.Screen
        name="SymptomLogs"
        component={SymptomLogsScreen}
        options={{ ...pushedScreenHeader, headerTitle: 'Symptom history' }}
      />
    </TodayStack.Navigator>
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
    <ChatStack.Navigator screenOptions={innerStackScreenOptions}>
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
    <SettingsStack.Navigator screenOptions={innerStackScreenOptions}>
      <SettingsStack.Screen name="Settings" component={SettingsScreen} />
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
    <PlanProvider>
    {/* Inside PlanProvider: rewards share the plan's local date, and watch it
        for ticks so a badge earned by checking a box announces itself. */}
    <RewardsProvider>
    <NotificationPromptModal
      visible={showNotificationPrompt}
      onEnable={handleNotificationEnable}
      onNotNow={handleNotificationNotNow}
    />
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.55)',
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: typography.display.semibold,
          marginBottom: 0,
          paddingBottom: 2,
        },
        tabBarItemStyle: {
          paddingTop: 6,
          paddingBottom: contentBottomPadding,
        },
        tabBarStyle: {
          backgroundColor: colors.navy,
          borderTopColor: 'rgba(255, 255, 255, 0.12)',
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: 0,
          height: 60 + 22 + contentBottomPadding,
          ...(Platform.OS === 'web'
            ? { boxShadow: '0 -2px 8px rgba(0,0,0,0.06)' }
            : { elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8 }),
        },
      }}
    >
      <Tab.Screen
        name="TodayTab"
        component={TodayStackScreen}
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sunny" size={size} color={color} />
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
          // "Notifications" wraps at small widths and a wrapped label breaks the
          // hand-tuned tabBarStyle height below. The route name is unchanged, so
          // push routing and every getParent().navigate('NotificationsTab') call
          // site still work.
          title: 'Alerts',
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
    {/* Both last, so a reward sits above the tab bar and every screen.
        CompletionReward fires on each finished task and passes touches through;
        RewardCelebrations is the rarer badge/level modal that does interrupt. */}
    <CompletionReward />
    <RewardCelebrations />
    </RewardsProvider>
    </PlanProvider>
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
