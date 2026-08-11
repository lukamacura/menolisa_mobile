import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing, typography } from '../../theme/tokens';
import { usePlan, type PlanCompletion } from '../../context/PlanContext';
import { useRewards } from '../../context/RewardsContext';
import { motion } from '../../theme/motion';
import { playRewardCue, prepareRewardSounds } from '../../lib/rewardSound';
import { useReduceMotion } from '../StaggeredZoomIn';
import { ConfettiBurst } from './ConfettiBurst';

/** How long a reward stays up before it clears itself. */
const VISIBLE_MS = 1_700;

/**
 * The reward for finishing one thing — a task, or a sub-task like a nutrition row.
 *
 * Deliberately **not** a modal she has to dismiss. This fires on every
 * completion, and a day's plan holds well over a dozen of them; a blocking
 * dialog would turn a good day into a dozen taps on "OK" and make finishing
 * things feel like work. So it is a full-width card with confetti that owns the
 * screen for a moment and then leaves, and `pointerEvents="none"` means she can
 * carry straight on ticking underneath it.
 *
 * Badge and level unlocks are the ones that do interrupt — they are rare, and
 * `CelebrationModal` handles those.
 */
export function CompletionReward() {
  const { completion, clearCompletion } = usePlan();
  const { rewards } = useRewards();
  const reduceMotion = useReduceMotion();

  // Held separately from the context value so the card can animate out after
  // the event has been cleared, instead of vanishing mid-fade.
  const [shown, setShown] = useState<PlanCompletion | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  // Mounted for the whole session beside the tabs, and the first tick of the
  // day almost always beats the first badge here — so this is the mount that
  // has to pay for decoding, or her first completion arrives silent.
  useEffect(prepareRewardSounds, []);

  useEffect(() => {
    if (!completion) return;
    setShown(completion);
    // The light cue, not the badge one: this fires on every ticked row.
    playRewardCue('completion');
    // Cleared immediately: the context's job is to announce the event once, and
    // holding it would make a second completion of the same row a no-op.
    clearCompletion();

    if (reduceMotion) {
      opacity.value = 1;
      translateY.value = 0;
      scale.value = 1;
    } else {
      opacity.value = withTiming(1, { duration: 160 });
      translateY.value = withSpring(-8, motion.spring.pressOut);
      scale.value = withSequence(
        withTiming(0.94, { duration: 0 }),
        withSpring(1, motion.spring.pressOut)
      );
    }

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      opacity.value = reduceMotion ? 0 : withTiming(0, { duration: 240 });
      translateY.value = reduceMotion ? 0 : withTiming(-24, { duration: 240 });
      // Unmount after the fade rather than on the same frame, or the card
      // disappears instantly and the exit animation is never seen.
      setTimeout(() => setShown(null), reduceMotion ? 0 : 260);
    }, VISIBLE_MS);
  }, [completion, clearCompletion, reduceMotion, opacity, translateY, scale]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  if (!shown) return null;

  const xp = rewards?.xp.perCompletion;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <ConfettiBurst key={shown.id} visible />
      <Animated.View style={[styles.card, animatedStyle]}>
        <View style={styles.iconWell}>
          <Ionicons name="checkmark" size={28} color={colors.textInverse} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.kind}>{shown.kind}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {shown.title}
          </Text>
        </View>
        {/* Absent until rewards have loaded — better than showing a number the
            server has not confirmed it pays. */}
        {xp !== undefined ? (
          <View style={styles.xpPill}>
            <Text style={styles.xpText}>+{xp}</Text>
            <Text style={styles.xpUnit}>XP</Text>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'stretch',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  iconWell: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
  },
  copy: {
    flex: 1,
  },
  kind: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },
  title: {
    ...typography.presets.heading3,
    color: colors.text,
  },
  xpPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(139, 124, 246, 0.16)',
  },
  xpText: {
    ...typography.presets.heading3,
    color: colors.lavender,
  },
  xpUnit: {
    ...typography.presets.caption,
    fontSize: 11,
    color: colors.lavender,
  },
});
