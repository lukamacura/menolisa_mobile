import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, useWindowDimensions } from 'react-native';
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
  isPlanFinished,
  sessionProps,
  sessionSeconds,
  setInstruction,
  taskCadenceHint,
  taskRemainingLabel,
} from '../../lib/planFormat';
import type { PlanExercise } from '../../lib/planTypes';
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

/**
 * Reserved height for the two lines under the clip — name (up to 2) and support
 * (up to 2), at their preset line heights plus the gap between them.
 *
 * Fixed on purpose. The clip is the elastic child, so anything that changes
 * height below it resizes the picture; a one-line support string on one step
 * and a two-line one on the next would make the video breathe between sets.
 */
const CAPTION_HEIGHT = 28 * 2 + spacing.xs + 22 * 2;

/** The clip's own ratio. The box matches it whenever the screen has the room. */
const CLIP_RATIO = 5 / 4;

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
  const { plan, currentWeek, tick } = usePlan();

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
    // What this one session is worth against the week's ask. She is one tap from
    // starting; this is the last place the number can still mean something.
    const finished = plan ? isPlanFinished(plan) : false;
    const cadence = taskCadenceHint(task);
    return (
      <SessionSetup
        title={task.title}
        exercises={exercises}
        cadenceNote={
          cadence
            ? `${taskRemainingLabel(task, finished)} · your plan asks for ${cadence.toLowerCase()}`
            : null
        }
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
 * The doorway: everything she needs to say "yes, now", and nothing else.
 *
 * This screen answers four questions in the order she asks them, and it is laid
 * out in that order rather than in the order the data happens to arrive:
 *
 *   1. **How long is this?** The only question standing between her and the
 *      button, so it is the biggest thing on the screen. It carries its own
 *      "about" — the estimate is honest, and a bare number would read as a
 *      promise the session can't keep on a slow morning.
 *   2. **What do I have to go and fetch?** The reason this step exists at all:
 *      discovering at exercise four that it wanted a resistance band is how a
 *      session gets abandoned.
 *   3. **Does it count?** The cadence line, under the title, quiet.
 *   4. **Do I have to hold the phone?** Answered immediately above the button,
 *      because it is the last doubt before the tap.
 *
 * Two things it deliberately does not do. It does not list the exercises — the
 * runner introduces each one on its own "Next up" card, at the moment it
 * matters, with the clip playing; a preview here repeated all of that before she
 * could act on any of it. And it does not scroll unless it has to: the body
 * centres in whatever room is left and the button is pinned to the bottom, so
 * the tap target is under her thumb on a large phone instead of stranded in the
 * middle above half a screen of nothing.
 */
function SessionSetup({
  title,
  exercises,
  cadenceNote,
  onStart,
  onClose,
}: {
  title: string;
  exercises: PlanExercise[];
  /** How this session counts toward the week. Null when the task has no cadence to state. */
  cadenceNote: string | null;
  onStart: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const props = sessionProps(exercises);
  const minutes = Math.max(1, Math.round(sessionSeconds(exercises) / 60));

  return (
    <View style={[styles.setup, { paddingTop: insets.top + spacing.xs }]}>
      {/* The way out gets its own row. It used to sit beside the title, where a
          44pt tap target and a heading fought over the same line and the heading
          lost a third of its width to it. */}
      <View style={styles.setupBar}>
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

      {/* `flexGrow` + centred content: this centres on a phone with room to
          spare and scrolls on one without, which is the only way a fixed CTA
          and a variable-length gear list can share a screen safely. */}
      <ScrollView
        contentContainerStyle={styles.setupBody}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.setupTitle}>{title}</Text>
        {cadenceNote && <Text style={styles.setupCadence}>{cadenceNote}</Text>}

        <View style={styles.dial} accessibilityRole="text" accessibilityLabel={`About ${minutes} minutes`}>
          <Text style={styles.dialAbout}>about</Text>
          <Text style={styles.dialValue} allowFontScaling={false}>
            {minutes}
          </Text>
          <Text style={styles.dialUnit}>min</Text>
        </View>

        <Text style={styles.setupCount}>
          {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'}, guided end to end
        </Text>

        {props.length > 0 && (
          <View style={styles.propsCard}>
            <Text style={styles.propsLabel}>You'll need</Text>
            <Text style={styles.propsList}>{props.join(' · ')}</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.setupFoot, { paddingBottom: insets.bottom + spacing.md }]}>
        {/* Said once, here, directly above the button — this is the last doubt
            before the tap, and the whole session is designed around the answer. */}
        <View style={styles.setupHintRow}>
          <Ionicons name="phone-portrait-outline" size={14} color={colors.textMuted} />
          <Text style={styles.setupHint}>
            Hands-free — every set and rest moves on by itself.
          </Text>
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
      </View>
    </View>
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
function stageCopy(step: SessionStep, current: SessionExercise, paused: boolean): {
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

  // A stopped clock has to say so. The stage goes neutral while she is paused
  // (see `stageTone`), and a grey chip still reading "Set 2 of 3" looks like a
  // set that is running — the word is what tells her the seconds aren't moving.
  const label = paused
    ? 'Paused'
    : dose.sets > 1
      ? `Set ${step.set} of ${dose.sets}`
      : 'Your turn';
  if (dose.perSide) {
    return { label, support: step.side === 0 ? 'Left side' : 'Right side' };
  }
  return { label, support: props ?? setInstruction(dose) };
}

/**
 * One state's colour, in the three roles it plays: the accent (frame, chip
 * border, countdown bar), the pale surface behind the readout, and the ink that
 * sits on the accent when it is used as a fill.
 */
type StepTone = { tint: string; surface: string; onTint: string };

/**
 * What colour the whole stage is right now.
 *
 * A traffic light, and read as one: **red while she is working, green while she
 * is recovering, amber for the beat spent getting into position.** She is on a
 * mat, at arm's length, with her hands full — the colour tells her which side of
 * the interval she is on before she has focused on a single word.
 *
 * The important part is that it is *one* colour at a time, everywhere at once.
 * The frame around the clip, the chip holding the countdown, the bar draining
 * along the bottom and the button under her thumb all take the same swatch, so
 * the button is never a thing to identify separately — it is just the near end
 * of the state she is already looking at.
 *
 * Two consequences worth knowing before changing anything here:
 *
 * - The work red is `colors.effort`, never `colors.danger`. Red here means
 *   effort, and it must not borrow the swatch that elsewhere in this app means
 *   something has gone wrong.
 * - Green means "rest" on this screen and nothing else, which is why the
 *   session-progress track at the top gave green up — see `trackFill`.
 *
 * Pausing does **not** change the colour. Colour answers "which interval am I
 * in", and a paused set is still the set; whether the clock is moving is said in
 * words instead — the chip reads "Paused" and the button reads "Resume".
 */
function stageTone(step: SessionStep): StepTone {
  if (step.kind === 'work') {
    return { tint: colors.effort, surface: colors.effortBg, onTint: colors.onEffort };
  }
  // "Next up" — not recovery, not work. The get-ready light.
  if (step.kind === 'transition') {
    return { tint: colors.ready, surface: colors.readyBg, onTint: colors.onReady };
  }
  // Rest, and the ten seconds between sides, are the same thing to her.
  return { tint: colors.recover, surface: colors.recoverBg, onTint: colors.onRecover };
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
  // The clip box matches the clips' own 4:5 whenever the screen has the room,
  // so a large phone shows the movement edge to edge with no letterboxing at
  // all. Where it doesn't, the box stays shorter and the bars absorb it.
  const { width: screenWidth } = useWindowDimensions();
  const clipMaxHeight = Math.round((screenWidth - spacing.lg * 2) * CLIP_RATIO);

  const { step, current, remaining, duration, paused } = player;
  if (!current || step.kind === 'done') return null;

  const { exercise, dose } = current;
  const timed = duration !== null;
  const resting = step.kind === 'rest' || step.kind === 'switch';
  const working = step.kind === 'work';
  const { label, support } = stageCopy(step, current, working && paused);
  const tone = stageTone(step);

  // Which override belongs under her thumb changes with the step. Mid-set the
  // clock is already running the session, and the only thing she reaches for is
  // a way to stop it — the phone rings, the dog walks across the mat, her form
  // goes. Finishing *ahead* of the clock is the rarer move, so "Done" steps down
  // into the row below. On every other step the big button ends a wait, which is
  // exactly what she wants it to do.
  const pauseIsPrimary = working && timed;
  const primaryLabel = pauseIsPrimary
    ? paused
      ? 'Resume'
      : 'Pause'
    : resting
      ? 'I’m ready'
      : step.kind === 'transition'
        ? 'Start now'
        : 'Done';
  const primaryHint = pauseIsPrimary
    ? paused
      ? 'Resume the set'
      : 'Pause the set'
    : resting
      ? 'Move on now'
      : step.kind === 'transition'
        ? 'Start now'
        : 'Finished early, move on';

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

      {/* The demonstration, and now the stage itself — the countdown rides on
          top of it instead of in a row underneath, which is where the 132pt ring
          used to sit. It stays up through the rest as well as the work: the rest
          is the one moment she has both hands free to watch the next set being
          done properly. Until clips are uploaded this is a designed placeholder
          holding exactly the space they will take. */}
      <ExerciseVideo
        exercise={exercise}
        // The frame is the tell she can read without looking at the phone at
        // all — a red rectangle in her peripheral vision means keep going, a
        // green one means put it down. Its width never changes, only its
        // colour, so nothing reflows when the interval turns over.
        style={[styles.video, { maxHeight: clipMaxHeight, borderColor: tone.tint }]}
        overlay={
          <StepHud
            label={label}
            // Falls back to the written dose only if this step arrived without
            // anything runnable in it.
            readout={timed ? formatClock(remaining ?? 0) : exerciseDose(exercise)}
            progress={timed && duration ? 1 - (remaining ?? 0) / duration : 0}
            tone={tone}
          />
        }
      />

      <View style={styles.caption}>
        <Text style={styles.exerciseName} numberOfLines={2}>
          {exercise.name}
        </Text>
        {support && (
          <Text style={styles.support} numberOfLines={2}>
            {support}
          </Text>
        )}
      </View>

      <View style={styles.controls}>
        {/* Nothing here has to be tapped for the session to run. Every button
            in this block is an override.

            The primary wears the step's colour rather than the brand coral, so
            the thing under her thumb and the thing she is looking at are the
            same state — red button while the set runs, green while she rests.
            It is the only button on this screen that changes colour; the row
            below stays neutral so the two never compete. */}
        <AnimatedPressable
          containerStyle={styles.primaryWrap}
          // `shadows.buttonPrimary` drops a coral-tinted shadow, which under a
          // green button reads as a pink halo. The shadow follows the fill.
          style={[styles.primary, { backgroundColor: tone.tint, shadowColor: tone.tint }]}
          onPress={pauseIsPrimary ? player.togglePause : player.advance}
          accessibilityRole="button"
          accessibilityLabel={primaryHint}
        >
          {pauseIsPrimary && (
            <Ionicons name={paused ? 'play' : 'pause'} size={20} color={tone.onTint} />
          )}
          <Text style={[styles.primaryText, { color: tone.onTint }]}>{primaryLabel}</Text>
        </AnimatedPressable>

        {/* Time first, then skip, always in that order — the row under her thumb
            keeps its shape from one step to the next. There is no "skip the
            whole exercise" here: a set at a time is a decision she can make
            mid-movement, and four sets abandoned by one mistap is not. */}
        <View style={styles.secondaryRow}>
          {timed && step.kind !== 'transition' && (
            <SecondaryButton
              icon="add"
              label={`+${REST_BUMP_SECONDS} sec`}
              accessibilityLabel={`Add ${REST_BUMP_SECONDS} seconds`}
              onPress={player.addTime}
            />
          )}
          {pauseIsPrimary && (
            <SecondaryButton
              icon="play-skip-forward"
              // A per-side move runs the set twice, so this only ever gets her
              // as far as the other side. Saying "set" there would be a lie she
              // finds out about one tap later.
              label={dose.perSide ? 'Skip side' : 'Skip set'}
              accessibilityLabel={
                dose.perSide ? 'Skip this side' : 'Skip the rest of this set'
              }
              onPress={player.advance}
            />
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * The countdown, drawn over the clip rather than under it.
 *
 * This was a 132pt ring in a row of its own until the clip became the stage —
 * the ring and the picture were competing for the same vertical space and the
 * picture was losing. Three things let it survive the move onto footage:
 *
 * - The readout sits in a **solid** chip, not floating text, so contrast never
 *   depends on what she happened to film against. She is reading this from the
 *   floor, at arm's length, mid-set; it is the one thing here that cannot be
 *   allowed to get subtle.
 * - It sits top-right, where a standing figure is backdrop and a figure on a mat
 *   is nothing at all. Bottom-centre would cover the feet, and the feet are what
 *   a squat is judged on.
 * - The arc becomes a bar along the bottom edge. An arc needs to be read; a bar
 *   filling left to right is legible from across the room.
 *
 * It is out of the layout flow entirely, so unlike the row it replaces it cannot
 * reflow anything when the readout changes width — which also means the plain
 * dose fallback no longer needs a fixed slot to sit in.
 */
function StepHud({
  label,
  readout,
  progress,
  tone,
}: {
  label: string;
  readout: string | null;
  /** 0-1, clamped. 0 for a step with nothing to count down. */
  progress: number;
  /** Work / rest / get-ready, from `stageTone`. */
  tone: StepTone;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <View
      style={styles.hud}
      pointerEvents="none"
      accessibilityRole="progressbar"
      accessibilityLabel={readout ? `${label}, ${readout}` : label}
    >
      {/* The chip carries the state colour in its fill and its border, never in
          the number. The tints are opaque and pale on purpose: the readout stays
          near-black on a light ground, which is the most legible pairing there
          is, and it stops the countdown from getting quietly harder to read the
          moment the interval turns red. */}
      <View style={[styles.hudChip, { backgroundColor: tone.surface, borderColor: tone.tint }]}>
        <Text style={styles.hudLabel} numberOfLines={1}>
          {label}
        </Text>
        {readout && (
          <Text style={styles.hudReadout} numberOfLines={1} allowFontScaling={false}>
            {readout}
          </Text>
        )}
      </View>

      <View style={styles.hudTrack}>
        <View style={[styles.hudTrackFill, { width: `${pct}%`, backgroundColor: tone.tint }]} />
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
  setup: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  setupBar: {
    flexDirection: 'row',
  },
  /**
   * Centres when there is room, scrolls when there isn't. `flexGrow: 1` is what
   * makes both true at once — without it the content pins to the top and the
   * screen reads as half-empty on anything larger than an SE.
   */
  setupBody: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  setupTitle: {
    ...typography.presets.heading1,
    color: colors.text,
    textAlign: 'center',
  },
  setupCadence: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  /**
   * The length of the session, as the one thing she is really deciding about.
   *
   * A disc rather than a line of text because it is the shape of the clock she
   * is about to be handed — the runner's countdown is the same idea drawn small.
   * The soft coral is `rgba`, never an 8-digit hex: Android renders those grey.
   */
  dial: {
    width: 172,
    height: 172,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    backgroundColor: 'rgba(244, 124, 151, 0.10)',
    borderWidth: 2,
    borderColor: colors.primaryLight,
  },
  dialAbout: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },
  dialValue: {
    fontFamily: typography.display.bold,
    fontSize: 64,
    lineHeight: 70,
    color: colors.text,
  },
  dialUnit: {
    ...typography.presets.label,
    color: colors.primaryDark,
  },
  setupCount: {
    ...typography.presets.body,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  propsCard: {
    width: '100%',
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  setupFoot: {
    paddingTop: spacing.sm,
  },
  setupHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  setupHint: {
    ...typography.presets.caption,
    color: colors.textMuted,
    flexShrink: 1,
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
  /**
   * Brand coral, not `success`. This is how far through the session she is, and
   * green on this screen now means one thing only — she is resting. Two greens
   * meaning two different things, six inches apart, is how a glanceable screen
   * stops being glanceable.
   */
  trackFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  trackLabel: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },

  // Stage
  /**
   * The clip takes whatever height is left once the caption and the controls
   * have theirs — it is still the only elastic thing on the screen, so a small
   * phone loses picture rather than losing the number she is reading. Its
   * `maxHeight` is set per-render from the screen width so the box stops growing
   * at the clips' own 4:5 and never opens a letterbox bar it doesn't need.
   *
   * The border is always 2pt — only `borderColor` changes with the step — so
   * turning the interval over costs the clip no height and shifts nothing.
   */
  video: {
    width: '100%',
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 132,
    marginTop: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  /**
   * Fixed height, holding two lines of name and two of support whether or not
   * this step uses them. The clip absorbs every spare point on the screen, so a
   * caption that grew by a line would shrink the picture mid-session.
   */
  caption: {
    height: CAPTION_HEIGHT + spacing.sm * 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  exerciseName: {
    ...typography.presets.heading2,
    color: colors.text,
    textAlign: 'center',
  },
  support: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
  },

  // Countdown, overlaid on the clip
  hud: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  hudChip: {
    alignSelf: 'flex-end',
    margin: spacing.sm,
    minWidth: 96,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.md,
    // 2pt so the state colour registers as a colour and not as a hairline.
    // Both this and `backgroundColor` are overridden per step by `stageTone`;
    // the values here are the neutral fallback.
    borderWidth: 2,
    borderColor: colors.border,
    // Solid, never translucent. The clip behind it is a moving image and this is
    // the one element she has to be able to read without looking twice.
    backgroundColor: colors.card,
    ...shadows.card,
  },
  hudLabel: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },
  hudReadout: {
    fontFamily: typography.display.bold,
    fontSize: 34,
    lineHeight: 40,
    color: colors.text,
  },
  hudTrack: {
    height: 4,
    backgroundColor: 'rgba(29, 53, 87, 0.12)',
  },
  hudTrackFill: {
    height: '100%',
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
