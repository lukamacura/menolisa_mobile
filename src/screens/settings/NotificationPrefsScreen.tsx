import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetchWithAuth, API_CONFIG } from '../../lib/api';
import { colors, spacing, radii, typography } from '../../theme/tokens';

export function NotificationPrefsScreen() {
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [weeklyInsightsEnabled, setWeeklyInsightsEnabled] = useState(true);
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
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Notification preferences</Text>
      <View style={styles.section}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.rowBlueBg,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.blue + '99',
  },
  rowLabel: {
    fontSize: 16,
    fontFamily: typography.family.medium,
    color: colors.text,
  },
});
