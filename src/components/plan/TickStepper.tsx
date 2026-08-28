import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget } from '../../theme/tokens';
import type { TickValue } from '../../context/PlanContext';

/**
 * Pips get cramped fast. Three per row is comfortable at 44dp; eight is 30dp,
 * which is under the minimum touch target and wrong for this audience — so
 * anything above this threshold gets a minus/plus stepper instead.
 */
const MAX_PIPS = 4;

type TickStepperProps = {
  count: number;
  /** Ticks a full period takes. */
  target: number;
  /** Ticks the control should offer. Only water differs from target (6 → 8). */
  max: number;
  /**
   * Called with the NEW TOTAL, not a delta. 0 clears the day.
   *
   * Every call below passes the **function** form. `count` is a prop, so two
   * taps landing inside one render pass both read the same stale number and the
   * second one computes a total it has already sent — which the write path then
   * discards as a duplicate, and the tap simply disappears. Six fast taps down
   * the water row would land as three. Resolving the total at write time inside
   * `PlanContext` is what makes every tap count.
   */
  onChange: (next: TickValue) => void;
  /** Announced by screen readers alongside the numbers. */
  label: string;
};

function TickStepperComponent({ count, target, max, onChange, label }: TickStepperProps) {
  const done = count >= target;

  if (target === 1 && max === 1) {
    return (
      <Pressable
        onPress={() => onChange((current) => (current > 0 ? 0 : 1))}
        hitSlop={8}
        style={[styles.check, done && styles.checkDone]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={label}
      >
        {done && <Ionicons name="checkmark" size={20} color={colors.textInverse} />}
      </Pressable>
    );
  }

  if (max <= MAX_PIPS) {
    return (
      <View
        style={styles.pips}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max, now: count }}
      >
        {Array.from({ length: max }, (_, index) => index + 1).map((pip) => {
          const filled = pip <= count;
          return (
            <Pressable
              key={pip}
              // Tapping the last filled pip steps back down, so a mistap is one
              // tap to fix rather than a trip to zero and back.
              onPress={() => onChange((current) => (pip === current ? pip - 1 : pip))}
              hitSlop={6}
              style={[styles.pip, filled && styles.pipFilled]}
              accessibilityLabel={`${label}, ${pip} of ${max}`}
            >
              {filled && <Ionicons name="checkmark" size={16} color={colors.textInverse} />}
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View
      style={styles.stepper}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: count }}
    >
      <Pressable
        onPress={() => onChange((current) => Math.max(0, current - 1))}
        disabled={count === 0}
        hitSlop={6}
        style={[styles.stepButton, count === 0 && styles.stepButtonDisabled]}
        accessibilityRole="button"
        accessibilityLabel={`One fewer ${label}`}
      >
        <Ionicons
          name="remove"
          size={18}
          color={count === 0 ? colors.textMuted : colors.primaryDark}
        />
      </Pressable>

      <View style={styles.readout}>
        <Text style={[styles.readoutValue, done && styles.readoutValueDone]}>
          {Math.min(count, target)}
          <Text style={styles.readoutTarget}>/{target}</Text>
        </Text>
        {/* Water's target is 6 but it offers 8. Past target the extras read as a
            bonus rather than as a bar she has failed to reach. */}
        {count > target && <Text style={styles.bonus}>+{count - target}</Text>}
      </View>

      <Pressable
        onPress={() => onChange((current) => Math.min(max, current + 1))}
        disabled={count >= max}
        hitSlop={6}
        style={[styles.stepButton, count >= max && styles.stepButtonDisabled]}
        accessibilityRole="button"
        accessibilityLabel={`One more ${label}`}
      >
        <Ionicons
          name="add"
          size={18}
          color={count >= max ? colors.textMuted : colors.primaryDark}
        />
      </Pressable>
    </View>
  );
}

/**
 * Memoised because a tick re-renders the whole plan screen, and a nutrition
 * screen holds ten of these. Every millisecond that render costs widens the
 * window in which a second tap reads stale props.
 */
export const TickStepper = React.memo(TickStepperComponent);

const styles = StyleSheet.create({
  check: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
  },
  checkDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  pips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pip: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
  },
  pipFilled: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepButton: {
    width: minTouchTarget - 8,
    height: minTouchTarget - 8,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  stepButtonDisabled: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  readout: {
    minWidth: 52,
    alignItems: 'center',
  },
  readoutValue: {
    ...typography.presets.heading3,
    color: colors.text,
  },
  readoutValueDone: {
    color: colors.success,
  },
  readoutTarget: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },
  bonus: {
    ...typography.presets.caption,
    color: colors.primaryDark,
    marginTop: -2,
  },
});
