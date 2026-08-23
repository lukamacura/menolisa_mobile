import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiFetchWithAuth, API_CONFIG, openAccountBillingEntry } from '../../lib/api';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNotifications } from '../../context/NotificationsContext';
import type { MainTabParamList } from '../../navigation/types';
import { colors, spacing, radii, typography, shadows } from '../../theme/tokens';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';
import { ListSkeleton, ContentTransition } from '../../components/skeleton';
import { errorMessage } from '../../lib/errorCopy';

/**
 * `metadata.alert_kind` is set by the server's alert catalog (web:
 * lib/alerts/catalog.ts). It is the precise reason the alert was sent, where
 * `type` is only the broad family, so the icon is chosen from it when present.
 */
type AlertKind =
  | 'daily_nudge'
  | 'streak_risk'
  | 'week_start'
  | 'weekly_recap'
  | 'renewal'
  | 'access_ending'
  | 'payment_failed';

type NotificationItem = {
  id: string;
  user_id: string;
  title: string | null;
  body?: string | null;
  message?: string | null;
  type: string | null;
  seen: boolean;
  dismissed: boolean;
  created_at: string;
  metadata?: { alert_kind?: AlertKind; screen?: string } | null;
};

type NotificationStyle = { icon: string; iconColor: string; bgColor: string };

const PRIMARY_SOFT: NotificationStyle = {
  icon: 'notifications-outline',
  iconColor: colors.primary,
  bgColor: colors.notificationIconPrimarySoft,
};

/** One icon per alert, so the list is scannable without reading a word of it. */
const ALERT_STYLES: Record<AlertKind, NotificationStyle> = {
  daily_nudge: { ...PRIMARY_SOFT, icon: 'sunny-outline' },
  streak_risk: { ...PRIMARY_SOFT, icon: 'flame-outline' },
  week_start: { icon: 'calendar-outline', iconColor: colors.navy, bgColor: colors.plumSoft },
  weekly_recap: { icon: 'analytics-outline', iconColor: colors.navy, bgColor: colors.plumSoft },
  renewal: { icon: 'card-outline', iconColor: colors.success, bgColor: colors.successBg },
  access_ending: { ...PRIMARY_SOFT, icon: 'time-outline' },
  payment_failed: { icon: 'alert-circle-outline', iconColor: colors.danger, bgColor: colors.dangerBg },
};

/** Fallbacks for anything not written by the alert catalog. */
function getTypeStyle(type: string | null): NotificationStyle {
  switch ((type || '').toLowerCase()) {
    case 'reminder':
      return { ...PRIMARY_SOFT, icon: 'alarm-outline' };
    case 'weekly_insights':
      return ALERT_STYLES.weekly_recap;
    case 'trial':
      return { ...PRIMARY_SOFT, icon: 'card-outline' };
    case 'lisa_message':
      return { ...PRIMARY_SOFT, icon: 'chatbubble-ellipses-outline' };
    case 'achievement':
      return {
        icon: 'trophy-outline',
        iconColor: colors.gold,
        bgColor: colors.notificationIconGoldSoft,
      };
    case 'welcome':
      return { ...PRIMARY_SOFT, icon: 'hand-left-outline' };
    case 'success':
      return {
        icon: 'checkmark-circle-outline',
        iconColor: colors.success,
        bgColor: colors.successBg,
      };
    case 'error':
      return { icon: 'alert-circle-outline', iconColor: colors.danger, bgColor: colors.dangerBg };
    default:
      return {
        icon: 'notifications-outline',
        iconColor: colors.textMuted,
        bgColor: colors.surfaceElevated,
      };
  }
}

function getNotificationStyle(item: NotificationItem): NotificationStyle {
  const kind = item.metadata?.alert_kind;
  if (kind && kind in ALERT_STYLES) return ALERT_STYLES[kind];
  return getTypeStyle(item.type);
}

/**
 * Alerts always carry their own title — the catalog has no untitled copy. This
 * only covers rows written by hand or by an older build.
 */
function getDisplayTitle(item: NotificationItem): string {
  if (item.title && item.title.trim()) return item.title;
  switch ((item.type || '').toLowerCase()) {
    case 'trial':
      return 'Your subscription';
    case 'reminder':
      return 'Reminder';
    case 'weekly_insights':
      // Same words as the switch in Notification preferences that controls it.
      return 'Weekly summary from Lisa';
    case 'lisa_message':
      return 'Message from Lisa';
    case 'achievement':
      return 'Achievement';
    case 'welcome':
      return 'Welcome';
    case 'error':
      return 'Notice';
    default:
      return 'Notification';
  }
}

