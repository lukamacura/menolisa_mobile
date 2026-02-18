/**
 * In-chat loading indicator: logo with irregular animation and state messages
 * in rotating colors. Tuned for a supportive, women-focused experience.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image } from 'react-native';
import { colors, typography } from '../theme/tokens';

const ROTATE_INTERVAL_MS = 2200;

const LOADING_MESSAGES: string[] = [
  'Taking a mindful moment...',
  'Gathering wisdom for you...',
  "Getting Lisa's notes ready...",
  'Sitting with this a moment...',
  'Connecting the dots...',
  'Finding the perfect words...',
  'Crafting a response...',
  'Reflecting on your question...',
  'Nurturing this thought...',
  'Bringing clarity to light...',
  "Seeing what Lisa noticed...",
  'Growing understanding...',
];

// Distinct color per state (on-brand, visible in chat bubble)
const STATE_COLORS = [
  colors.primary,
  colors.primaryDark,
  colors.blue,
  colors.primaryLight,
  colors.navy,
  colors.warning,
  colors.gold,
  colors.primary,
  colors.blueLight,
  colors.primaryDark,
  colors.primaryLight,
  colors.navy,
];

const easeInOut = Easing.bezier(0.42, 0, 0.58, 1);
const easeOut = Easing.bezier(0, 0, 0.58, 1);

function getRandomMessageIndex() {
  return Math.floor(Math.random() * LOADING_MESSAGES.length);
}

export function CoffeeLoading() {
  const [messageIndex, setMessageIndex] = useState(() => getRandomMessageIndex());
  const [used, setUsed] = useState<Set<number>>(() => new Set([messageIndex]));

  const messageOpacity = useRef(new Animated.Value(1)).current;
  // Irregular rotation: different keyframes so it doesn't feel mechanical
  const rotateValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(1)).current;

  // Rotate message with crossfade and cycle through colors
  useEffect(() => {
    const t = setInterval(() => {
      Animated.timing(messageOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
        easing: easeInOut,
      }).start(() => {
        setUsed((prev) => {
          if (prev.size >= LOADING_MESSAGES.length) {
            const i = getRandomMessageIndex();
            setMessageIndex(i);
            return new Set([i]);
          }
          const available = LOADING_MESSAGES.map((_, idx) => idx).filter((idx) => !prev.has(idx));
          const i = available[Math.floor(Math.random() * available.length)];
          setMessageIndex(i);
          return new Set([...prev, i]);
        });
        Animated.timing(messageOpacity, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
          easing: easeInOut,
        }).start();
      });
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [messageOpacity]);

  // Irregular logo animation: rotation with varying speed + subtle scale wobble
  useEffect(() => {
    const rotation = Animated.loop(
      Animated.sequence([
        Animated.timing(rotateValue, {
          toValue: 1,
          duration: 2200,
          useNativeDriver: true,
          easing: easeInOut,
        }),
        Animated.timing(rotateValue, {
          toValue: 2,
          duration: 1800,
          useNativeDriver: true,
          easing: easeOut,
        }),
        Animated.timing(rotateValue, {
          toValue: 3,
          duration: 2500,
          useNativeDriver: true,
          easing: easeInOut,
        }),
        Animated.timing(rotateValue, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    rotation.start();
    return () => rotation.stop();
  }, [rotateValue]);

  const spin = rotateValue.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: ['0deg', '360deg', '720deg', '1080deg'],
  });

  // Scale: irregular pulse (slightly different timing so it doesn't sync with rotation)
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleValue, {
          toValue: 1.08,
          duration: 1300,
          useNativeDriver: true,
          easing: easeInOut,
        }),
        Animated.timing(scaleValue, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
          easing: easeInOut,
        }),
        Animated.timing(scaleValue, {
          toValue: 1.06,
          duration: 900,
          useNativeDriver: true,
          easing: easeOut,
        }),
        Animated.timing(scaleValue, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
          easing: easeInOut,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [scaleValue]);

  const currentColor = STATE_COLORS[messageIndex % STATE_COLORS.length];
  const currentMessage = LOADING_MESSAGES[messageIndex];

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoWrap,
          {
            transform: [{ rotate: spin }, { scale: scaleValue }],
          },
        ]}
      >
        <Image
          source={require('../../assets/logo_transparent.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
      <View style={styles.textWrap}>
        <Animated.View style={{ opacity: messageOpacity }}>
          <Text
            style={[styles.message, { color: currentColor }]}
            numberOfLines={1}
          >
            {currentMessage}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    minWidth: 260,
    maxWidth: 280,
  },
  logoWrap: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  logo: {
    width: 28,
    height: 28,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    height: 22,
  },
  message: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    letterSpacing: 0.02,
  },
});
