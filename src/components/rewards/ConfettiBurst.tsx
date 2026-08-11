import React from 'react';
import { StyleSheet, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { useReduceMotion } from '../StaggeredZoomIn';

type ConfettiBurstProps = {
  /** Mount with this true to play. Remount (via `key`) to replay. */
  visible: boolean;
};

/**
 * A one-shot confetti fall over whatever is already on screen.
 *
 * Never interactive: it covers the dismiss button of the modal it celebrates,
 * so `pointerEvents="none"` is what keeps that button reachable through it.
 *
 * Skipped entirely under Reduce Motion. Confetti is decoration — the modal
 * underneath already carries the whole message, so there is nothing to replace
 * it with.
 */
export function ConfettiBurst({ visible }: ConfettiBurstProps) {
  const reduceMotion = useReduceMotion();
  if (!visible || reduceMotion) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <LottieView
        source={require('../../../assets/Confeti.json')}
        autoPlay
        loop={false}
        style={styles.lottie}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    // Above the modal card it celebrates, so pieces fall in front of the badge.
    zIndex: 10,
  },
  lottie: {
    flex: 1,
  },
});
