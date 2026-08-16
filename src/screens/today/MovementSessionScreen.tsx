import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../../theme/tokens';
import type { TodayStackParamList } from '../../navigation/types';
import { usePlan, tasksForPillar } from '../../context/PlanContext';
import {
  exerciseDose,
  formatClock,
  sessionProps,
  sessionSeconds,
  setInstruction,
} from '../../lib/planFormat';
import type { PlanExercise } from '../../lib/planTypes';
import { ProgressRing } from '../../components/plan/ProgressRing';
import { ExerciseVideo } from '../../components/plan/ExerciseVideo';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { GratitudeSuccessPanel } from '../../components/GratitudeSuccessPanel';
import { useReduceMotion } from '../../components/StaggeredZoomIn';
import {
  useSessionPlayer,
  REST_BUMP_SECONDS,
  type SessionExercise,
  type SessionPlayer,
  type SessionStep,
} from '../../hooks/useSessionPlayer';

/** The ring every step reads from, work or rest, so nothing on the stage jumps. */
const METRIC_SIZE = 132;

type Nav = NativeStackNavigationProp<TodayStackParamList, 'MovementSession'>;

/**
 * The shell for every branch of this screen that isn't the running session.
 *
 * Deliberately not PlanScreenLayout, for the same two reasons the runner isn't:
 * this route has no nav header, so nothing above it pays for the status bar and
 * the content would sit under the clock — and that shell's pull-to-refresh can
 * swap the plan, and with it the task, out from under a session in progress.
 */
