import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import type { CardioStep } from '../../lib/cardio';

type CardioProtocolProps = {
  /** From `cardioProtocol()`. Never rendered empty — the caller checks for null. */
  steps: CardioStep[];
  style?: StyleProp<ViewStyle>;
};

/**
 * The shape of an interval session, as three lines she can follow off the
 * screen.
 *
 * The clock beside this counts one continuous nineteen minutes, because that is
 * what the plan sends and what the movement pillar logs. This is what makes
 * those nineteen minutes an interval session rather than a shorter walk — it is
 * the instruction, and the countdown is only the container it happens in.
 *
 * Deliberately not a second timer. Three rounds of thirty seconds inside a
 * warm-up she is told to take "5 to 10 minutes" over cannot be put on rails
 * without inventing a boundary the plan did not give, and a clock that started
 * a hard round while she was still walking to the top of the hill would be
 * worse than no clock at all.
 */
export function CardioProtocol({ steps, style }: CardioProtocolProps) {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.head}>How it goes</Text>
      {steps.map((step, index) => (
        <View key={step.label} style={styles.row}>
          <View style={styles.marker}>
            <Text style={styles.markerText}>{index + 1}</Text>
          </View>
          <View style={styles.text}>
            <Text style={styles.label}>{step.label}</Text>
            <Text style={styles.detail}>{step.detail}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  head: {
    ...typography.presets.label,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  marker: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    // rgba, never an 8-digit hex — Android renders #RRGGBBAA flat grey.
    backgroundColor: 'rgba(244, 124, 151, 0.14)',
  },
  markerText: {
    ...typography.presets.caption,
    fontFamily: typography.family.semibold,
    color: colors.primaryDark,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    ...typography.presets.bodyMedium,
    color: colors.text,
  },
  detail: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },
});
