import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../../theme/tokens';
import { useReduceMotion } from '../StaggeredZoomIn';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Animated SVG props go through the native shadow tree, which react-native-web has none of. */
const CAN_ANIMATE_ARC = Platform.OS !== 'web';

const SWEEP_MS = 700;

/** Degrees of empty space between arcs. Enough to read three, not enough to look broken. */
const GAP_DEG = 12;
const ARC_DEG = 360 / 3 - GAP_DEG;

/** Fixed order — the arcs must sit in the same place on every ring in the app. */
export const PILLAR_TINTS = {
  movement: colors.primary,
  nutrition: colors.blue,
  relaxation: colors.lavender,
} as const;

type PillarRingProps = {
  /**
   * 0-1 each. **`null` means the plan asked nothing of her** — that arc renders
   * as a ghost rather than an empty track, because a rest day is not a miss.
   */
  movement: number | null;
  nutrition: number | null;
  relaxation: number | null;
  size?: number;
  strokeWidth?: number;
  /** Reanimated sweep. Off by default: fifty-six animated day cells jank on Android. */
  animate?: boolean;
  animateDelayMs?: number;
  /** Rendered in the middle — a day number, a percentage, a check. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/**
 * Three arcs on one circle: movement, nutrition, relaxation.
 *
 * The whole progress feature reads off this shape, so it is worth being exact
 * about what it says. Each pillar owns a third of the circle whatever its
 * denominator is — nutrition has ten rows and relaxation has one, so counting
 * raw items instead would make every ring ninety percent teal and tell her
 * nothing.
 *
 * A completed day therefore *closes the circle*, which is the only reward
 * animation this screen needs.
 */
export function PillarRing({
  movement,
  nutrition,
  relaxation,
  size = 40,
  strokeWidth = 4,
  animate = false,
  animateDelayMs = 0,
  children,
  style,
  accessibilityLabel,
}: PillarRingProps) {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * (ARC_DEG / 360);

  const arcs = [
    { ratio: movement, tint: PILLAR_TINTS.movement },
    { ratio: nutrition, tint: PILLAR_TINTS.nutrition },
    { ratio: relaxation, tint: PILLAR_TINTS.relaxation },
  ];

  return (
    <View
      style={[styles.container, { width: size, height: size }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size}>
        {arcs.map((arc, index) => {
          // Dashes start at 3 o'clock, so -90 puts arc one at the top.
          const rotation = -90 + index * (360 / 3) + GAP_DEG / 2;
          const asked = arc.ratio !== null;

          return (
            <G key={index} transform={`rotate(${rotation} ${center} ${center})`}>
              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke={asked ? colors.border : colors.plumSoft}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${arcLength} ${circumference}`}
              />
              {asked && arc.ratio! > 0 ? (
                <Arc
                  center={center}
                  radius={radius}
                  strokeWidth={strokeWidth}
                  tint={arc.tint}
                  arcLength={arcLength}
                  circumference={circumference}
                  ratio={arc.ratio!}
                  animate={animate}
                  delayMs={animateDelayMs}
                />
              ) : null}
            </G>
          );
        })}
      </Svg>

      {children ? (
        <View style={styles.center} pointerEvents="none">
          {children}
        </View>
      ) : null}
    </View>
  );
}

type ArcProps = {
  center: number;
  radius: number;
  strokeWidth: number;
  tint: string;
  arcLength: number;
  circumference: number;
  ratio: number;
  animate: boolean;
  delayMs: number;
};

function Arc({
  center,
  radius,
  strokeWidth,
  tint,
  arcLength,
  circumference,
  ratio,
  animate,
  delayMs,
}: ArcProps) {
  const reduceMotion = useReduceMotion();
  const still = !animate || reduceMotion || !CAN_ANIMATE_ARC;

  const progress = useSharedValue(still ? ratio : 0);
  const hasSwept = useRef(false);

  useEffect(() => {
    if (still) {
      progress.value = ratio;
      return;
    }
    const first = !hasSwept.current;
    hasSwept.current = true;
    const timing = withTiming(ratio, { duration: SWEEP_MS, easing: Easing.out(Easing.cubic) });
    progress.value = first && delayMs > 0 ? withDelay(delayMs, timing) : timing;
  }, [ratio, still, delayMs]);

  // The dash stays a fixed arc and the OFFSET moves, rather than animating the
  // dash array itself: `strokeDashoffset` is a single number, which is what
  // reanimated can drive through the native shadow tree — the same trick
  // `ProgressRing` uses. An animated dash *array* is a string, and a string
  // that never applies leaves the ring rendering permanently empty.
  //
  // With `dasharray = [arc, circumference]`, an offset of `arc` hides the whole
  // arc and an offset of 0 shows all of it.
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: arcLength * (1 - progress.value),
  }));

  const common = {
    cx: center,
    cy: center,
    r: radius,
    stroke: tint,
    strokeWidth,
    strokeLinecap: 'round' as const,
    fill: 'none',
    strokeDasharray: `${arcLength} ${circumference}`,
  };

  if (still) {
    return <Circle {...common} strokeDashoffset={arcLength * (1 - ratio)} />;
  }

  return <AnimatedCircle {...common} animatedProps={animatedProps} />;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
