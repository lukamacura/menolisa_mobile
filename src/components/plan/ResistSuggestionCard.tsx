import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget } from '../../theme/tokens';
import { AnimatedPressable } from '../AnimatedPressable';
import type { ResistSuggestion } from '../../lib/planTypes';

type ResistSuggestionCardProps = {
  suggestion: ResistSuggestion;
  adding: boolean;
  disabled: boolean;
  onAdd: () => void;
};

/**
 * A temptation she gets credit for resisting — an offer, not an assignment.
 *
 * It only becomes part of her plan when she adopts it, which is why this is a
 * card with a button rather than another tickable row.
 */
export function ResistSuggestionCard({
  suggestion,
  adding,
  disabled,
  onAdd,
}: ResistSuggestionCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="hand-left" size={17} color={colors.lavender} />
        <Text style={styles.title}>{suggestion.title}</Text>
      </View>

      <Text style={styles.why}>{suggestion.why}</Text>

      <AnimatedPressable
        containerStyle={styles.buttonWrap}
        style={[styles.button, disabled && styles.buttonDisabled]}
        onPress={onAdd}
        disabled={disabled || adding}
        accessibilityRole="button"
        accessibilityLabel={`Add ${suggestion.title} to your habits`}
      >
        {adding ? (
          <ActivityIndicator size="small" color={colors.lavender} />
        ) : (
          <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>
            Add to my habits
          </Text>
        )}
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'rgba(139, 124, 246, 0.30)',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    ...typography.presets.heading3,
    color: colors.text,
    flex: 1,
  },
  why: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    marginTop: 4,
  },
  buttonWrap: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    width: 'auto',
  },
  button: {
    minHeight: minTouchTarget - 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(139, 124, 246, 0.14)',
  },
  buttonDisabled: {
    backgroundColor: colors.surfaceElevated,
  },
  buttonText: {
    ...typography.presets.buttonSmall,
    color: colors.lavender,
  },
  buttonTextDisabled: {
    color: colors.textMuted,
  },
});
