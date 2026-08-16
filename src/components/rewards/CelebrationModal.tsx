import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, minTouchTarget, radii, shadows, spacing, typography } from '../../theme/tokens';
import { badgeVisual, tierLabel, tierName } from '../../lib/rewardVisuals';
import { playRewardCue, prepareRewardSounds } from '../../lib/rewardSound';
import type { Celebration } from '../../context/RewardsContext';
import { BadgeMedal } from './BadgeMedal';
import { ConfettiBurst } from './ConfettiBurst';

type CelebrationModalProps = {
  celebration: Celebration | null;
  onDismiss: () => void;
};

/**
 * The moment a badge or a level lands.
 *
 * Deliberately a modal she has to dismiss rather than a toast that slides away.
 * This is the payoff for the work, and the whole reward loop rests on it
 * registering — a banner she scrolls past teaches her the badges are noise.
 *
 * One at a time: `RewardsContext` queues them and hands over the next only once
 * this is dismissed, so earning three tiers at midnight is three moments rather
 * than a stack.
 */
export function CelebrationModal({ celebration, onDismiss }: CelebrationModalProps) {
  // Decoded up front, on the same mount that will later play them: the first
  // play of a cold player lags far enough behind the confetti to look broken.
  useEffect(prepareRewardSounds, []);

  /*
    Keyed on the celebration's identity, not on the object: the queue hands over
    the next badge by swapping the prop on this same mounted component, so the
    effect has to re-run per item to give each one its own cue.
  */
  const cueKey = celebration
    ? celebration.kind === 'level'
      ? `level-${celebration.level.level}`
      : celebration.tierId
    : null;
  const cueKind = celebration?.kind ?? null;

  useEffect(() => {
    if (!cueKey || !cueKind) return;
    playRewardCue(cueKind);
  }, [cueKey, cueKind]);

  if (!celebration) return null;

  const isLevel = celebration.kind === 'level';

  const eyebrow = isLevel ? 'Level up' : 'Achievement unlocked';
  const title = isLevel
    ? `${celebration.level.name} — level ${celebration.level.level}`
    : celebration.achievement.name;
  const subtitle = isLevel
    ? 'Every tick you have logged brought you here.'
    : celebration.achievement.blurb;
  const tierText = isLevel
    ? null
    : `${tierName(celebration.tier, celebration.achievement.maxTier)} · ${tierLabel(
        celebration.tier,
        celebration.achievement.maxTier
      )}`;

  const tint = isLevel ? colors.lavender : badgeVisual(celebration.achievement.id).tint;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={[styles.eyebrow, { backgroundColor: `${hexToSoft(tint)}` }]}>
            <Ionicons name="sparkles" size={14} color={tint} />
            <Text style={[styles.eyebrowText, { color: tint }]}>{eyebrow}</Text>
          </View>

          {isLevel ? (
            // The level wears the same round medal as a badge, with its number
            // in place of an icon — the confetti behind is the animation, so
            // there is no separate art here to fall out of step with the grid.
            <View style={styles.artPlaceholder}>
              <View style={[styles.levelMedal, { borderColor: tint, backgroundColor: hexToSoft(tint) }]}>
                <Text style={[styles.levelNumber, { color: tint }]}>{celebration.level.level}</Text>
                <Text style={[styles.levelCaption, { color: tint }]}>Level</Text>
              </View>
            </View>
          ) : (
            <View style={styles.artPlaceholder}>
              <BadgeMedal
                familyId={celebration.achievement.id}
                unlocked
                progress={1}
                size={132}
              />
            </View>
          )}

          <Text style={styles.title}>{title}</Text>
          {tierText ? <Text style={[styles.tier, { color: tint }]}>{tierText}</Text> : null}
          <Text style={styles.subtitle}>{subtitle}</Text>

          {!isLevel && celebration.achievement.target !== null ? (
            <Text style={styles.next}>Next: {celebration.achievement.goal}</Text>
          ) : null}
          {isLevel ? (
            <Text style={styles.next}>
              {celebration.level.toNext} XP to level {celebration.level.level + 1}
            </Text>
          ) : null}

          <Pressable
            style={styles.button}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={styles.buttonText}>Keep going</Text>
          </Pressable>
        </View>

        {/*
          Keyed on the celebration so each queued item replays the burst — a
          Lottie with loop={false} plays once per mount and this queue reuses
          the same element for the next badge.
        */}
        <ConfettiBurst key={isLevel ? `level-${celebration.level.level}` : celebration.tierId} visible />
      </View>
    </Modal>
  );
}

/**
 * A translucent wash of a badge's own colour.
 *
 * Built with rgba rather than an 8-digit hex: Android composites `#RRGGBBAA`
 * View backgrounds as flat grey, which would drain every badge to the same
 * colourless chip.
 */
function hexToSoft(hex: string): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) return 'rgba(244, 124, 151, 0.14)';
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.14)`;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: 'rgba(31, 27, 45, 0.55)',
  },
  card: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    ...shadows.card,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  eyebrowText: {
    ...typography.presets.label,
  },
  artPlaceholder: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  levelMedal: {
    width: 132,
    height: 132,
    borderRadius: radii.pill,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNumber: {
    ...typography.presets.heading1,
    fontSize: 48,
    lineHeight: 54,
  },
  levelCaption: {
    ...typography.presets.label,
  },
  title: {
    ...typography.presets.heading1,
    color: colors.text,
    textAlign: 'center',
  },
  tier: {
    ...typography.presets.label,
    marginTop: 2,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  next: {
    ...typography.presets.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  button: {
    marginTop: spacing.lg,
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
