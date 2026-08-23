import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget } from '../../theme/tokens';
import { daysBetween } from '../../lib/planApi';
import { PLAN_WEEKS, type PlanWeek } from '../../lib/planTypes';

type WeekHeaderProps = {
  date: string;
  startedAt: string;
  currentWeek: number;
  week: PlanWeek | null;
  /**
   * Open the progress grid on today. Omit to leave the day chip inert — the
   * chip is a label first, and a screen that has nowhere to send her should not
   * pretend to be tappable.
   */
  onOpenDay?: () => void;
  /** Open the progress grid on this week. Same rule as `onOpenDay`. */
  onOpenWeek?: () => void;
};

/** "Tuesday, 11 August" in the device's locale, from a YYYY-MM-DD string. */
function formatLongDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * The top of the daily loop: what day of the plan this is, this week's title,
 * and the one line of focus the model wrote for the week.
 *
 * Past day 56 the server clamps `currentWeek` to 8 forever, so the plan keeps
 * rendering. Rather than let her sit in a week 8 that never ends, we name it.
 */
export function WeekHeader({
  date,
  startedAt,
  currentWeek,
  week,
  onOpenDay,
  onOpenWeek,
}: WeekHeaderProps) {
  const dayNumber = daysBetween(startedAt, date) + 1;
  const finished = dayNumber > PLAN_WEEKS * 7;

  const dayLabel = finished ? `Day ${dayNumber}` : `Day ${dayNumber} · Week ${currentWeek}`;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.date}>{formatLongDate(date)}</Text>
        <Pressable
          style={({ pressed }) => [
            styles.dayChip,
            onOpenDay && styles.dayChipLink,
            pressed && onOpenDay && styles.pressed,
          ]}
          onPress={onOpenDay}
          disabled={!onOpenDay}
          hitSlop={8}
          accessibilityRole={onOpenDay ? 'button' : undefined}
          accessibilityLabel={onOpenDay ? `${dayLabel}. See your progress.` : dayLabel}
        >
          <Text style={styles.dayChipText}>{dayLabel}</Text>
          {onOpenDay ? (
            <Ionicons name="chevron-forward" size={12} color={colors.primaryDark} />
          ) : null}
        </Pressable>
      </View>

      {week?.title ? <Text style={styles.title}>{week.title}</Text> : null}
      {week?.focus ? <Text style={styles.focus}>{week.focus}</Text> : null}

      {finished ? (
        <Text style={styles.finished}>
          You&apos;ve finished the eight weeks. Everything here still counts — keep going.
        </Text>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.dots, pressed && onOpenWeek && styles.pressed]}
          onPress={onOpenWeek}
          disabled={!onOpenWeek}
          hitSlop={8}
          accessibilityRole={onOpenWeek ? 'button' : undefined}
          accessibilityLabel={
            onOpenWeek
              ? `Week ${currentWeek} of ${PLAN_WEEKS}. See your progress.`
              : `Week ${currentWeek} of ${PLAN_WEEKS}`
          }
        >
          {Array.from({ length: PLAN_WEEKS }, (_, index) => index + 1).map((weekNumber) => (
            <View
              key={weekNumber}
              style={[
                styles.dot,
                weekNumber < currentWeek && styles.dotPast,
                weekNumber === currentWeek && styles.dotCurrent,
              ]}
            />
          ))}
          <Text style={styles.dotsLabel}>
            Week {currentWeek} of {PLAN_WEEKS}
          </Text>
          {onOpenWeek ? (
            <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />
          ) : null}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  date: {
    ...typography.presets.label,
    color: colors.textMuted,
    flexShrink: 1,
  },
  dayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  /** Only when it goes somewhere. A chip that looks tappable and isn't is worse than a plain one. */
  dayChipLink: {
    borderColor: colors.primaryLight,
  },
  pressed: {
    opacity: 0.6,
  },
  dayChipText: {
    ...typography.presets.caption,
    fontFamily: typography.family.semibold,
    color: colors.primaryDark,
  },
  title: {
    ...typography.presets.heading1,
    color: colors.text,
    marginBottom: 2,
  },
  focus: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
  },
  finished: {
    ...typography.presets.bodySmall,
    color: colors.primaryDark,
    marginTop: spacing.sm,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.md,
    minHeight: minTouchTarget - spacing.md,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  dotPast: {
    backgroundColor: colors.primaryLight,
  },
  dotCurrent: {
    backgroundColor: colors.primary,
    width: 18,
  },
  dotsLabel: {
    ...typography.presets.caption,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
});
