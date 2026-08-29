import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget } from '../../theme/tokens';
import { haptics } from '../../lib/haptics';
import type { PlanHabit } from '../../lib/planTypes';
import type { TickValue } from '../../context/PlanContext';
import { StreakChip } from './StreakChip';
import { TickStepper } from './TickStepper';

type HabitRowProps = {
  habit: PlanHabit;
  onChange: (next: TickValue) => void;
  onRemove: () => void;
};

export function HabitRow({ habit, onChange, onRemove }: HabitRowProps) {
  const resist = habit.kind === 'resist';

  const confirmRemove = () => {
    // Long-press to delete is an invisible gesture. The buzz is what tells her
    // she triggered something before the dialog explains what — and, on the
    // half-presses that don't fire, its absence is the answer too.
    haptics.warn();
    Alert.alert(
      `Remove "${habit.title}"?`,
      // The server deletes every log for this habit alongside it, so a long
      // streak disappears with no way back. Say so before she taps.
      'This also clears its streak and every day you logged for it.',
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: onRemove },
      ]
    );
  };

  return (
    <Pressable
      style={[styles.row, resist && styles.rowResist]}
      onLongPress={confirmRemove}
      delayLongPress={500}
      accessibilityRole="button"
      accessibilityLabel={`${habit.title}. Long press to remove.`}
    >
      <View style={[styles.iconWell, resist && styles.iconWellResist]}>
        <Ionicons
          name={resist ? 'hand-left' : 'add-circle'}
          size={17}
          color={resist ? colors.lavender : colors.blue}
        />
      </View>

      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2}>
          {habit.title}
        </Text>
        <View style={styles.metaRow}>
          {/* "Held" not "done" — resisting is not a task she completes. */}
          <Text style={styles.kind}>{resist ? 'Resisting' : 'Building'}</Text>
          <StreakChip streak={habit.streak} bestStreak={habit.bestStreak} />
        </View>
      </View>

      <TickStepper
        count={habit.doneToday}
        target={1}
        max={1}
        onChange={onChange}
        label={habit.title}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget + spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowResist: {
    borderColor: 'rgba(139, 124, 246, 0.30)',
  },
  iconWell: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(58, 191, 163, 0.16)',
  },
  iconWellResist: {
    backgroundColor: 'rgba(139, 124, 246, 0.16)',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.presets.bodyMedium,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  kind: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },
});
