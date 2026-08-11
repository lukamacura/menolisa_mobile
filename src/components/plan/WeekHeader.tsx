import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import { daysBetween } from '../../lib/planApi';
import { PLAN_WEEKS, type PlanWeek } from '../../lib/planTypes';

type WeekHeaderProps = {
  date: string;
  startedAt: string;
  currentWeek: number;
  week: PlanWeek | null;
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
export function WeekHeader({ date, startedAt, currentWeek, week }: WeekHeaderProps) {
  const dayNumber = daysBetween(startedAt, date) + 1;
  const finished = dayNumber > PLAN_WEEKS * 7;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.date}>{formatLongDate(date)}</Text>
        <View style={styles.dayChip}>
          <Text style={styles.dayChipText}>
            {finished ? `Day ${dayNumber}` : `Day ${dayNumber} · Week ${currentWeek}`}
          </Text>
        </View>
      </View>

      {week?.title ? <Text style={styles.title}>{week.title}</Text> : null}
      {week?.focus ? <Text style={styles.focus}>{week.focus}</Text> : null}

      {finished ? (
        <Text style={styles.finished}>
          You&apos;ve finished the eight weeks. Everything here still counts — keep going.
        </Text>
      ) : (
        <View style={styles.dots} accessibilityLabel={`Week ${currentWeek} of ${PLAN_WEEKS}`}>
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
        </View>
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
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
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
