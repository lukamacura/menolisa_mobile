import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/tokens';
import { badgeTint, badgeVisual, LOCKED_VISUAL } from '../../lib/rewardVisuals';

type BadgeMedalProps = {
  familyId: string;
  unlocked: boolean;
  /** 0-1 toward the next tier. Drawn as the ring around the medal. */
  progress: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * One achievement, as a round medal with its progress drawn around the rim.
 *
 * A locked badge still shows its own icon rather than a padlock, greyed. She
 * should be able to see what she is working toward — a grid of identical
 * padlocks is a grid with nothing to aim at.
 */
export function BadgeMedal({ familyId, unlocked, progress, size = 64, style }: BadgeMedalProps) {
  const visual = badgeVisual(familyId);
  const tint = unlocked ? visual.tint : LOCKED_VISUAL.tint;
  // Fill and rim are the badge's own hue, so the medal reads as coloured from
  // across the grid rather than as an icon on white.
  const fill = badgeTint(tint, unlocked ? 0.16 : 0.08);
  const track = unlocked ? badgeTint(tint, 0.26) : colors.border;

  const strokeWidth = Math.max(3, Math.round(size * 0.06));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const ratio = Math.min(1, Math.max(0, progress));

  return (
    <View style={[{ width: size, height: size }, styles.container, style]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={track}
          strokeWidth={strokeWidth}
          fill={fill}
        />
        {ratio > 0 && (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={tint}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - ratio)}
            transform={`rotate(-90 ${center} ${center})`}
          />
        )}
      </Svg>
      <Ionicons name={visual.icon} size={Math.round(size * 0.42)} color={tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
