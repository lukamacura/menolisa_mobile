import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const WARM_AMBER = '#D97706';
const WARM_BROWN = '#92400E';

const LOADING_MESSAGES: { text: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { text: 'Taking a mindful moment...', icon: 'heart' },
  { text: 'Gathering wisdom for you...', icon: 'book' },
  { text: "Getting Lisa's notes ready...", icon: 'cafe' },
  { text: 'Sitting with this a moment...', icon: 'moon' },
  { text: 'Connecting the dots...', icon: 'sparkles' },
  { text: 'Finding the perfect words...', icon: 'create-outline' },
  { text: 'Crafting a response...', icon: 'bulb' },
  { text: 'Reflecting on your question...', icon: 'school' },
  { text: 'Nurturing this thought...', icon: 'flower' },
  { text: 'Bringing clarity to light...', icon: 'sunny' },
  { text: "Seeing what Lisa noticed...", icon: 'star' },
  { text: 'Growing understanding...', icon: 'leaf' },
];

function getRandomMessage() {
  return LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
}

export function CoffeeLoading() {
  const [current, setCurrent] = useState(getRandomMessage);
  const [used, setUsed] = useState<Set<number>>(() => {
    const i = LOADING_MESSAGES.findIndex((m) => m.text === getRandomMessage().text);
    return new Set([i >= 0 ? i : 0]);
  });

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dotAnims = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const t = setInterval(() => {
      setUsed((prev) => {
        if (prev.size >= LOADING_MESSAGES.length) {
          const i = Math.floor(Math.random() * LOADING_MESSAGES.length);
          setCurrent(LOADING_MESSAGES[i]);
          return new Set([i]);
        }
        const available = LOADING_MESSAGES.map((_, idx) => idx).filter((idx) => !prev.has(idx));
        const i = available[Math.floor(Math.random() * available.length)];
        setCurrent(LOADING_MESSAGES[i]);
        return new Set([...prev, i]);
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    const dots = dotAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            delay: i * 100,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      )
    );
    dots.forEach((d) => d.start());
    return () => dots.forEach((d) => d.stop());
  }, [dotAnims]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
        <Ionicons name={current.icon} size={20} color={WARM_AMBER} />
      </Animated.View>
      <View style={styles.textWrap}>
        <Text style={styles.message} numberOfLines={1}>
          {current.text}
        </Text>
      </View>
      <View style={styles.dots}>
        {dotAnims.map((anim, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                opacity: anim,
                transform: [
                  {
                    scale: anim.interpolate({
                      inputRange: [0.3, 1],
                      outputRange: [0.8, 1.2],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
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
  iconWrap: {
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    height: 20,
  },
  message: {
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    color: WARM_BROWN,
    letterSpacing: 0.01,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: WARM_AMBER,
  },
});
