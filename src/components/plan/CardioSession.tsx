import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../../theme/tokens';
import { formatClock, formatDuration } from '../../lib/planFormat';
import { cardioProtocol, INTERVALS_ID } from '../../lib/cardio';
import type { PlanExercise } from '../../lib/planTypes';
import type { SessionPlayer } from '../../hooks/useSessionPlayer';
import { REST_BUMP_SECONDS } from '../../hooks/useSessionPlayer';
import { AnimatedPressable } from '../AnimatedPressable';
import { useReduceMotion } from '../StaggeredZoomIn';
import { PracticeHalo } from './PracticeHalo';
import { ProgressRing } from './ProgressRing';
import { CardioProtocol } from './CardioProtocol';

/** Big enough to read from a pocket-height glance mid-walk, small enough to leave room for the copy. */
const RING_SIZE = 212;
/** `25:00` at 30% of 212pt would run through the stroke on both sides. */
const CLOCK_SIZE = 44;
/** The halo, in the movement coral rather than the relaxation lavender. */
const HALO_TINT = 'rgba(244, 124, 151, 0.22)';

type CardioSessionProps = {
  /** The task's own title — "Zone 2 cardio", "Sprint intervals". */
  title: string;
  /** The one exercise the task holds. Its `props` line is the whole equipment story. */
  exercise: PlanExercise;
  /** The same player the strength runner uses, opened straight onto its single block. */
  player: SessionPlayer;
  /** False until she taps Start. The player is disarmed until then. */
  started: boolean;
  /** How this session counts toward her week. Null when the task has no cadence to state. */
  cadenceNote: string | null;
  onStart: () => void;
  onLeave: () => void;
};

/**
 * A walk, a bike ride, or the one interval day — one countdown and nothing else.
 *
 * The strength runner is a full-bleed video stage with a traffic light around
 * it, and every part of that is wrong here. A cardio task is a `K` row: a dose
 * rather than a movement, with no clip now and none ever (see `ExerciseVideo`),
 * no sets to count through, no rest to sit in, and no warm-up or cool-down
 * because a walk warms up by being a walk. Run through that screen it became
 * twenty-five minutes of dark navy nothing with a countdown chip in the corner
 * — a session that looked like a video that had failed to load.
 *
 * So it gets the practice timer's shape instead, which is the shape of every
 * other single-block thing in this app: a ring, a halo with a pulse to it, and
 * the name and props of what she is doing. What it keeps from the runner is the
 * part that matters — the same `useSessionPlayer`, so the clock is read off
 * `Date.now()` and goes on running with the phone in her pocket, and finishing
 * it logs the session down exactly the same path a finished workout does.
 *
 * The interval day gets one thing more: its structure, in words. The API sends
 * it as nineteen minutes and a name, and nineteen minutes with no rounds
 * printed anywhere is just a shorter walk — see `cardioProtocol()`.
 */
