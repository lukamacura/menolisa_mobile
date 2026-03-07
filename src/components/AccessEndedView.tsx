import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../theme/tokens';
import { openWebDashboard } from '../lib/api';

// Strategy-aligned copy (i18n-ready constants)
const PAYWALL_HEADLINE =
  "I'm just getting to know your body's patterns. Stay with me and I'll keep connecting the dots.";
const PAYWALL_VALUE_LINE =
  'By Week 2, Lisa typically identifies 3–5 patterns most women miss.';
const BUTTON_LABEL_CONTINUE = 'Continue with Lisa';
const BUTTON_LABEL_MANAGE = 'Manage subscription';
const REMIND_LATER_LABEL = 'Remind me later';

type Variant = 'card' | 'fullScreen';

type AccessEndedViewProps = {
  variant: Variant;
  onPress?: () => void;
  /** When provided (fullScreen only), shows "Remind me later"; on press dismisses paywall for this session. */
  onRemindLater?: () => void;
};

export function AccessEndedView({ variant, onPress, onRemindLater }: AccessEndedViewProps) {
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      openWebDashboard().catch(() => {});
    }
  };

  if (variant === 'fullScreen') {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.fullScreenCard}>
          <View style={styles.iconWrap}>
            <Ionicons name="heart-outline" size={48} color={colors.primary} />
          </View>
          <Text style={styles.headline}>{PAYWALL_HEADLINE}</Text>
          <Text style={styles.valueLine}>{PAYWALL_VALUE_LINE}</Text>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.primaryButton}
            onPress={handlePress}
            accessibilityRole="button"
            accessibilityLabel={BUTTON_LABEL_CONTINUE}
          >
            <Text style={styles.primaryButtonText}>{BUTTON_LABEL_CONTINUE}</Text>
            <Ionicons name="open-outline" size={18} color={colors.background} />
          </TouchableOpacity>
          {onRemindLater != null && (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.secondaryButton}
              onPress={onRemindLater}
              accessibilityRole="button"
              accessibilityLabel={REMIND_LATER_LABEL}
            >
              <Text style={styles.secondaryButtonText}>{REMIND_LATER_LABEL}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardHeadline}>{PAYWALL_HEADLINE}</Text>
      <Text style={styles.cardValueLine}>{PAYWALL_VALUE_LINE}</Text>
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.cardButton}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={BUTTON_LABEL_MANAGE}
      >
        <Text style={styles.cardButtonText}>{BUTTON_LABEL_MANAGE}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  fullScreenCard: {
    alignItems: 'center',
    maxWidth: 320,
  },
  iconWrap: {
    marginBottom: spacing.lg,
  },
  headline: {
    ...typography.presets.heading2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  valueLine: {
    ...typography.presets.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: Math.max(spacing.md, (minTouchTarget - 24) / 2),
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    gap: spacing.sm,
    minHeight: minTouchTarget + 8,
    ...shadows.buttonPrimary,
  },
  primaryButtonText: {
    ...typography.presets.button,
    color: colors.background,
  },
  secondaryButton: {
    marginTop: spacing.md,
    minHeight: minTouchTarget,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    ...typography.presets.buttonSmall,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.rowNavyBg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  cardHeadline: {
    ...typography.presets.heading3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  cardValueLine: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  cardButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    minHeight: minTouchTarget,
    justifyContent: 'center',
    ...shadows.buttonPrimary,
  },
  cardButtonText: {
    ...typography.presets.buttonSmall,
    color: colors.background,
  },
});
