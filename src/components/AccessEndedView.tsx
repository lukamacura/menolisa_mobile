import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget } from '../theme/tokens';
import { openWebDashboard } from '../lib/api';

const TITLE = 'Your access has ended';
const SUBTITLE = 'Manage your subscription at menolisa.com to continue using Lisa and symptom tracking.';
const BUTTON_LABEL = 'Manage subscription';

type Variant = 'card' | 'fullScreen';

type AccessEndedViewProps = {
  variant: Variant;
  onPress?: () => void;
};

export function AccessEndedView({ variant, onPress }: AccessEndedViewProps) {
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
            <Ionicons name="lock-closed" size={48} color={colors.textMuted} />
          </View>
          <Text style={styles.title}>{TITLE}</Text>
          <Text style={styles.subtitle}>{SUBTITLE}</Text>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.primaryButton}
            onPress={handlePress}
          >
            <Text style={styles.primaryButtonText}>{BUTTON_LABEL}</Text>
            <Ionicons name="open-outline" size={18} color={colors.navy} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{TITLE}</Text>
      <Text style={styles.cardSubtitle}>{SUBTITLE}</Text>
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.cardButton}
        onPress={handlePress}
      >
        <Text style={styles.cardButtonText}>{BUTTON_LABEL}</Text>
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
  title: {
    fontSize: 22,
    fontFamily: typography.display.semibold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
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
  },
  primaryButtonText: {
    fontSize: 17,
    fontFamily: typography.display.semibold,
    color: colors.background,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: typography.display.semibold,
    color: colors.danger,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.text,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  cardButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    minHeight: minTouchTarget,
    justifyContent: 'center',
  },
  cardButtonText: {
    fontSize: 15,
    fontFamily: typography.display.semibold,
    color: colors.background,
    textTransform: 'uppercase',
  },
});
