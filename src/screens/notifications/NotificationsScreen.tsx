import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiFetchWithAuth, API_CONFIG, openWebDashboard } from '../../lib/api';
import { colors, spacing, radii, typography, shadows } from '../../theme/tokens';

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
};

/** Map notification type to icon and colors (UX: clear, logical, consistent with app) */
function getNotificationStyle(type: string | null): {
  icon: string;
  iconColor: string;
  bgColor: string;
} {
  const t = (type || '').toLowerCase();
  switch (t) {
    case 'reminder':
      return { icon: 'alarm-outline', iconColor: colors.primary, bgColor: 'rgba(255, 141, 161, 0.12)' };
    case 'weekly_insights':
      return { icon: 'analytics-outline', iconColor: colors.navy, bgColor: 'rgba(29, 53, 87, 0.08)' };
    case 'lisa_message':
      return { icon: 'chatbubble-ellipses-outline', iconColor: colors.primary, bgColor: 'rgba(255, 141, 161, 0.12)' };
    case 'achievement':
      return { icon: 'trophy-outline', iconColor: colors.gold, bgColor: 'rgba(255, 235, 118, 0.25)' };
    case 'trial':
      return { icon: 'time-outline', iconColor: colors.primary, bgColor: 'rgba(255, 141, 161, 0.12)' };
    case 'welcome':
      return { icon: 'hand-left-outline', iconColor: colors.primary, bgColor: 'rgba(255, 141, 161, 0.12)' };
    case 'success':
      return { icon: 'checkmark-circle-outline', iconColor: colors.success, bgColor: 'rgba(16, 185, 129, 0.12)' };
    case 'error':
      return { icon: 'alert-circle-outline', iconColor: colors.danger, bgColor: colors.dangerBg };
    default:
      return { icon: 'notifications-outline', iconColor: colors.textMuted, bgColor: 'rgba(17, 24, 39, 0.06)' };
  }
}

/** Display title when notification has no title; same copy intent as in-app/push */
function getDisplayTitle(item: NotificationItem): string {
  if (item.title && item.title.trim()) return item.title;
  const t = (item.type || '').toLowerCase();
  switch (t) {
    case 'trial':
      return 'Trial';
    case 'reminder':
      return 'Reminder';
    case 'weekly_insights':
      return 'What Lisa noticed';
    case 'lisa_message':
      return 'Message from Lisa';
    case 'achievement':
      return 'Achievement';
    case 'welcome':
      return 'Welcome';
    case 'success':
      return 'Success';
    case 'error':
      return 'Notice';
    default:
      return 'Notification';
  }
}

export function NotificationsScreen() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [notifRes, countRes] = await Promise.all([
        apiFetchWithAuth(`${API_CONFIG.endpoints.notifications}?limit=50`),
        apiFetchWithAuth(API_CONFIG.endpoints.notificationsUnreadCount),
      ]);
      setItems(notifRes?.data ?? []);
      setUnreadCount(countRes?.count ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const markAllRead = async () => {
    try {
      await apiFetchWithAuth(API_CONFIG.endpoints.notifications, {
        method: 'PUT',
        body: JSON.stringify({ markAllRead: true }),
      });
      load();
    } catch {
      // ignore
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity activeOpacity={0.8} onPress={markAllRead} style={styles.markReadTouchable}>
            <Text style={styles.markRead}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={20} color={colors.danger} style={styles.errorIcon} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
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
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyText}>When Lisa or the app sends you updates, they’ll show here.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const style = getNotificationStyle(item.type);
          const isTrial = item.type === 'trial';
          const onPress = isTrial
            ? () => openWebDashboard().catch(() => {})
            : undefined;
          const Wrapper = onPress ? TouchableOpacity : View;
          const wrapperProps = onPress ? { activeOpacity: 0.7, onPress } : {};
          return (
            <Wrapper style={[styles.card, !item.seen && styles.cardUnread]} {...wrapperProps}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDF8FA',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: 16,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontFamily: typography.family.bold,
    color: colors.text,
  },
  markReadTouchable: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  markRead: {
    fontSize: 14,
    fontFamily: typography.family.semibold,
    color: colors.primary,
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
    borderColor: 'rgba(220, 38, 38, 0.2)',
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
    backgroundColor: 'rgba(17, 24, 39, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: typography.family.semibold,
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
    backgroundColor: 'rgba(255, 141, 161, 0.04)',
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
    fontFamily: typography.family.semibold,
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
