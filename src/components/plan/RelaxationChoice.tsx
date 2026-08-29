import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../../theme/tokens';
import { AnimatedPressable } from '../AnimatedPressable';

export type RelaxationOption<Key extends string> = {
  key: Key;
  /** What she is choosing. The plan's own title, or "Guided meditation". */
  label: string;
  /** How long it takes — "2 min", "10:57". Absent when there is no fixed length. */
  length?: string;
};

type RelaxationChoiceProps<Key extends string> = {
  options: RelaxationOption<Key>[];
  selected: Key;
  onSelect: (key: Key) => void;
};

/**
 * Which way she does today's relaxation.
 *
 * The plan writes one relaxation task a week and picks the practice for it, and
 * for most women that practice is a breathing pattern. That is a good default
 * and a bad only-option: breathing is work — a rhythm to follow and a circle to
 * keep up with — and there are evenings when the honest choice is between lying
 * still with a voice or doing nothing at all. So the meditation sits beside it
 * rather than replacing it, and either one completes the same task.
 *
 * Deliberately styled as a track with a raised thumb rather than a filled coral
 * pill. There is exactly one loud thing on a relaxation screen and it is the
 * Start button; a second coral shape above it would make her choose twice.
 *
 * Both lengths are shown. The whole decision is "which of these do I have it in
 * me for right now", and that is mostly a question about time.
 */
export function RelaxationChoice<Key extends string>({
  options,
  selected,
  onSelect,
}: RelaxationChoiceProps<Key>) {
  return (
    <View style={styles.track}>
      {options.map((option) => {
        const active = option.key === selected;
        return (
          <AnimatedPressable
            key={option.key}
            containerStyle={styles.segmentWrap}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onSelect(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.length ? `${option.label}, ${option.length}` : option.label}
          >
            {/* Two lines, because the label is the plan's own task title and
                "Hot flash rescue breathing" does not fit on one across half a
                phone. Truncating it would hide which practice she is picking. */}
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={2}>
              {option.label}
            </Text>
            {option.length ? (
              <Text style={[styles.length, active && styles.lengthActive]} numberOfLines={1}>
                {option.length}
              </Text>
            ) : null}
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: spacing.xs / 2,
    padding: 4,
    borderRadius: radii.lg,
    backgroundColor: colors.plumSoft,
  },
  segmentWrap: {
    flex: 1,
  },
  segment: {
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.md,
  },
  segmentActive: {
    backgroundColor: colors.card,
    ...shadows.card,
  },
  label: {
    ...typography.presets.label,
    color: colors.textMuted,
    textAlign: 'center',
  },
  labelActive: {
    color: colors.text,
  },
  length: {
    ...typography.presets.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  lengthActive: {
    color: colors.primaryDark,
  },
});
