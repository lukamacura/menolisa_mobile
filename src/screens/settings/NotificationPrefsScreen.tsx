import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetchWithAuth, API_CONFIG } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useNotificationPermission } from '../../context/NotificationPermissionContext';
import { useReminderPrefs } from '../../hooks/useReminderPrefs';
import {
  EVENING_CHOICES,
  MORNING_CHOICES,
  MOVEMENT_CHOICES,
  formatTime,
  sameTime,
  saveReminderPrefs,
} from '../../lib/reminders/prefs';
import { TRAINING_TIMES, WATER_HOUR } from '../../lib/reminders/select';
import type { HourMinute, ReminderPrefs } from '../../lib/reminders/types';
import { colors, spacing, radii, typography, minTouchTarget } from '../../theme/tokens';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';
import { NotificationPrefsSkeleton, ContentTransition } from '../../components/skeleton';

/**
 * Everything she can turn on or off, in the two groups that actually differ.
 *
 * **On this device** are the local reminders (`src/lib/reminders`) — scheduled
 * by the phone, in her timezone, and switched here with no round trip at all.
 * **From Lisa** is the one thing still sent from a server, because it is the one
 * thing the phone cannot work out on its own.
 *
 * The permission banner at the top is not decoration. Before it existed, a woman
 * who tapped "Not now" at the first prompt was never asked again by anything,
 * while these switches went on showing "on" — the app was silent and the
 * settings screen said otherwise. Any state that is not `granted` now has a way
 * out of it from here.
 */
