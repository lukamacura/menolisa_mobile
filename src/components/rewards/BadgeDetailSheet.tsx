import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, minTouchTarget, radii, shadows, spacing, typography } from '../../theme/tokens';
import { badgeVisual, tierLabel, tierName } from '../../lib/rewardVisuals';
import type { Achievement } from '../../lib/rewardTypes';
import { BadgeMedal } from './BadgeMedal';
import { formatCount } from './BadgeTile';

type BadgeDetailSheetProps = {
  achievement: Achievement | null;
  onClose: () => void;
};

/**
 * What one badge is, where she is on it, and what the next tier takes.
 *
 * Shows the ladder rather than only the next rung: seeing that Wildfire runs to
 * 365 days is the point of a tiered badge, and a card that only ever says
 * "7 more" hides the reason to keep going.
 */
export function BadgeDetailSheet({ achievement, onClose }: BadgeDetailSheetProps) {
  if (!achievement) return null;

  const { name, blurb, tier, maxTier, value, target, floor, goal, complete, unlocked } = achievement;
  const tint = unlocked ? badgeVisual(achievement.id).tint : colors.textMuted;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        {/* Stops a tap inside the sheet from closing it. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />

          <BadgeMedal
            familyId={achievement.id}
            unlocked={unlocked}
            progress={achievement.progress}
            size={96}
            style={styles.medal}
          />

          <Text style={styles.name}>{name}</Text>
          <Text style={[styles.tier, { color: tint }]}>
            {unlocked ? `${tierName(tier, maxTier)} · ${tierLabel(tier, maxTier)}` : 'Not yet earned'}
          </Text>
          <Text style={styles.blurb}>{blurb}</Text>

          {complete ? (
            <View style={styles.completeRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.completeText}>Every level earned</Text>
            </View>
          ) : (
            <View style={styles.progressBlock}>
              <View style={styles.progressRow}>
                <Text style={styles.goal}>{goal}</Text>
                <Text style={styles.counts}>
                  {formatCount(value)} / {formatCount(target ?? 0)}
                </Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${Math.round(achievement.progress * 100)}%`,
                      backgroundColor: tint,
                    },
                  ]}
                />
              </View>
              {floor > 0 ? (
                <Text style={styles.floorNote}>Last level cleared at {formatCount(floor)}</Text>
              ) : null}
            </View>
          )}

          <Pressable
            style={styles.button}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.buttonText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(31, 27, 45, 0.5)',
  },
  sheet: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    // Clears the home indicator without needing insets inside a modal.
    paddingBottom: spacing['2xl'] + spacing.md,
    ...shadows.card,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.lg,
  },
  medal: {
    marginBottom: spacing.md,
  },
  name: {
    ...typography.presets.heading2,
    color: colors.text,
    textAlign: 'center',
  },
  tier: {
    ...typography.presets.label,
    marginTop: 2,
    textAlign: 'center',
  },
  blurb: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  progressBlock: {
    alignSelf: 'stretch',
    marginTop: spacing.lg,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  goal: {
    ...typography.presets.label,
    color: colors.text,
    flexShrink: 1,
  },
  counts: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },
  track: {
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.plumSoft,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  floorNote: {
    ...typography.presets.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  completeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  completeText: {
    ...typography.presets.label,
    color: colors.success,
  },
  button: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    ...shadows.buttonPrimary,
  },
  buttonText: {
    ...typography.presets.button,
    color: colors.textInverse,
  },
});
