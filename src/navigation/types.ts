import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Root stack. AppNavigator renders exactly one of these branches at a time —
 * the auth screens, the paywall, or the tabs — so every screen it can register
 * is listed here flat.
 */
export type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  AccountNotFound: { email: string };
  Main: undefined;
  SubscriptionRequired: undefined;
};

/**
 * Auth stack. There is no Register screen: the funnel takes the card before an
 * account is worth anything, so signing up happens on menolisa.com and the app
 * only ever opens that URL.
 */
export type AuthStackParamList = {
  Landing: undefined;
  Login: undefined;
  AccountNotFound: { email: string };
};

/**
 * Bottom tab navigator: 4 tabs.
 */
export type MainTabParamList = {
  TodayTab: NavigatorScreenParams<TodayStackParamList>;
  ChatTab: NavigatorScreenParams<ChatStackParamList>;
  NotificationsTab: NavigatorScreenParams<NotificationsStackParamList>;
  SettingsTab: NavigatorScreenParams<SettingsStackParamList>;
};

type MainTabParamListMap = MainTabParamList;
type TodayStackParamListMap = TodayStackParamList;
type ChatStackParamListMap = ChatStackParamList;
type NotificationsStackParamListMap = NotificationsStackParamList;
type SettingsStackParamListMap = SettingsStackParamList;

/**
 * Today tab stack: the daily loop hub → one screen per pillar, plus symptom
 * tracking. Tracking lives here rather than in a tab of its own because it is
 * the same daily question as the pillars, asked of her body instead of her plan.
 *
 * Movement and Relaxation take a task key rather than the task itself so the
 * screen always reads the live copy out of PlanContext after a tick, instead of
 * rendering a snapshot captured at navigation time.
 */
export type TodayStackParamList = {
  DailyLoop: undefined;
  Movement: { taskKey: string };
  /** The guided timer for one movement session. Same key, so it reads the live task too. */
  MovementSession: { taskKey: string };
  Nutrition: undefined;
  Relaxation: { taskKey: string };
  Habits: undefined;
  /** XP, level, streak and every badge. Reads RewardsContext — takes no params. */
  Rewards: undefined;
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
    interface ChatStackParamList extends ChatStackParamListMap {}
    interface NotificationsStackParamList extends NotificationsStackParamListMap {}
    interface SettingsStackParamList extends SettingsStackParamListMap {}
  }
}