function SessionShell({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.shell}>
      <ScrollView
        contentContainerStyle={[
          styles.shellContent,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/**
 * The guided session: one exercise at a time, one set at a time.
 *
 * Two rules shape everything on this screen. It runs itself — every step hands
 * over to the next on a clock, so a whole session can be done with the phone on
 * the floor and never touched; every button here is an override she may use, not
 * a step she must take. And leaving early never costs her the session: two
 * exercises out of four on three hours of sleep is a good day, and the app has
 * to be able to say so.
 */
export function MovementSessionScreen() {
  const route = useRoute<RouteProp<TodayStackParamList, 'MovementSession'>>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const { currentWeek, tick } = usePlan();

  const tasks = tasksForPillar(currentWeek, 'movement');
  const task = tasks.find((entry) => entry.key === route.params.taskKey) ?? tasks[0] ?? null;
  const exercises = useMemo(() => task?.exercises ?? [], [task]);

  const [started, setStarted] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  // Snacks are four ~5-minute bursts a day. They get the same player with the
  // ceremony stripped out — no long rests, no waiting on a "next up" card.
  const compact = task?.cadence === 'per_day';

  const logSession = useCallback(() => {
    if (!task) return;
    // `count` replaces the day's total, so a second session today sends 2.
    tick(task.key, task.doneToday + 1).catch(() => {});
  }, [task, tick]);

  const finish = useCallback(() => {
    logSession();
    setCelebrating(true);
  }, [logSession]);

  const player = useSessionPlayer(exercises, { compact, onFinish: finish });

  // Only while she is actually working. Released the moment this unmounts, so a
  // session left open on the counter can't sit there draining her battery.
  useKeepAwake();

  const leave = useCallback(() => {
    const halfway = player.setsTotal > 0 && player.setsDone >= player.setsTotal / 2;
    if (!halfway) {
      navigation.goBack();
      return;
    }
    Alert.alert(
      'End this session?',
      "You've done most of it. Want it logged?",
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Just leave', style: 'destructive', onPress: () => navigation.goBack() },
        {
          text: 'Log it as done',
          onPress: () => {
            logSession();
            navigation.goBack();
          },
        },
      ],
      { cancelable: true }
    );
  }, [navigation, player.setsDone, player.setsTotal, logSession]);

  // This screen runs without a nav header so the session can own the display, so
  // every branch has to carry its own way out — there is no back chevron and no
  // back-swipe to fall through to.
  if (!task || !exercises.length) {
    return (
      <SessionShell>
        <Text style={styles.empty}>Nothing scheduled this week.</Text>
        <AnimatedPressable
          containerStyle={styles.primaryWrap}
          style={styles.primary}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.primaryText}>Back</Text>
        </AnimatedPressable>
      </SessionShell>
    );
  }

  if (celebrating) {
    // The panel is a full-height layout that centres itself, so it gets the
    // screen rather than a scroll shell — inside one it has no height to centre
    // in and lands under the status bar with the whole page empty beneath it.
    return (
      <View style={[styles.celebration, { paddingTop: insets.top }]}>
        <GratitudeSuccessPanel
          title="Session done"
          subtitle={task.why}
          encouragement="That's muscle and bone that wasn't there this morning."
          metaChips={[{ icon: 'barbell', label: task.title }]}
          reduceMotion={reduceMotion}
        />
        <View style={[styles.celebrationFooter, { paddingBottom: insets.bottom + spacing.lg }]}>
          <AnimatedPressable
            containerStyle={styles.primaryWrap}
            style={styles.primary}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back to your plan"
          >
            <Text style={styles.primaryText}>Back to your plan</Text>
          </AnimatedPressable>
        </View>
      </View>
    );
  }

  if (!started) {
    return (
      <SessionSetup
        title={task.title}
        exercises={exercises}
        onStart={() => setStarted(true)}
        onClose={() => navigation.goBack()}
      />
    );
  }

  return (
    <SessionRunner
      player={player}
      title={task.title}
      exerciseCount={exercises.length}
      onLeave={leave}
    />
  );
}

/**
 * What she needs before she starts, on one screen.
 *
 * The equipment list is the whole point of this step — discovering at exercise
 * four that it wanted a resistance band is how a session gets abandoned.
 */
function SessionSetup({
  title,
  exercises,
  onStart,
  onClose,
}: {
  title: string;
  exercises: PlanExercise[];
  onStart: () => void;
  onClose: () => void;
}) {
  const props = sessionProps(exercises);
  const minutes = Math.max(1, Math.round(sessionSeconds(exercises) / 60));

  return (
    <SessionShell>
      <View style={styles.setupHead}>
        <View style={styles.setupHeadText}>
          <Text style={styles.setupTitle}>{title}</Text>
          <Text style={styles.setupMeta}>
            {exercises.length} exercises · about {minutes} min
          </Text>
          {/* Said once, up front, so she can put the phone down and trust it. */}
          <Text style={styles.setupHint}>
            Hands-free — every set and rest moves on by itself.
          </Text>
        </View>
        <AnimatedPressable
          containerStyle={styles.leaveWrap}
          style={styles.leave}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </AnimatedPressable>
      </View>

      {props.length > 0 && (
        <View style={styles.propsCard}>
          <Text style={styles.propsLabel}>You'll need</Text>
          <Text style={styles.propsList}>{props.join(' · ')}</Text>
        </View>
      )}

      <View style={styles.setupList}>
        {exercises.map((exercise, index) => (
          <View key={`${exercise.id}-${index}`} style={styles.setupRow}>
            <Text style={styles.setupIndex}>{index + 1}</Text>
            <View style={styles.setupRowText}>
              <Text style={styles.setupName}>{exercise.name}</Text>
              <Text style={styles.setupProps}>{exercise.props}</Text>
            </View>
            <Text style={styles.setupDose}>{exerciseDose(exercise) ?? ''}</Text>
          </View>
        ))}
      </View>

      <AnimatedPressable
        containerStyle={styles.primaryWrap}
        style={styles.primary}
        onPress={onStart}
        accessibilityRole="button"
        accessibilityLabel="Start the guided session"
      >
        <Ionicons name="play" size={20} color={colors.textInverse} />
        <Text style={styles.primaryText}>Start session</Text>
      </AnimatedPressable>
    </SessionShell>
  );
}

/**
 * The three lines of copy the stage is allowed to show, for any step.
 *
 * Every step reads the same way — a state label, the exercise it belongs to, and
 * one detail — so nothing on the screen moves or changes meaning between work,
 * rest and the card in between. Earlier this screen had a different shape per
 * step, and the number of lines swung between two and five; on the floor,
 * mid-set, that is a screen you have to re-read every time it changes.
 */
function stageCopy(step: SessionStep, current: SessionExercise): {
  label: string;
  support: string | null;
} {
  const { exercise, dose } = current;
  // The catalog writes "None" for bodyweight work. It is not a thing to fetch.
  const props = exercise.props && exercise.props.toLowerCase() !== 'none' ? exercise.props : null;

  if (step.kind === 'transition') {
    return { label: 'Next up', support: [exerciseDose(exercise), props].filter(Boolean).join(' · ') || null };
  }
  if (step.kind === 'switch') {
    return { label: 'Switch sides', support: 'Same move, other side.' };
  }
  if (step.kind === 'rest') {
    return { label: 'Rest', support: `Then: set ${step.set + 1} of ${dose.sets}` };
  }
  // Unreachable — the runner returns before it renders a finished session.
  if (step.kind === 'done') {
    return { label: '', support: null };
  }

  const label = dose.sets > 1 ? `Set ${step.set} of ${dose.sets}` : 'Your turn';
  if (dose.perSide) {
    return { label, support: step.side === 0 ? 'Left side' : 'Right side' };
  }
  return { label, support: props ?? setInstruction(dose) };
}

/**
 * The running session — work, rest and the card between exercises.
 *
 * One skeleton, four zones, top to bottom: how far in she is, what the movement
 * looks like, the one number that matters right now, and what to tap. Which step
 * she is on changes what fills those zones, never how many there are.
 */
function SessionRunner({
  player,
  title,
  exerciseCount,
  onLeave,
}: {
  player: SessionPlayer;
  title: string;
  exerciseCount: number;
  onLeave: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { step, current, remaining, duration, paused } = player;
  if (!current || step.kind === 'done') return null;

  const { exercise, dose } = current;
  const timed = duration !== null;
  const resting = step.kind === 'rest' || step.kind === 'switch';
  const working = step.kind === 'work';
  const { label, support } = stageCopy(step, current);

  return (
    // Deliberately not PlanScreenLayout. That shell is a ScrollView with
    // pull-to-refresh, and a session is a fixed, full-height screen she is
    // looking at from the floor — nothing here should scroll or reload under her.
    <View
      style={[
        styles.runner,
        { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md },
      ]}
    >
      <View style={styles.runnerTop}>
        <AnimatedPressable
          containerStyle={styles.leaveWrap}
          style={styles.leave}
          onPress={onLeave}
          accessibilityRole="button"
          accessibilityLabel="End session"
        >
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </AnimatedPressable>
        <View style={styles.trackWrap}>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${Math.round(player.progress * 100)}%` }]} />
          </View>
          <Text style={styles.trackLabel} numberOfLines={1}>
            {title} · {step.index + 1} of {exerciseCount}
          </Text>
        </View>
      </View>

      {/* The demonstration. It stays up through the rest as well as the work —
          the rest is the one moment she has both hands free to watch the next
          set being done properly. Until clips are uploaded this is a designed
          placeholder holding exactly the space they will take. */}
      <ExerciseVideo exercise={exercise} style={styles.video} />

      <View style={styles.stage}>
        <Text style={styles.eyebrow}>{label}</Text>
        <Text style={styles.exerciseName} numberOfLines={2}>
          {exercise.name}
        </Text>

        <View style={styles.metric}>
          {timed ? (
            <ProgressRing
              value={(duration ?? 0) - (remaining ?? 0)}
              total={duration ?? 1}
              size={METRIC_SIZE}
              strokeWidth={9}
              color={working ? colors.primary : colors.lavender}
              label={formatClock(remaining ?? 0)}
              labelSize={38}
            />
          ) : (
            // Only reachable if the dose arrived without anything runnable in it.
            <Text style={styles.dose}>{exerciseDose(exercise)}</Text>
          )}
        </View>

        {support && (
          <Text style={styles.support} numberOfLines={2}>
            {support}
          </Text>
        )}
      </View>

      <View style={styles.controls}>
        <AnimatedPressable
          containerStyle={styles.primaryWrap}
          style={styles.primary}
          onPress={player.advance}
          accessibilityRole="button"
          accessibilityLabel={
            resting
              ? 'Move on now'
              : step.kind === 'transition'
                ? 'Start now'
                : 'Finished early, move on'
          }
        >
          {/* Nothing here has to be tapped for the session to run. This is the
              "I'm ahead of the clock" button, on every step. */}
          <Text style={styles.primaryText}>
            {resting ? 'I’m ready' : step.kind === 'transition' ? 'Start now' : 'Done'}
          </Text>
        </AnimatedPressable>

        {/* Always the same slots in the same order — time, pause, skip — so the
            row under her thumb keeps its shape from one step to the next. */}
        <View style={styles.secondaryRow}>
          {timed && step.kind !== 'transition' && (
            <SecondaryButton
              icon="add"
              label={`+${REST_BUMP_SECONDS} sec`}
              accessibilityLabel={`Add ${REST_BUMP_SECONDS} seconds`}
              onPress={player.addTime}
            />
          )}
          {timed && working && (
            <SecondaryButton
              icon={paused ? 'play' : 'pause'}
              label={paused ? 'Resume' : 'Pause'}
              onPress={player.togglePause}
            />
          )}
          <SecondaryButton
            icon="play-skip-forward"
            label="Skip"
            accessibilityLabel="Skip this exercise"
            onPress={player.skipExercise}
          />
        </View>
      </View>
    </View>
  );
}

function SecondaryButton({
  icon,
  label,
  accessibilityLabel,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable
      containerStyle={styles.secondaryWrap}
      style={styles.secondary}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Ionicons name={icon} size={16} color={colors.text} />
      <Text style={styles.secondaryText}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.background,
  },
  shellContent: {
    paddingHorizontal: spacing.lg,
  },
  empty: {
    ...typography.presets.body,
    color: colors.textMuted,
  },

  // Celebration
  celebration: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
  },
  celebrationFooter: {
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surfaceElevated,
  },

  // Setup
  setupHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  setupHeadText: {
    flex: 1,
    minWidth: 0,
  },
  setupTitle: {
    ...typography.presets.heading2,
    color: colors.text,
  },
  setupMeta: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    marginTop: 2,
  },
  setupHint: {
    ...typography.presets.caption,
    color: colors.primaryDark,
    marginTop: 4,
  },
  propsCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  propsLabel: {
    ...typography.presets.label,
    color: colors.textMuted,
  },
  propsList: {
    ...typography.presets.bodyMedium,
    color: colors.text,
    marginTop: 2,
  },
  setupList: {
    marginTop: spacing.md,
  },
  setupListContent: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  setupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  setupIndex: {
    ...typography.presets.caption,
    fontFamily: typography.family.semibold,
    color: colors.primaryDark,
    width: 16,
    textAlign: 'center',
  },
  setupRowText: {
    flex: 1,
    minWidth: 0,
  },
  setupName: {
    ...typography.presets.bodyMedium,
    color: colors.text,
  },
  setupProps: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },
  setupDose: {
    ...typography.presets.caption,
    fontFamily: typography.family.semibold,
    color: colors.text,
  },

  // Runner chrome
  runner: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  runnerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
    backgroundColor: colors.surfaceElevated,
  },
  trackWrap: {
    flex: 1,
    gap: 4,
  },
  track: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.success,
  },
  trackLabel: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },

  // Stage
  /**
   * The clip takes whatever height is left once the readout and the controls
   * have theirs — it is the only elastic thing on the screen, so a small phone
   * loses picture rather than losing the number she is reading.
   */
  video: {
    width: '100%',
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 132,
    maxHeight: 260,
    marginTop: spacing.md,
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  eyebrow: {
    ...typography.presets.label,
    color: colors.textMuted,
    textAlign: 'center',
  },
  exerciseName: {
    ...typography.presets.heading2,
    color: colors.text,
    textAlign: 'center',
  },
  // Fixed, so the ring, the rep count and the plain dose all occupy one slot of
  // the same height — the layout never reflows as the session moves through them.
  metric: {
    height: METRIC_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  dose: {
    ...typography.presets.heading2,
    color: colors.primaryDark,
  },
  support: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
  },

  // Controls
  controls: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  primaryWrap: {
    marginTop: spacing.md,
    width: '100%',
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: minTouchTarget + 12,
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
    ...shadows.buttonPrimary,
  },
  primaryText: {
    ...typography.presets.button,
    color: colors.textInverse,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  secondaryWrap: {
    width: 'auto',
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: {
    ...typography.presets.buttonSmall,
    color: colors.text,
  },
});

export default MovementSessionScreen;
