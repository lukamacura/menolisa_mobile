import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget } from '../../theme/tokens';
import { nutritionIcon } from '../../lib/planIconMapping';
import type { NutritionItem } from '../../lib/planTypes';
import type { TickValue } from '../../context/PlanContext';
import { StreakChip } from './StreakChip';
import { SupplementChips } from './SupplementChips';
import { TickStepper } from './TickStepper';
import { WhySheet } from './WhySheet';

type NutritionRowProps = {
  item: NutritionItem;
  /**
   * Takes the row's own key, so the screen can pass one stable callback to all
   * ten rows and let `React.memo` skip the nine that did not change.
   */
  onChange: (taskKey: string, next: TickValue) => void;
  /** Revealed under the row once it is ticked. Supplements only. */
  supplements?: { id: string; label: string }[];
};

/** "Every meal" for the 3× rows, "6 or more" for water. Derived, never hardcoded per id. */
function cadenceHint(item: NutritionItem): string | null {
  if (item.max > item.target) return `${item.target} or more`;
  if (item.target === 3) return 'Every meal';
  if (item.target > 1) return `${item.target} a day`;
  return null;
}

function NutritionRowComponent({ item, onChange, supplements }: NutritionRowProps) {
  const [whyOpen, setWhyOpen] = useState(false);
  const hint = cadenceHint(item);

  const taskKey = item.key;
  const handleChange = useCallback(
    (next: TickValue) => onChange(taskKey, next),
    [onChange, taskKey]
  );

  return (
    <View style={[styles.wrap, item.doneToday && styles.wrapDone]}>
      <View style={styles.row}>
        <View style={[styles.iconWell, item.doneToday && styles.iconWellDone]}>
          <Ionicons
            name={nutritionIcon(item.id)}
            size={18}
            color={item.doneToday ? colors.success : colors.textMuted}
          />
        </View>

        <Pressable
          style={styles.text}
          onPress={() => setWhyOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Why ${item.title} is on your list`}
        >
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} />
          </View>

          <View style={styles.metaRow}>
            {hint && <Text style={styles.hint}>{hint}</Text>}
            {item.focus && (
              <View style={styles.focusChip}>
                <Text style={styles.focusText}>This week</Text>
              </View>
            )}
            <StreakChip streak={item.streak} bestStreak={item.bestStreak} />
          </View>
        </Pressable>

        <TickStepper
          count={item.count}
          target={item.target}
          max={item.max}
          onChange={handleChange}
          label={item.title}
        />
      </View>

      {supplements && item.doneToday && <SupplementChips supplements={supplements} />}

      <WhySheet
        visible={whyOpen}
        title={item.title}
        why={item.why}
        streak={item.streak}
        bestStreak={item.bestStreak}
        cadenceLabel={hint ?? undefined}
        onClose={() => setWhyOpen(false)}
      />
    </View>
  );
}

/**
 * Memoised: a tick replaces the plan object, but `applyNutritionCount` hands
 * back the *same* item object for every row it did not touch — so nine of the
 * ten rows here skip the render entirely, and the tenth is cheap enough that a
 * second tap 80ms later still reads fresh props.
 */
export const NutritionRow = React.memo(NutritionRowComponent);

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  wrapDone: {
    borderColor: 'rgba(34, 160, 107, 0.35)',
    backgroundColor: colors.successBg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget + spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  iconWell: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  iconWellDone: {
    backgroundColor: 'rgba(34, 160, 107, 0.14)',
  },
  text: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  title: {
    ...typography.presets.bodyMedium,
    color: colors.text,
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  hint: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },
  focusChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(139, 124, 246, 0.16)',
  },
  focusText: {
    ...typography.presets.caption,
    fontFamily: typography.family.semibold,
    color: colors.lavender,
  },
});
