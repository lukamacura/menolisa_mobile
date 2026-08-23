import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../theme/tokens';
import { playRewardCue, prepareRewardSounds } from '../lib/rewardSound';
import { ConfettiBurst } from './rewards/ConfettiBurst';

/**
 * How long the panel stays up before its caller takes the screen back.
 *
 * Long enough to read and feel, short enough that she is never left tapping at
 * a screen with nothing on it — this panel has no controls of its own, so a
 * caller that forgets to dismiss it strands her.
 */
export const GRATITUDE_DISMISS_MS = 1800;

export type GratitudeMetaChip = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

export type GratitudeSuccessPanelProps = {
  title: string;
  subtitle: string;
  encouragement?: string;
  metaChips?: GratitudeMetaChip[];
  reduceMotion?: boolean;
};

/**
 * The gratitude layout for finishing something off-plan — a symptom log, a
 * session, a relaxation track.
 *
 * Wears the same reward language as a ticked nutrition or movement row: the
 * green check well and a confetti fall, no separate trophy animation. One
 * vocabulary for "you finished a thing" is what makes the badge modal feel like
 * the rarer, bigger event it is.
 */
export function GratitudeSuccessPanel({
  title,
  subtitle,
  encouragement,
  metaChips,
  reduceMotion,
}: GratitudeSuccessPanelProps) {
  /*
    This panel is only ever mounted at the moment it is celebrating, so mount is
    the event — every caller swaps it in for the form she just submitted.

    It gets the `achievement` cue rather than the lighter `completion` one
    because it takes the whole screen, same as the badge modal. Deliberately not
    gated on `reduceMotion`: that setting is about vestibular comfort, and
    someone who turns animations off should still be told the log saved.
  */
  useEffect(() => {
    prepareRewardSounds();
    playRewardCue('achievement');
  }, []);

  return (
    <View style={styles.successOverlay}>
      {!reduceMotion ? <ConfettiBurst visible /> : null}
      <View style={styles.successCard}>
        <View style={styles.successBadge}>
          <Ionicons name="sparkles" size={16} color={colors.primaryDark} />
          <Text style={styles.successBadgeText}>Nice work</Text>
        </View>
        <View style={styles.successIconWell} accessibilityLabel="Success">
          <Ionicons name="checkmark" size={52} color={colors.textInverse} />
        </View>
        <Text style={styles.successTitle}>{title}</Text>
        <Text style={styles.successSubtitle}>{subtitle}</Text>
        {metaChips != null && metaChips.length > 0 ? (
          <View style={styles.successMetaRow}>
            {metaChips.map((chip) => (
              <View key={chip.label} style={styles.successMetaChip}>
                <Ionicons name={chip.icon} size={16} color={colors.primaryDark} />
                <Text style={styles.successMetaText}>{chip.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {encouragement ? <Text style={styles.successEncouragement}>{encouragement}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  successOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surfaceElevated,
  },
  successCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    ...shadows.card,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(249, 184, 200, 0.18)',
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  successBadgeText: {
    ...typography.presets.label,
    color: colors.primaryDark,
  },
  successIconWell: {
    width: 96,
    height: 96,
    borderRadius: radii.pill,
    marginBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
  },
  successTitle: {
    ...typography.presets.heading2,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  successSubtitle: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
  },
  successMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  successMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: minTouchTarget - 6,
  },
  successMetaText: {
    ...typography.presets.caption,
    color: colors.text,
  },
  successEncouragement: {
    ...typography.presets.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
