import React, { useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, spacing, radii, typography, minTouchTarget } from '../../theme/tokens';
import { motion } from '../../theme/motion';
import { haptics } from '../../lib/haptics';
import { useReduceMotion } from '../StaggeredZoomIn';
import type { TickValue } from '../../context/PlanContext';

/**
 * Pips get cramped fast. Three per row is comfortable at 44dp; eight is 30dp,
 * which is under the minimum touch target and wrong for this audience — so
 * anything above this threshold gets a minus/plus stepper instead.
 */
const MAX_PIPS = 4;

/**
 * How the fill lands.
 *
 * A box that changes colour instantly reads as a screenshot swapping; a box that
 * swells a few points and settles reads as something she pressed. The overshoot
 * is small on purpose — this control gets tapped twenty times a day, and a
 * bouncy checkbox stops being charming somewhere around the fourth.
 */
const FILL_DURATION_MS = 180;
const POP_SCALE = 1.16;
const POP_UP_MS = 110;
const POP_SPRING = { damping: 12, stiffness: 320, mass: 0.5 };

/**
 * COMPLETION_IS_CELEBRATED — why finishing something is silent *here*.
 *
 * `PlanContext.tick` calls `describeCompletion` synchronously, so the frame she
 * finishes a row, `CompletionReward` mounts and fires its own celebration
 * haptic. This control firing a second one on the same tap does not read as a
 * bigger reward; it reads as the phone glitching.
 *
 * So the two split the job by meaning. This control confirms the *tap* — one
 * light tick per unit logged, one soft one per unit taken back. The reward
 * system confirms the *achievement*, and is the only thing in the app allowed
 * to buzz for it. Every tap therefore produces exactly one haptic, and its
 * weight tells her which of the two things just happened.
 */
function crossesTarget(previous: number, next: number, target: number): boolean {
  return previous < target && next >= target;
}

/** Shared by the box and the pips so nothing on a row fills on a different clock. */
function useFillAnimation(filled: boolean, reduceMotion: boolean) {
  const progress = useSharedValue(filled ? 1 : 0);
  const pop = useSharedValue(1);
  // Skips the entrance pop: a row arriving already-ticked from the server has
  // not been pressed, and animating it would claim she just did something.
  const mounted = React.useRef(false);

  useEffect(() => {
    const first = !mounted.current;
    mounted.current = true;

    if (reduceMotion) {
      progress.value = filled ? 1 : 0;
      pop.value = 1;
      return;
    }

    progress.value = withTiming(filled ? 1 : 0, { duration: FILL_DURATION_MS });

    if (first) return;
    pop.value = filled
      ? withSequence(
          withTiming(POP_SCALE, { duration: POP_UP_MS }),
          withSpring(1, POP_SPRING)
        )
      // Clearing settles straight back with no overshoot. Undoing should feel
      // like a correction, not a second celebration.
      : withSpring(1, POP_SPRING);
  }, [filled, reduceMotion]);

  const shellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.surfaceElevated, colors.success]
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.borderStrong, colors.success]
    ),
  }));

  // The mark scales up from small rather than cutting in, so the tick reads as
  // being drawn into the box instead of appearing on top of it.
  const markStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.5 + progress.value * 0.5 }],
  }));

  return { shellStyle, markStyle };
}

/** The single on/off box: habits, and any nutrition row with a target of one. */
function CheckBox({
  done,
  onChange,
  label,
}: {
  done: boolean;
  onChange: (next: TickValue) => void;
  label: string;
}) {
  const reduceMotion = useReduceMotion();
  const { shellStyle, markStyle } = useFillAnimation(done, reduceMotion);

  const handlePress = useCallback(() => {
    // Silent on the way *on*, because ticking this box finishes the task, and
    // `PlanContext` fires a completion the same frame — which `CompletionReward`
    // answers with the celebration buzz. Firing here too would put two haptics
    // on one tap, which reads as a stutter rather than a reward. See the
    // COMPLETION_IS_CELEBRATED note at the top of this file.
    if (done) haptics.untick();
    onChange((current) => (current > 0 ? 0 : 1));
  }, [done, onChange]);

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.check, shellStyle]}>
        <Animated.View style={markStyle}>
          <Ionicons name="checkmark" size={20} color={colors.textInverse} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

