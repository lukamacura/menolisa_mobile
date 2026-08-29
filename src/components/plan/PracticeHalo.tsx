import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { radii } from '../../theme/tokens';

/** One full swell. Roughly a slow, unforced breath. */
export const HALO_PERIOD_MS = 5200;

/** The relaxation lavender the two practice players share. */
const HALO_TINT = 'rgba(139, 124, 246, 0.22)';

type PracticeHaloProps = {
  /** Matches the ring it sits behind. */
  size: number;
  /** Swells while true, settles flat while false. */
  active: boolean;
  reduceMotion: boolean;
  /**
   * The glow's colour, for a ring that is not a relaxation one — the cardio
   * timer borrows the pulse and wears the movement coral. Always `rgba`: an
   * eight-digit hex renders flat grey on Android.
   */
  tint?: string;
};

/**
 * The slow glow behind a practice ring.
 *
 * A bare countdown is the loneliest screen in the app — a number going down,
 * with nothing to do and no sign anything is happening. This gives the screen a
 * pulse to sit with, at a rate slow enough that following it is restful rather
 * than a second thing to keep up with.
 *
 * Shared by the practice timer and the meditation player so the two read as the
 * same kind of thing: she is doing one relaxation task, and which of the two she
 * picked should not change what the screen feels like.
 *
 * It swells **only while the practice is actually running.** A halo breathing
 * away behind a paused clock says the session is going when it is not, which on
 * a screen with no other motion is the only thing she has to go on.
 */
export function PracticeHalo({ size, active, reduceMotion, tint = HALO_TINT }: PracticeHaloProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion || !active) {
      cancelAnimation(scale);
      scale.value = withTiming(1, { duration: 400 });
      return;
    }
    scale.value = withRepeat(
      withTiming(1.12, { duration: HALO_PERIOD_MS / 2, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [active, reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    // Nearly flat at rest, so a paused screen reads as still rather than dim.
    opacity: 0.25 + (scale.value - 1) * 2.2,
  }));

  return (
    <Animated.View
      style={[styles.halo, { width: size, height: size, backgroundColor: tint }, animatedStyle]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  halo: {
    position: 'absolute',
    borderRadius: radii.pill,
  },
});
