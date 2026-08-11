import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Root stack: auth stack vs main app (tabs).
 */
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

/**
 * Auth stack (Landing, Login, Register).
 */
export type AuthStackParamList = {
  Landing: undefined;
  Login: undefined;
  Register: undefined;
  AccountNotFound: { email: string };
};

/**
 * Main app = single screen that hosts the tab navigator.
 */
export type MainStackParamList = {
  MainTabs: undefined;
};

/**
 * Bottom tab navigator: 5 tabs.
 */
export type MainTabParamList = {
  TodayTab: NavigatorScreenParams<TodayStackParamList>;
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  ChatTab: NavigatorScreenParams<ChatStackParamList>;
  NotificationsTab: NavigatorScreenParams<NotificationsStackParamList>;
  SettingsTab: NavigatorScreenParams<SettingsStackParamList>;
};

type MainTabParamListMap = MainTabParamList;
type TodayStackParamListMap = TodayStackParamList;
type HomeStackParamListMap = HomeStackParamList;
type ChatStackParamListMap = ChatStackParamList;
type NotificationsStackParamListMap = NotificationsStackParamList;
type SettingsStackParamListMap = SettingsStackParamList;

/**
 * Today tab stack: the daily loop hub → one screen per pillar.
 *
 * Movement and Relaxation take a task key rather than the task itself so the
 * screen always reads the live copy out of PlanContext after a tick, instead of
 * rendering a snapshot captured at navigation time.
 */
export type TodayStackParamList = {
  DailyLoop: undefined;
  Movement: { taskKey: string };
  Nutrition: undefined;
  Relaxation: { taskKey: string };
  Habits: undefined;
};

/**
 * Home tab stack: Dashboard → Symptoms, SymptomLogs.
 */
export type HomeStackParamList = {
  Dashboard: undefined;
  Symptoms: undefined;
  SymptomLogs: undefined;
};

/**
 * Chat tab stack: ChatList (or default thread) → ChatThread.
 */
export type ChatStackParamList = {
  ChatList: undefined;
  ChatThread: { sessionId: string };
};

/**
 * Notifications tab stack (single screen for now).
 */
export type NotificationsStackParamList = {
  Notifications: undefined;
};

/**
 * Settings tab stack: Settings → NotificationPrefs.
 */
export type SettingsStackParamList = {
  Settings: undefined;
  NotificationPrefs: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
    interface AuthParamList extends AuthStackParamList {}
    interface MainTabParamList extends MainTabParamListMap {}
    interface TodayStackParamList extends TodayStackParamListMap {}
    interface HomeStackParamList extends HomeStackParamListMap {}
    interface ChatStackParamList extends ChatStackParamListMap {}
    interface NotificationsStackParamList extends NotificationsStackParamListMap {}
    interface SettingsStackParamList extends SettingsStackParamListMap {}
  }
}
