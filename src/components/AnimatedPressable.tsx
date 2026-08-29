import React, { useCallback } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { motion } from '../theme/motion';
import { haptics } from '../lib/haptics';
import { useReduceMotion } from './StaggeredZoomIn';

type AnimatedPressableProps = PressableProps & {
  children: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  /**
   * The tick that confirms the tap. Default on: this component is how the app
   * says "this is a real button", and a real button answers.
   *
   * Fired on `onPress`, not `onPressIn`, and the difference matters. Press-in
   * lands on touch-*down*, which a `ScrollView` also sees — so every time she
   * put a finger on a card and flicked, the phone would buzz for a tap she
   * never made. Most of these live in scrollers. Waiting for the press to
   * actually complete costs the length of a finger-lift and removes the whole
   * class of phantom buzz.
   *
   * Pass `false` where the caller fires its own — the plan switcher, for one,
   * stays silent when she taps the cycle she is already on, which a blanket
   * haptic here could not know.
   */
  haptic?: boolean;
};

export function AnimatedPressable({
  children,
  containerStyle,
  scaleTo = motion.pressScale.subtle,
  haptic = true,
  onPress,
  onPressIn,
  onPressOut,
  ...pressableProps
}: AnimatedPressableProps) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);

  const handlePress: NonNullable<PressableProps['onPress']> = useCallback((event) => {
    // Fires even under reduce-motion. That setting is about vestibular comfort,
    // not about wanting less confirmation — for some users the haptic is doing
    // the work the animation is no longer allowed to.
    if (haptic) haptics.press();
    onPress?.(event);
  }, [haptic, onPress]);

  const handlePressIn: NonNullable<PressableProps['onPressIn']> = useCallback((event) => {
    if (!reduceMotion) {
      scale.value = withSpring(scaleTo, motion.spring.pressIn);
    }
    onPressIn?.(event);
  }, [onPressIn, reduceMotion, scale, scaleTo]);

  const handlePressOut: NonNullable<PressableProps['onPressOut']> = useCallback((event) => {
    if (!reduceMotion) {
      scale.value = withSpring(1, motion.spring.pressOut);
    }
    onPressOut?.(event);
  }, [onPressOut, reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle, animatedStyle]}>
      <Pressable
        {...pressableProps}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
