import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetchWithAuth, API_CONFIG } from '../../lib/api';
import { getNativeExpoNotifications } from '../../lib/expoNotificationsGate';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';
import { NotificationPrefsSkeleton, ContentTransition } from '../../components/skeleton';

export function NotificationPrefsScreen() {
  const reduceMotion = useReduceMotion();
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [weeklyInsightsEnabled, setWeeklyInsightsEnabled] = useState(true);
  const [systemPermissionDenied, setSystemPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetchWithAuth(API_CONFIG.endpoints.notificationsPreferences);
      const data = res?.data;
      if (data) {
        setNotificationEnabled(data.notification_enabled ?? true);
        setWeeklyInsightsEnabled(data.weekly_insights_enabled ?? true);
      }
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const Notifications = getNativeExpoNotifications();
    if (!Notifications) return;
    Notifications.getPermissionsAsync()
      .then(({ status }) => setSystemPermissionDenied(status === 'denied'))
      .catch(() => setSystemPermissionDenied(false));
  }, []);

  const updatePref = useCallback(
    async (key: 'notification_enabled' | 'weekly_insights_enabled', value: boolean) => {
      if (key === 'notification_enabled') setNotificationEnabled(value);
      else setWeeklyInsightsEnabled(value);
      setSaving(true);
      try {
        await apiFetchWithAuth(API_CONFIG.endpoints.notificationsPreferences, {
          method: 'PUT',
          body: JSON.stringify({
            notification_enabled: key === 'notification_enabled' ? value : notificationEnabled,
            weekly_insights_enabled: key === 'weekly_insights_enabled' ? value : weeklyInsightsEnabled,
          }),
        });
      } catch {
        if (key === 'notification_enabled') setNotificationEnabled(!value);
        else setWeeklyInsightsEnabled(!value);
      } finally {
        setSaving(false);
      }
    },
    [notificationEnabled, weeklyInsightsEnabled]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <NotificationPrefsSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ContentTransition>
      <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
        <Text style={styles.title}>Notification preferences</Text>
      </StaggeredZoomIn>
      <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
        <View style={styles.section}>
          {systemPermissionDenied ? (
            <View style={styles.systemBanner}>
              <Text style={styles.systemBannerTitle}>Notifications are blocked in system settings</Text>
              <Text style={styles.systemBannerText}>
                Enable notifications in your device settings to receive alerts from Lisa.
              </Text>
              <TouchableOpacity activeOpacity={0.8} onPress={() => Linking.openSettings()}>
                <Text style={styles.systemBannerLink}>Open settings</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Notifications</Text>
            <Switch
              value={notificationEnabled}
              onValueChange={(v) => updatePref('notification_enabled', v)}
              disabled={saving}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={notificationEnabled ? colors.primary : colors.textMuted}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Weekly summary from Lisa</Text>
            <Switch
              value={weeklyInsightsEnabled}
              onValueChange={(v) => updatePref('weekly_insights_enabled', v)}
              disabled={saving}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={weeklyInsightsEnabled ? colors.primary : colors.textMuted}
            />
          </View>
        </View>
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
  title: {
    fontSize: 20,
    fontFamily: typography.family.bold,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  section: {
    paddingHorizontal: spacing.lg,
  },
  systemBanner: {
    backgroundColor: colors.rowGoldBg,
    borderColor: 'rgba(255, 179, 138, 0.80)',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  systemBannerTitle: {
    fontSize: 14,
    fontFamily: typography.family.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  systemBannerText: {
    fontSize: 13,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
  },
  systemBannerLink: {
    fontSize: 13,
    fontFamily: typography.family.semibold,
    color: colors.primary,
    marginTop: spacing.sm,
    textDecorationLine: 'underline',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.rowBlueBg,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(58, 191, 163, 0.60)',
  },
  rowLabel: {
    fontSize: 16,
    fontFamily: typography.family.medium,
    color: colors.text,
  },
});
