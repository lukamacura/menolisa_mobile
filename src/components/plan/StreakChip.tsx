import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography } from '../../theme/tokens';

type StreakChipProps = {
  streak: number;
  bestStreak: number;
};

/**
 * A run of days, and her best if she is currently below it.
 *
 * Renders nothing at zero. A "0-day streak" on ten rows is ten small failures
 * before she has done anything, and the row already shows an empty control.
 */
export function StreakChip({ streak, bestStreak }: StreakChipProps) {
  if (streak <= 0) return null;

  return (
    <View style={styles.chip}>
      <Ionicons name="flame" size={12} color={colors.primaryDark} />
      <Text style={styles.text}>
        {streak}
        {bestStreak > streak ? ` · best ${bestStreak}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(244, 124, 151, 0.12)',
  },
  text: {
    ...typography.presets.caption,
    fontFamily: typography.family.semibold,
    color: colors.primaryDark,
  },
});
