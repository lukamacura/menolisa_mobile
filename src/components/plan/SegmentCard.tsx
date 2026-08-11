import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../../theme/tokens';
import { AnimatedPressable } from '../AnimatedPressable';
import { ProgressRing } from './ProgressRing';

export type SegmentCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  /** Tint for the icon well and the ring. */
  tint: string;
  /** Soft background for the icon well. Must be rgba — Android mangles 8-digit hex. */
  tintSoft: string;
  title: string;
  /**
   * What is left to do, in her words. Must state its own timeframe — movement
   * counts across the week, everything else across today, and a subtitle that
   * doesn't say which teaches her the numbers are wrong.
   */
  subtitle: string;
  value: number;
  total: number;
  onPress: () => void;
};

export function SegmentCard({
  icon,
  tint,
  tintSoft,
  title,
  subtitle,
  value,
  total,
  onPress,
}: SegmentCardProps) {
  const complete = total > 0 && value >= total;

  return (
    <AnimatedPressable
      containerStyle={styles.pressable}
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
    >
      <View style={[styles.iconWell, { backgroundColor: tintSoft }]}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>

      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>

      <ProgressRing
        value={value}
        total={total}
        size={44}
        color={tint}
        label={complete ? undefined : `${value}/${Math.max(1, total)}`}
      />

      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    marginBottom: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget + spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  iconWell: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.presets.heading3,
    color: colors.text,
  },
  subtitle: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
  },
});
