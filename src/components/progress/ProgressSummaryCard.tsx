import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing, typography } from '../../theme/tokens';
import { toPercent, type PlanHistory } from '../../lib/planHistoryTypes';
import { AnimatedPressable } from '../AnimatedPressable';
import { PillarRing } from './PillarRing';

type ProgressSummaryCardProps = {
  history: PlanHistory;
  onPress: () => void;
};

/**
 * The way into the grid from the rewards screen.
 *
 * Rewards is what she has *earned* — lifetime badges, XP, a streak that
 * survives a rough week. This is what she has *done*, against the plan she was
 * given. They answer different questions and merging them would blunt both, so
 * this stays one card with a link rather than a section.
 *
 * The strip is every elapsed day at a glance: enough to make the grid worth
 * opening, deliberately too small to read as a judgement.
 */
export function ProgressSummaryCard({ history, onPress }: ProgressSummaryCardProps) {
  const { overall, weeks, daysElapsed, currentWeek, totalWeeks } = history;

  const elapsed = weeks.flatMap((week) => week.days).filter((day) => day.state !== 'future');

  return (
    <AnimatedPressable
      containerStyle={styles.pressable}
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Your progress. ${toPercent(overall.score)} percent across ${daysElapsed} days.`}
    >
      <View style={styles.top}>
        <PillarRing
          movement={overall.movement?.ratio ?? null}
          nutrition={overall.nutrition?.ratio ?? null}
          relaxation={overall.relaxation?.ratio ?? null}
          size={52}
          strokeWidth={5}
        >
          <Text style={styles.percent} allowFontScaling={false}>
            {toPercent(overall.score)}
          </Text>
        </PillarRing>

        <View style={styles.text}>
          <Text style={styles.title}>Your progress</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            Week {currentWeek} of {totalWeeks} · {daysElapsed}{' '}
            {daysElapsed === 1 ? 'day' : 'days'} in
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>

      <View style={styles.strip}>
        {elapsed.map((day) => (
          <View
            key={day.date}
            style={[
              styles.tick,
              // Height, not colour: the strip has to stay legible at four
              // pixels wide, and a missed day must not read as a red mark.
              { height: 6 + Math.round(day.score * 12) },
              day.score > 0 && styles.tickDone,
            ]}
          />
        ))}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...shadows.card,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: {
    flex: 1,
  },
  percent: {
    fontFamily: typography.display.bold,
    fontSize: 15,
    color: colors.text,
  },
  title: {
    ...typography.presets.heading3,
    color: colors.text,
  },
  subtitle: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 18,
  },
  tick: {
    flex: 1,
    minWidth: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.plumSoft,
  },
  tickDone: {
    backgroundColor: colors.primaryLight,
  },
});
