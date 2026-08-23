import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme/tokens';
import { toPercent, type DayProgress, type WeekProgress } from '../../lib/planHistoryTypes';
import { DayCell } from './DayCell';

type WeekRowProps = {
  week: WeekProgress;
  /** Column width, computed once by the grid so every row lines up. */
  cellWidth: number;
  onDayPress: (day: DayProgress) => void;
};

/**
 * One plan week: a title line and its seven days.
 *
 * Rows are plan weeks, not calendar weeks. Her plan runs from `startedAt`, so a
 * Monday-to-Sunday month grid would cut every week in half and leave the first
 * row half empty — the eight rows here are exactly the eight weeks the plan
 * promised her, and the column weekdays stay constant because week 2 begins on
 * the same weekday week 1 did.
 */
export function WeekRow({ week, cellWidth, onDayPress }: WeekRowProps) {
  const locked = week.state === 'locked';

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={styles.number}>Week {week.number}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {week.title}
        </Text>
        {locked ? (
          <Text style={styles.locked}>—</Text>
        ) : (
          <Text style={styles.percent}>{toPercent(week.score)}%</Text>
        )}
      </View>

      <View style={styles.days}>
        {week.days.map((day) => (
          <DayCell key={day.date} day={day} width={cellWidth} onPress={onDayPress} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    marginBottom: 6,
  },
  number: {
    ...typography.presets.caption,
    fontFamily: typography.family.semibold,
    color: colors.text,
  },
  title: {
    flex: 1,
    ...typography.presets.caption,
    color: colors.textMuted,
  },
  percent: {
    ...typography.presets.caption,
    fontFamily: typography.family.semibold,
    color: colors.text,
  },
  locked: {
    ...typography.presets.caption,
    color: colors.borderStrong,
  },
  days: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
