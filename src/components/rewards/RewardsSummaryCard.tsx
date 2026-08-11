import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing, typography } from '../../theme/tokens';
import type { RewardsPayload } from '../../lib/rewardTypes';
import { ProgressRing } from '../plan/ProgressRing';

type RewardsSummaryCardProps = {
  rewards: RewardsPayload;
  onPress: () => void;
};

/**
 * Streak, today's goal and level, as the first thing on the Today screen.
 *
 * The streak is the reason this sits above the plan rather than inside a
 * rewards tab: a run of days only holds behaviour if she is reminded it exists
 * before she decides whether to bother today.
 */
export function RewardsSummaryCard({ rewards, onPress }: RewardsSummaryCardProps) {
  const { streak, xp, level } = rewards;

  // Before her first tick of the day the run still counts to yesterday, so it
  // is honest to show the number but not to imply today is banked.
  const streakLabel = streak.current === 1 ? '1 day streak' : `${streak.current} day streak`;
  const streakHint = streak.current === 0
    ? 'Start one today'
    : streak.activeToday
      ? 'Locked in for today'
      : 'Log one thing to keep it';

  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Rewards. ${streakLabel}. ${xp.today} of ${xp.goal} XP today. Level ${level.level}, ${level.name}.`}
    >
      <View style={styles.topRow}>
        <View style={styles.streakBlock}>
          <View style={styles.flameRow}>
            <Ionicons
              name="flame"
              size={26}
              color={streak.activeToday ? '#F4623A' : colors.textMuted}
            />
            <Text style={styles.streakNumber}>{streak.current}</Text>
          </View>
          <Text style={styles.streakLabel}>{streakLabel}</Text>
          <Text style={styles.streakHint}>{streakHint}</Text>
        </View>

        <View style={styles.goalBlock}>
          <ProgressRing
            value={xp.today}
            total={xp.goal}
            size={64}
            strokeWidth={6}
            color={colors.lavender}
            label={`${xp.today}`}
          />
          <Text style={styles.goalLabel}>of {xp.goal} XP today</Text>
        </View>
      </View>

      <View style={styles.levelBlock}>
        <View style={styles.levelRow}>
          <Text style={styles.levelName}>
            {level.name} · Level {level.level}
          </Text>
          <Text style={styles.levelToNext}>{level.toNext} XP to go</Text>
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              // Percentage width: the track is flex-sized, so an absolute width
              // computed here would be wrong on every screen but the one it was
              // measured on.
              { width: `${Math.round(Math.min(1, Math.max(0, level.progress)) * 100)}%` },
            ]}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>View rewards</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  streakBlock: {
    flex: 1,
  },
  flameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  streakNumber: {
    ...typography.presets.heading1,
    fontSize: 32,
    lineHeight: 38,
    color: colors.text,
  },
  streakLabel: {
    ...typography.presets.bodyMedium,
    color: colors.text,
    marginTop: 2,
  },
  streakHint: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },
  goalBlock: {
    alignItems: 'center',
    maxWidth: 110,
  },
  goalLabel: {
    ...typography.presets.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  levelBlock: {
    marginTop: spacing.lg,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  levelName: {
    ...typography.presets.label,
    color: colors.text,
    flexShrink: 1,
  },
  levelToNext: {
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
    backgroundColor: colors.lavender,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    marginTop: spacing.md,
  },
  footerText: {
    ...typography.presets.buttonSmall,
    color: colors.primary,
  },
});
