import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, typography } from '../theme/tokens';
import { haptics } from '../lib/haptics';
import { useReduceMotion } from '../components/StaggeredZoomIn';
import { PlanProvider } from '../context/PlanContext';
import { RewardsProvider } from '../context/RewardsContext';
import { NotificationPermissionProvider } from '../context/NotificationPermissionContext';
import { NotificationsProvider, useNotifications } from '../context/NotificationsContext';
import { useOnboardingTour } from '../hooks/useOnboardingTour';
import { DailyReminders } from '../components/DailyReminders';
import { RewardCelebrations } from '../components/rewards/RewardCelebrations';
import { CompletionReward } from '../components/rewards/CompletionReward';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { RewardsScreen } from '../screens/rewards/RewardsScreen';
import { ProgressScreen } from '../screens/today/ProgressScreen';
import { PlanRecapScreen } from '../screens/today/PlanRecapScreen';
import { PlanContinueScreen } from '../screens/today/PlanContinueScreen';
import { DailyLoopScreen } from '../screens/today/DailyLoopScreen';
import { MovementScreen } from '../screens/today/MovementScreen';
import { MovementSessionScreen } from '../screens/today/MovementSessionScreen';
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
      {/* No header and no back-swipe: the session owns the screen while she is
          working, and its own close button is the way out — so that leaving can
          offer to log what she already did instead of silently discarding it. */}
      <TodayStack.Screen
        name="MovementSession"
        component={MovementSessionScreen}
        // Rises over the plan rather than sliding in beside it: this is the one
        // screen in the app that takes the whole display, and the transition
        // should say so before she reads a word of it.
        options={{
          headerShown: false,
          gestureEnabled: false,
          animation: 'slide_from_bottom',
        }}
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
        name="Progress"
        component={ProgressScreen}
        options={{ ...pushedScreenHeader, headerTitle: 'Progress' }}
      />
      <TodayStack.Screen
        name="PlanRecap"
        component={PlanRecapScreen}
        options={{
          ...pushedScreenHeader,
          headerTitle: 'Your 8 weeks',
          // No swipe-back and no back button: this is the handoff between two
          // plans, and its one button is what marks it seen. Letting her slide
          // out of it would leave the recap owed to her forever, re-opening on
          // every visit to the daily loop.
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
      <TodayStack.Screen
        name="PlanContinue"
        component={PlanContinueScreen}
        options={{
          ...pushedScreenHeader,
          headerTitle: 'Your plan',
          // Same reasoning as PlanRecap: its one button is what marks it seen,
          // so sliding out of it would leave the screen owed to her forever and
          // re-open it on every visit to the daily loop.
          headerBackVisible: false,
          gestureEnabled: false,
        }}
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
          headerStyle: { backgroundColor: colors.chatHeaderBg },
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
  return (
    <PlanProvider>
    {/* Inside PlanProvider: rewards share the plan's local date, and watch it
        for ticks so a badge earned by checking a box announces itself. */}
    <RewardsProvider>
    {/* Inside both: it asks for notification permission at her first finished
        task, which only PlanContext can tell it about, and the reminder
        scheduler underneath it reads her plan and her streak. */}
    <NotificationPermissionProvider>
    {/* Outside the navigator so the tab bar can read the unread count. */}
    <NotificationsProvider>
    <AppTabs />
    {/* Renders nothing — keeps the device's scheduled reminders in step with
        her plan, so ticking a box cancels the nudge about it. */}
    <DailyReminders />
    {/* Both last, so a reward sits above the tab bar and every screen.
        CompletionReward fires on each finished task and passes touches through;
        RewardCelebrations is the rarer badge/level modal that does interrupt. */}
    <CompletionReward />
    <RewardCelebrations />
    {/* Last of all, so the welcome tour covers the tab bar it is there to
        explain. Renders nothing once she has been through it. */}
    <WelcomeTour />
    </NotificationsProvider>
    </NotificationPermissionProvider>
    </RewardsProvider>
    </PlanProvider>
  );
}

/**
 * The one-time welcome tour, mounted beside the tabs rather than routed to.
 *
 * `useOnboardingTour` holds it back until the medical disclaimer is out of the
 * way and the "seen" marker has actually been read, so this either renders the
 * whole screen or nothing — it never flashes.
 *
 * It is the middle of a three-step queue: disclaimer, tour, push pre-prompt.
 * The two things that can interrupt her from underneath here — the push ask in
 * `NotificationPermissionContext` and the once-only plan screens the daily loop
 * navigates to — both wait on `settled` from the same hook.
 */
function WelcomeTour() {
  const { pending, markSeen } = useOnboardingTour();
  if (!pending) return null;
  return <OnboardingScreen onDone={markSeen} />;
}

/**
 * A tab icon that answers the tap.
 *
 * The bar was doing all its work with colour alone — coral for the tab she is
 * on, translucent white for the rest. That is a real distinction on a bright
 * screen indoors and close to invisible on a phone held at arm's length in
 * daylight, which is exactly where this app gets used. The lift is a second,
 * non-colour channel saying the same thing, and it costs nothing to read.
 *
 * Small numbers on purpose: four points of rise and twelve percent of scale.
 * The bar is the one piece of furniture on every screen, and furniture that
 * bounces gets old faster than anything else in an app.
 */
function TabIcon({
  name,
  color,
  size,
  focused,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  size: number;
  focused: boolean;
}) {
  const reduceMotion = useReduceMotion();
  const active = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    const next = focused ? 1 : 0;
    active.value = reduceMotion
      ? next
      : focused
        ? withSpring(1, { damping: 13, stiffness: 260, mass: 0.5 })
        : withTiming(0, { duration: 160 });
  }, [focused, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + active.value * 0.12 }, { translateY: active.value * -4 }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}

function AppTabs() {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications();

  // Tab bar extends into bottom safe area (no gap); content is inset so labels stay fully visible
  const bottomInset = Math.max(insets.bottom, 12);
  const contentBottomPadding = bottomInset + 6; // extra space so descenders (e.g. "g") aren't clipped

  return (
    <Tab.Navigator
      // A tab switch is the most-repeated navigation in the app and the only one
      // that never moves the screen much — the cross-fade below is deliberately
      // quiet. The tick under the thumb is what confirms the tap landed, which
      // matters most for the mistaps: she feels the wrong tab before she reads it.
      screenListeners={{ tabPress: () => haptics.select() }}
      screenOptions={{
        headerShown: false,
        // A tab is a place, not a page load. The cross-fade makes switching read
        // as the same app turning to face something else, which is the whole
        // premise of the daily loop sitting one tap from the chat.
        animation: 'fade',
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
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="sunny" size={size} color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="ChatTab"
        component={ChatStackScreen}
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="chatbubbles" size={size} color={color} focused={focused} />
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
          // Without this the alerts are invisible: they land in a tab she has
          // no reason to open, and the push is the only chance she gets to
          // notice one. Capped at 9+ so a long absence can't widen the item.
          tabBarBadge: unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.primary,
            color: colors.background,
            fontFamily: typography.display.semibold,
            fontSize: 11,
          },
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="notifications" size={size} color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsStackScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="settings" size={size} color={color} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