export function CardioSession({
  title,
  exercise,
  player,
  started,
  cadenceNote,
  onStart,
  onLeave,
}: CardioSessionProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const { remaining, duration, paused } = player;
  const total = duration ?? 0;
  const left = remaining ?? total;
  const elapsed = Math.max(0, total - left);
  const running = started && !paused;

  const protocol = cardioProtocol(exercise);
  // The catalog writes "None" for anything that needs nothing. Cardio rows list
  // modalities rather than equipment, but the guard is the same one every other
  // props line in the app gets.
  const props = exercise.props && exercise.props.toLowerCase() !== 'none' ? exercise.props : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xs }]}>
      {/* The same wash the setup card wears. This screen is the calm end of the
          movement pillar and should not look like the stage. */}
      <LinearGradient
        colors={[colors.surfaceElevated, colors.background]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.bar}>
        <AnimatedPressable
          containerStyle={styles.leaveWrap}
          style={styles.leave}
          onPress={onLeave}
          accessibilityRole="button"
          accessibilityLabel={started ? 'End session' : 'Close'}
        >
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </AnimatedPressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.iconWrap}>
          <Ionicons
            name={exercise.id === INTERVALS_ID ? 'flash' : 'walk'}
            size={22}
            color={colors.primaryDark}
          />
        </View>

        <Text style={styles.title}>{title}</Text>
        {/* Only when the catalog's name for the dose is not already the title —
            today they are the same string, and printing it twice would read as
            a bug rather than as detail. */}
        {exercise.name !== title && <Text style={styles.name}>{exercise.name}</Text>}
        {props && <Text style={styles.props}>{props}</Text>}
        {/* Why a walk at this pace is worth twenty-five minutes, in the
            catalog's words. Above the ring on purpose: the whole of this screen
            after she taps Start is a clock, and a reason arrives too late once
            she is out of the door. Absent on rows the catalog has none for. */}
        {exercise.why && <Text style={styles.why}>{exercise.why}</Text>}
        {cadenceNote && <Text style={styles.cadence}>{cadenceNote}</Text>}

        <View style={styles.stage}>
          <PracticeHalo
            size={RING_SIZE}
            active={running}
            reduceMotion={reduceMotion}
            tint={HALO_TINT}
          />
          <ProgressRing
            value={elapsed}
            total={total}
            size={RING_SIZE}
            strokeWidth={10}
            color={colors.primary}
            label={formatClock(left)}
            labelSize={CLOCK_SIZE}
          />
        </View>

        {/* What the face is counting down from, once it has left it. Before she
            starts, the face is already showing the total and printing it again
            under the ring says the same thing twice. */}
        {started && <Text style={styles.totalNote}>of {formatDuration(total)}</Text>}

        {protocol && <CardioProtocol steps={protocol} style={styles.protocol} />}
      </ScrollView>

      <View style={[styles.foot, { paddingBottom: insets.bottom + spacing.md }]}>
        <AnimatedPressable
          containerStyle={styles.primaryWrap}
          style={styles.primary}
          onPress={started ? player.togglePause : onStart}
          accessibilityRole="button"
          accessibilityLabel={!started ? 'Start the timer' : paused ? 'Resume' : 'Pause'}
        >
          <Ionicons
            name={running ? 'pause' : 'play'}
            size={20}
            color={colors.textInverse}
          />
          <Text style={styles.primaryText}>
            {!started ? 'Start' : paused ? 'Resume' : 'Pause'}
          </Text>
        </AnimatedPressable>

        {/* The clock is a dose, not a deadline. A slower morning, a longer loop
            home, a set of lights — none of them should cost her the session. */}
        {started && (
          <AnimatedPressable
            containerStyle={styles.secondaryWrap}
            style={styles.secondary}
            onPress={player.addTime}
            accessibilityRole="button"
            accessibilityLabel={`Add ${REST_BUMP_SECONDS} seconds`}
          >
            <Ionicons name="add" size={16} color={colors.text} />
            <Text style={styles.secondaryText}>+{REST_BUMP_SECONDS} sec</Text>
          </AnimatedPressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
  },
  leaveWrap: {
    width: 'auto',
  },
  leave: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  body: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  iconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(244, 124, 151, 0.14)',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.presets.heading2,
    color: colors.text,
    textAlign: 'center',
  },
  name: {
    ...typography.presets.bodyMedium,
    color: colors.text,
    textAlign: 'center',
    marginTop: 2,
  },
  props: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  cadence: {
    ...typography.presets.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  why: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    // Two sentences centred across a full-width screen read as a banner; held
    // to a paragraph's width they read as part of the exercise.
    maxWidth: 320,
  },
  stage: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  totalNote: {
    ...typography.presets.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  protocol: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
  foot: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  primaryWrap: {
    marginTop: 0,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: minTouchTarget + 6,
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
    ...shadows.buttonPrimary,
  },
  primaryText: {
    ...typography.presets.button,
    color: colors.textInverse,
  },
  secondaryWrap: {
    marginTop: 0,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: minTouchTarget,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: {
    ...typography.presets.buttonSmall,
    color: colors.text,
  },
});