export function NotificationPrefsScreen() {
  const reduceMotion = useReduceMotion();
  const { status: permission, request, refresh } = useNotificationPermission();
  const { accountStatus } = useAuth();
  const reminders = useReminderPrefs();

  /**
   * The movement row shows a time even when she has never set one, because the
   * quiz already asked her — leaving it blank would ask a second time, and a row
   * with nothing selected reads as something she has forgotten to do.
   */
  const movementAt =
    reminders?.movement ?? TRAINING_TIMES[accountStatus?.training_time ?? 'evening'];

  const [weeklyInsightsEnabled, setWeeklyInsightsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetchWithAuth(API_CONFIG.endpoints.notificationsPreferences);
      const data = res?.data;
      if (data) {
        // Either column being off means she has opted out of the recap — the
        // switch below writes both, but accounts predating it may hold only one.
        setWeeklyInsightsEnabled(
          (data.notification_enabled ?? true) && (data.weekly_insights_enabled ?? true)
        );
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

  // She may have changed the OS setting while she was away in system settings.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  /**
   * Writes both columns to the same value on purpose.
   *
   * `notification_enabled` is the master the recap cron filters on, and the
   * recap is now the only non-money alert it sends. Leaving that column
   * reachable only by an older build's switch is how an account ends up
   * permanently excluded from an alert its one visible switch says is on.
   */
  const updateWeekly = useCallback(async (value: boolean) => {
    setWeeklyInsightsEnabled(value);
    setSaving(true);
    try {
      await apiFetchWithAuth(API_CONFIG.endpoints.notificationsPreferences, {
        method: 'PUT',
        body: JSON.stringify({
          notification_enabled: value,
          weekly_insights_enabled: value,
        }),
      });
    } catch {
      setWeeklyInsightsEnabled(!value);
    } finally {
      setSaving(false);
    }
  }, []);

  /** Local prefs are applied before they are persisted — the scheduler reacts at once. */
  const updateReminders = useCallback(
    (patch: Partial<ReminderPrefs>) => {
      if (!reminders) return;
      saveReminderPrefs({ ...reminders, ...patch });
    },
    [reminders]
  );

  if (loading || !reminders) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <NotificationPrefsSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Scrollable since the reminder section landed: the time rows push this
          past the fold on a small phone, and the switches were unreachable. */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
      <ContentTransition>
        <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
          <Text style={styles.title}>Notification preferences</Text>
        </StaggeredZoomIn>

        <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
          <View style={styles.section}>
            {permission !== 'granted' ? (
              <PermissionBanner status={permission} onEnable={request} />
            ) : null}

            <Text style={styles.sectionTitle}>On this device</Text>
            <View style={styles.row}>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowLabel}>Daily reminders</Text>
                <Text style={styles.rowHint}>
                  Your plan in the morning, then your water or your movement later on.
                  Never more than two a day, and none at all once you are done.
                </Text>
              </View>
              <Switch
                value={reminders.enabled}
                onValueChange={(v) => updateReminders({ enabled: v })}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={reminders.enabled ? colors.primary : colors.textMuted}
              />
            </View>

            {reminders.enabled ? (
              <>
                <TimeChoice
                  label="Morning"
                  hint="When the day's plan lands."
                  value={reminders.morning}
                  choices={MORNING_CHOICES}
                  onChange={(morning) => updateReminders({ morning })}
                />
                <TimeChoice
                  label="Evening"
                  hint="A streak worth keeping, or a new week starting."
                  value={reminders.evening}
                  choices={EVENING_CHOICES}
                  onChange={(evening) => updateReminders({ evening })}
                />
                <TimeChoice
                  label="Movement"
                  hint={
                    reminders.movement
                      ? 'When your session is still open.'
                      : `When your session is still open — set from your quiz answer, ${formatTime(movementAt)}.`
                  }
                  value={movementAt}
                  choices={MOVEMENT_CHOICES}
                  onChange={(movement) => updateReminders({ movement })}
                />
                <Text style={styles.footnote}>
                  The water check lands at {formatTime(WATER_HOUR)}, and only on a day you have
                  already started.
                </Text>
              </>
            ) : null}

            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>From Lisa</Text>
            <View style={styles.row}>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowLabel}>Weekly summary</Text>
                <Text style={styles.rowHint}>
                  One recap of the seven days behind you, on Sunday evening.
                </Text>
              </View>
              <Switch
                value={weeklyInsightsEnabled}
                onValueChange={updateWeekly}
                disabled={saving}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={weeklyInsightsEnabled ? colors.primary : colors.textMuted}
              />
            </View>

            {/* This one ignores every switch above it, server-side, so saying so
                here is the only thing that keeps the screen honest. */}
            <Text style={styles.footnote}>
              Alerts about your payment and access are always sent.
            </Text>
          </View>
        </StaggeredZoomIn>
      </ContentTransition>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * The way back from a silent app.
 *
 * The two states need different exits and it is worth the branch: `undetermined`
 * can still be resolved by the system prompt, which is one tap. `denied` cannot
 * — iOS only offers that dialog once — so the only honest thing to offer is the
 * trip to system settings.
 */
function PermissionBanner({
  status,
  onEnable,
}: {
  status: 'undetermined' | 'denied';
  onEnable: () => void;
}) {
  const blocked = status === 'denied';
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerTitle}>
        {blocked ? 'Notifications are turned off' : 'Notifications are not on yet'}
      </Text>
      <Text style={styles.bannerText}>
        {blocked
          ? 'Your phone is blocking them, so nothing below can reach you until you turn them back on.'
          : 'Nothing below can reach you until you allow them. It takes one tap.'}
      </Text>
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.bannerButton}
        onPress={blocked ? () => Linking.openSettings() : onEnable}
      >
        <Text style={styles.bannerButtonText}>
          {blocked ? 'Open settings' : 'Turn on notifications'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * A row of times rather than a wheel picker.
 *
 * Three choices she can read at a glance and hit in one tap, against a scroll
 * wheel that needs two gestures and a confirm. There is no answer here precise
 * enough to be worth a minute hand.
 */
function TimeChoice({
  label,
  hint,
  value,
  choices,
  onChange,
}: {
  label: string;
  hint: string;
  value: HourMinute;
  choices: HourMinute[];
  onChange: (time: HourMinute) => void;
}) {
  return (
    <View style={styles.timeRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowHint}>{hint}</Text>
      <View style={styles.chips}>
        {choices.map((choice) => {
          const selected = sameTime(choice, value);
          return (
            <TouchableOpacity
              key={`${choice.hour}:${choice.minute}`}
              activeOpacity={0.85}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onChange(choice)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {formatTime(choice)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingBottom: spacing['2xl'],
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
  sectionTitle: {
    ...typography.presets.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  sectionTitleSpaced: {
    marginTop: spacing.lg,
  },
  banner: {
    backgroundColor: colors.rowGoldBg,
    borderColor: 'rgba(255, 179, 138, 0.80)',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bannerTitle: {
    fontSize: 14,
    fontFamily: typography.family.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  bannerText: {
    fontSize: 13,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
  },
  bannerButton: {
    minHeight: minTouchTarget,
    justifyContent: 'center',
  },
  bannerButtonText: {
    fontSize: 13,
    fontFamily: typography.family.semibold,
    color: colors.primary,
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
  rowTextWrap: {
    flex: 1,
    paddingRight: spacing.md,
  },
  rowLabel: {
    fontSize: 16,
    fontFamily: typography.family.medium,
    color: colors.text,
  },
  rowHint: {
    ...typography.presets.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  timeRow: {
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  chip: {
    minHeight: minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.notificationIconPrimarySoft,
  },
  chipText: {
    ...typography.presets.buttonSmall,
    color: colors.textMuted,
  },
  chipTextSelected: {
    color: colors.primaryDark,
  },
  footnote: {
    ...typography.presets.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
});
