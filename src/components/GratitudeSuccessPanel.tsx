import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../theme/tokens';

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
 * Same gratitude layout as symptom log success (trophy Lottie, badge, chips).
 * Reused for mood save, streak milestones, and edit-log success.
 */
export function GratitudeSuccessPanel({
  title,
  subtitle,
  encouragement,
  metaChips,
  reduceMotion,
}: GratitudeSuccessPanelProps) {
  return (
    <View style={styles.successOverlay}>
      <View style={styles.successCard}>
        <View style={styles.successBadge}>
          <Ionicons name="sparkles" size={16} color={colors.primaryDark} />
          <Text style={styles.successBadgeText}>Nice work</Text>
        </View>
        {!reduceMotion ? (
          <LottieView
            source={require('../../assets/Trophy.json')}
            autoPlay
            loop={false}
            style={styles.successLottie}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.successLottiePlaceholder} accessibilityLabel="Success">
            <Ionicons name="trophy" size={64} color={colors.primary} />
          </View>
        )}
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
  successLottie: {
    width: 170,
    height: 170,
    marginBottom: spacing.md,
  },
  successLottiePlaceholder: {
    width: 170,
    height: 170,
    marginBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
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