/** One dot in a 2–4 count row. */
function Pip({
  count,
  index,
  max,
  onChange,
  label,
  target,
}: {
  count: number;
  index: number;
  max: number;
  target: number;
  onChange: (next: TickValue) => void;
  label: string;
}) {
  const reduceMotion = useReduceMotion();
  const { shellStyle, markStyle } = useFillAnimation(index <= count, reduceMotion);

  const handlePress = useCallback(() => {
    // Tapping the pip that *is* the current count steps back down, so a mistap
    // is one tap to fix rather than a trip to zero and back. Any other pip
    // jumps the count straight to it.
    const nextCount = index === count ? index - 1 : index;
    if (nextCount < count) haptics.untick();
    else if (!crossesTarget(count, nextCount, target)) haptics.tick();
    onChange((current) => (index === current ? index - 1 : index));
  }, [count, index, target, onChange]);

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={6}
      accessibilityLabel={`${label}, ${index} of ${max}`}
    >
      <Animated.View style={[styles.pip, shellStyle]}>
        <Animated.View style={markStyle}>
          <Ionicons name="checkmark" size={16} color={colors.textInverse} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

/** One end of the minus/plus stepper. Dips under the finger so a held tap reads. */
function StepButton({
  icon,
  disabled,
  onPress,
  label,
}: {
  icon: 'add' | 'remove';
  disabled: boolean;
  onPress: () => void;
  label: string;
}) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        if (!reduceMotion && !disabled) {
          scale.value = withSpring(0.88, motion.spring.pressIn);
        }
      }}
      onPressOut={() => {
        if (!reduceMotion) scale.value = withSpring(1, motion.spring.pressOut);
      }}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View
        style={[styles.stepButton, disabled && styles.stepButtonDisabled, animatedStyle]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={disabled ? colors.textMuted : colors.primaryDark}
        />
      </Animated.View>
    </Pressable>
  );
}

/** The count readout. Nudges when the number changes so the eye follows it. */
function Readout({ count, target, done }: { count: number; target: number; done: boolean }) {
  const reduceMotion = useReduceMotion();
  const bump = useSharedValue(1);
  const previous = React.useRef(count);

  useEffect(() => {
    if (reduceMotion || previous.current === count) {
      previous.current = count;
      return;
    }
    previous.current = count;
    bump.value = withSequence(
      withTiming(1.14, { duration: 90 }),
      withSpring(1, POP_SPRING)
    );
  }, [count, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bump.value }],
  }));

  return (
    <Animated.View style={[styles.readout, animatedStyle]}>
      <Text style={[styles.readoutValue, done && styles.readoutValueDone]}>
        {Math.min(count, target)}
        <Text style={styles.readoutTarget}>/{target}</Text>
      </Text>
      {/* Water's target is 6 but it offers 8. Past target the extras read as a
          bonus rather than as a bar she has failed to reach. */}
      {count > target && <Text style={styles.bonus}>+{count - target}</Text>}
    </Animated.View>
  );
}

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

  const stepDown = useCallback(() => {
    haptics.untick();
    onChange((current) => Math.max(0, current - 1));
  }, [onChange]);

  const stepUp = useCallback(() => {
    // Silent only on the tap that *crosses* the target — the reward owns that
    // one. The 7th and 8th glass of water are past target and finish nothing,
    // so they keep their own tick.
    if (!crossesTarget(count, count + 1, target)) haptics.tick();
    onChange((current) => Math.min(max, current + 1));
  }, [count, target, max, onChange]);

  if (target === 1 && max === 1) {
    return <CheckBox done={done} onChange={onChange} label={label} />;
  }

  if (max <= MAX_PIPS) {
    return (
      <View
        style={styles.pips}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max, now: count }}
      >
        {Array.from({ length: max }, (_, index) => index + 1).map((pip) => (
          <Pip
            key={pip}
            index={pip}
            max={max}
            target={target}
            count={count}
            onChange={onChange}
            label={label}
          />
        ))}
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
      <StepButton
        icon="remove"
        disabled={count === 0}
        onPress={stepDown}
        label={`One fewer ${label}`}
      />
      <Readout count={count} target={target} done={done} />
      <StepButton
        icon="add"
        disabled={count >= max}
        onPress={stepUp}
        label={`One more ${label}`}
      />
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
