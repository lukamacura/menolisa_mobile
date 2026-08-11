import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import { tierName } from '../../lib/rewardVisuals';
import type { Achievement } from '../../lib/rewardTypes';
import { BadgeMedal } from './BadgeMedal';

type BadgeTileProps = {
  achievement: Achievement;
  onPress: (achievement: Achievement) => void;
};

/** One badge in the rewards grid. */
export function BadgeTile({ achievement, onPress }: BadgeTileProps) {
  const { unlocked, complete, tier, maxTier, name, value, target } = achievement;

  const caption = complete
    ? 'Complete'
    : target !== null
      ? `${formatCount(value)} / ${formatCount(target)}`
      : '';

  return (
    <Pressable
      style={styles.tile}
      onPress={() => onPress(achievement)}
      accessibilityRole="button"
      accessibilityLabel={
        unlocked
          ? `${name}, ${tierName(tier, maxTier)}, level ${tier} of ${maxTier}. ${caption}`
          : `${name}, locked. ${caption}`
      }
    >
      <BadgeMedal
        familyId={achievement.id}
        unlocked={unlocked}
        progress={achievement.progress}
        size={64}
      />
      <Text style={[styles.name, !unlocked && styles.nameLocked]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.tier} numberOfLines={1}>
        {unlocked ? `${tierName(tier, maxTier)} · ${tier}/${maxTier}` : 'Locked'}
      </Text>
      {caption ? (
        <Text style={styles.caption} numberOfLines={1}>
          {caption}
        </Text>
      ) : (
        <View style={styles.captionSpacer} />
      )}
    </Pressable>
  );
}

/** 1200 → "1.2k". Keeps a four-digit target from wrapping a narrow tile. */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  const thousands = n / 1000;
  return `${thousands % 1 === 0 ? thousands : thousands.toFixed(1)}k`;
}

const styles = StyleSheet.create({
  tile: {
    // Exactly three across, with the breathing room as padding inside the tile
    // rather than as a gap between tiles. A percentage width plus a percentage
    // column gap can sum past 100% on a narrow phone and drop the grid to two
    // per row; thirds always fit.
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    borderRadius: radii.lg,
  },
  name: {
    ...typography.presets.label,
    color: colors.text,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  nameLocked: {
    color: colors.textMuted,
  },
  tier: {
    ...typography.presets.caption,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  caption: {
    ...typography.presets.caption,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  captionSpacer: {
    height: 18,
  },
});
