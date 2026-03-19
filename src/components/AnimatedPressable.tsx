import React, { useCallback } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { motion } from '../theme/motion';
import { useReduceMotion } from './StaggeredZoomIn';

type AnimatedPressableProps = PressableProps & {
  children: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
};

export function AnimatedPressable({
  children,
  containerStyle,
  scaleTo = motion.pressScale.subtle,
  onPressIn,
  onPressOut,
  ...pressableProps
}: AnimatedPressableProps) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);

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