/**
 * Alerts she has to act on at the billing page open it; everything else stays
 * in the app.
 *
 * `renewal` used to be in here and is deliberately not any more — see
 * `opensPlanContinue`. The bare `type === 'trial'` fallback stays for rows
 * written before the alert catalog stamped a `kind`.
 */
function opensBilling(item: NotificationItem): boolean {
  const kind = item.metadata?.alert_kind;
  if (kind) return kind === 'access_ending' || kind === 'payment_failed';
  return item.type === 'trial';
}

/**
 * The renewal notice opens the plan screen, not a billing page.
 *
 * It is the one money alert with nothing for her to do — the card is charged
 * automatically — so dropping her onto an invoice list next to a Cancel button
 * answers a question she did not ask.
 */
function opensPlanContinue(item: NotificationItem): boolean {
  return item.metadata?.alert_kind === 'renewal';
}

export function NotificationsScreen() {
  const reduceMotion = useReduceMotion();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { markAllSeen } = useNotifications();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Which rows were unread when she opened the tab.
   *
   * Opening marks everything read, so `item.seen` goes true underneath her. The
   * highlight has to survive that visit or the alerts she came to look at lose
   * their marking as she is reading them — it clears on her next visit instead.
   */
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await apiFetchWithAuth(`${API_CONFIG.endpoints.notifications}?limit=50`);
      const rows: NotificationItem[] = res?.data ?? [];
      setItems(rows);

      const unread = rows.filter((row) => !row.seen).map((row) => row.id);
      if (unread.length > 0) {
        setNewIds((current) => new Set([...current, ...unread]));
        // Opening the tab is reading them. The badge is what tells her something
        // arrived, so leaving it up after she has looked makes it meaningless.
        markAllSeen().catch(() => {});
      }
    } catch (e) {
      setError(errorMessage(e, 'We could not load your notifications.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [markAllSeen]);

  useFocusEffect(
    useCallback(() => {
      load();
      // Leaving is what ends the visit, so the highlights are dropped here
      // rather than on the next arrival — which would race the fetch.
      return () => setNewIds(new Set());
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ListSkeleton headerTitleWidth={140} rowCount={4} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ContentTransition>
      <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
        <View style={styles.header}>
          <Text style={styles.title}>Alerts</Text>
        </View>
      </StaggeredZoomIn>
      {error && (
        <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color={colors.danger} style={styles.errorIcon} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </StaggeredZoomIn>
      )}
      <StaggeredZoomIn delayIndex={2} reduceMotion={reduceMotion} style={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="notifications-off-outline" size={40} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Nothing yet</Text>
            <Text style={styles.emptyText}>
              Reminders, your weekly summary and anything about your plan will show up here.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const style = getNotificationStyle(item);
          const onPress = opensBilling(item)
            ? () => openAccountBillingEntry().catch(() => {})
            : opensPlanContinue(item)
              ? () => navigation.navigate('TodayTab', { screen: 'PlanContinue' })
              : undefined;
          const Wrapper = onPress ? TouchableOpacity : View;
          const wrapperProps = onPress ? { activeOpacity: 0.7, onPress } : {};
          return (
            <Wrapper style={[styles.card, newIds.has(item.id) && styles.cardUnread]} {...wrapperProps}>
              <View style={[styles.iconWrap, { backgroundColor: style.bgColor }]}>
                <Ionicons name={style.icon as any} size={22} color={style.iconColor} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {getDisplayTitle(item)}
                </Text>
                {(item.body ?? item.message) ? (
                  <Text style={styles.cardBody} numberOfLines={3}>
                    {item.body ?? item.message}
                  </Text>
                ) : null}
                <Text style={styles.cardDate}>
                  {new Date(item.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </Wrapper>
          );
        }}
      />
      </StaggeredZoomIn>
      </ContentTransition>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontFamily: typography.family.bold,
    color: colors.text,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerBg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(200, 58, 84, 0.2)',
  },
  errorIcon: {
    marginRight: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.danger,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  empty: {
    alignItems: 'center',
    marginTop: spacing['2xl'],
    paddingHorizontal: spacing.xl,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(46, 42, 77, 0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: typography.display.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radii.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardUnread: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    backgroundColor: colors.notificationUnreadBg,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: typography.display.semibold,
    color: colors.text,
  },
  cardBody: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 20,
  },
  cardDate: {
    fontSize: 12,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    marginTop: 6,
  },
});
