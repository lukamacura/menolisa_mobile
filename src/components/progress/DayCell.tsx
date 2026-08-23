import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../theme/tokens';
import { toPercent, type DayProgress } from '../../lib/planHistoryTypes';
import { PillarRing } from './PillarRing';

/** A day is "closed" when all three arcs meet. Rare, and it should feel that way. */
const COMPLETE = 0.999;

type DayCellProps = {
  day: DayProgress;
  /** Column width. The ring sizes itself inside it. */
  width: number;
  onPress: (day: DayProgress) => void;
};

/** "5 Sep" — what the accessibility label calls the day. */
function shortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * One day of the plan, as three arcs.
 *
 * A future day is drawn but not scored and not tappable — she can see the shape
 * of the eight weeks without being told she is already behind on them.
 *
 * There is deliberately **no failure state**: a day she missed is an unfilled
 * ring in the same neutral as an untouched one, never red, never a warning
 * tint. A woman opens this screen after a bad fortnight; the grid's job is to
 * show her the good days she forgot she had, not to score her.
 */
export function DayCell({ day, width, onPress }: DayCellProps) {
  const size = Math.min(width - 4, 44);
  const future = day.state === 'future';
  const today = day.state === 'today';
  const complete = !future && day.score >= COMPLETE;

  const dayNumber = ((day.dayOfPlan - 1) % 7) + 1;

  const label = future
    ? `${shortDate(day.date)}, still to come`
    : `${shortDate(day.date)}, ${toPercent(day.score)} percent complete`;

  const ring = (
    <PillarRing
      movement={day.movement?.ratio ?? null}
      nutrition={day.nutrition?.ratio ?? null}
      relaxation={day.relaxation?.ratio ?? null}
      size={size}
      strokeWidth={size >= 40 ? 4 : 3.5}
    >
      {complete ? (
        <Ionicons name="checkmark" size={Math.round(size * 0.4)} color={colors.success} />
      ) : (
        <Text
          style={[
            styles.number,
            future && styles.numberFuture,
            today && styles.numberToday,
          ]}
          allowFontScaling={false}
        >
          {dayNumber}
        </Text>
      )}
    </PillarRing>
  );

  return (
    <View style={[styles.cell, { width }]}>
      {future ? (
        <View style={styles.inner} accessible accessibilityLabel={label}>
          {ring}
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.inner, pressed && styles.pressed]}
          onPress={() => onPress(day)}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          {ring}
        </Pressable>
      )}
      <View style={[styles.marker, today && styles.markerToday]} />
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    alignItems: 'center',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    // Pads the ring out to a 44pt touch target without widening the column.
    paddingVertical: 2,
  },
  pressed: {
    opacity: 0.6,
  },
  number: {
    fontFamily: typography.family.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  numberFuture: {
    color: colors.borderStrong,
  },
  numberToday: {
    fontFamily: typography.family.bold,
    color: colors.primaryDark,
  },
  marker: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginTop: 3,
    backgroundColor: 'transparent',
  },
  markerToday: {
    backgroundColor: colors.primary,
  },
});
