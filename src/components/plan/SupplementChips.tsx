import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radii, typography } from '../../theme/tokens';

type SupplementChipsProps = {
  supplements: { id: string; label: string }[];
};

/**
 * The three supplements, revealed once the row is ticked.
 *
 * Display only — never counted, never posted. They exist to name the three that
 * matter, so even skipping them teaches her something. Same bargain the funnel
 * makes, and the reason they are not their own tickable rows.
 */
export function SupplementChips({ supplements }: SupplementChipsProps) {
  if (supplements.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {supplements.map((supplement) => (
        <View key={supplement.id} style={styles.chip}>
          <Text style={styles.text}>{supplement.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    paddingLeft: spacing.sm + 34 + spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },
});
