import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget } from '../../theme/tokens';
import { BottomSheetModal } from '../BottomSheetModal';
import { StreakChip } from './StreakChip';

type WhySheetProps = {
  visible: boolean;
  title: string;
  /** The `why` the model wrote for her at plan generation. Never our summary of it. */
  why: string;
  streak?: number;
  bestStreak?: number;
  /** e.g. "3 times a day". Rendered as a chip when given. */
  cadenceLabel?: string;
  onClose: () => void;
};

/**
 * Bottom sheet holding one row's reason.
 *
 * Every nutrition row carries a `why` written for her symptoms, and until now
 * it had nowhere to be read. It is deliberately shown verbatim: contradicting
 * it elsewhere in the app would leave her with two mechanisms and no way to
 * tell which is right.
 */
export function WhySheet({
  visible,
  title,
  why,
  streak,
  bestStreak,
  cadenceLabel,
  onClose,
}: WhySheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      backdropColor="rgba(0, 0, 0, 0.4)"
      sheetStyle={[styles.sheet, { paddingBottom: Math.max(spacing.xl, insets.bottom) }]}
    >
      <View style={styles.grabber} />

      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {(cadenceLabel || (streak !== undefined && streak > 0)) && (
        <View style={styles.meta}>
          {cadenceLabel ? (
            <View style={styles.cadenceChip}>
              <Text style={styles.cadenceText}>{cadenceLabel}</Text>
            </View>
          ) : null}
          {streak !== undefined && bestStreak !== undefined && (
            <StreakChip streak={streak} bestStreak={bestStreak} />
          )}
        </View>
      )}

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.why}>{why}</Text>
      </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: '70%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    ...typography.presets.heading2,
    color: colors.text,
    flex: 1,
  },
  close: {
    width: minTouchTarget - 12,
    height: minTouchTarget - 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  cadenceChip: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cadenceText: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },
  body: {
    marginTop: spacing.md,
  },
  why: {
    ...typography.presets.body,
    color: colors.text,
    paddingBottom: spacing.lg,
  },
});
