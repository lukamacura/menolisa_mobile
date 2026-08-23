import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, StatusBar } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useKeepAwake } from 'expo-keep-awake';
import { colors, spacing, radii, typography, minTouchTarget, shadows, stageRgb } from '../../theme/tokens';
import type { TodayStackParamList } from '../../navigation/types';
import { usePlan, tasksForPillar } from '../../context/PlanContext';
import {
  buildSessionItems,
  exerciseDose,
  formatClock,
  indexInPhase,
  isPlanFinished,
  phaseCount,
  sessionProps,
  sessionSeconds,
  setInstruction,
  taskCadenceHint,
  taskRemainingLabel,
} from '../../lib/planFormat';
import { SESSION_PHASE_LABEL, type SessionPhase } from '../../lib/planTypes';
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
 * Reserved height for the two lines over the clip — name (up to 2) and support
 * (up to 2), at their preset line heights plus the gap between them.
 *
 * Fixed on purpose, still, but for a different reason than it once had. When
 * the clip was a box in a column this was what stopped the picture breathing
 * between sets. On a full-bleed stage the picture no longer cares — the caption
 * floats over it — and what the fixed height protects now is the primary
 * button: a support line that grows from one to two makes the thing under her
 * thumb jump 22pt at the exact moment she is reaching for it.
 */
const CAPTION_HEIGHT = 28 * 2 + spacing.xs + 22 * 2;

/**
 * The two gradients that make chrome legible on top of moving video.
 *
 * The runner is full-bleed, so every word on it sits over footage that changes
 * four times a second. A drop shadow under white text is the usual answer and
 * it fails here — it works on a dark frame and disappears on a bright one. A
 * scrim is unconditional: the top and bottom of the picture are darkened to the
 * stage colour, and text placed inside them has the same contrast in every
 * frame of every clip.
 *
 * The bottom one has a middle stop because it is tall. A straight two-stop fade
 * over 46% of the screen reads as a grey wash across the picture; landing most
 * of the opacity in the lower third keeps the fade invisible and the controls
 * solid.
 */
const SCRIM_TOP = [
  `rgba(${stageRgb}, 0.92)`,
  `rgba(${stageRgb}, 0.86)`,
  `rgba(${stageRgb}, 0)`,
] as const;
/** Hold full strength past the progress label, then fade over the last quarter. */
const SCRIM_TOP_STOPS = [0, 0.72, 1] as const;

const SCRIM_BOTTOM = [
  `rgba(${stageRgb}, 0)`,
  `rgba(${stageRgb}, 0.90)`,
  `rgba(${stageRgb}, 0.98)`,
] as const;
/**
 * Reach full strength before the panel starts, not halfway down it.
 *
 * A two-stop fade over half the display puts roughly 0.5 opacity where the
 * exercise name sits, and white on a half-scrimmed bright frame is about 3:1 —
 * legible on the clip you tested and not on the next one. Landing 0.9 by 28% of
 * the scrim means every word in the panel has the same contrast on every clip,
 * and the fade itself still happens over ~120pt of picture where nothing is.
 */
const SCRIM_BOTTOM_STOPS = [0, 0.28, 0.62] as const;

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
  // Warm-up, work and cool-down as one runnable list. Memoised because the
  // player re-arms its clock whenever this array's identity changes.
  const items = useMemo(() => buildSessionItems(task), [task]);

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

  const player = useSessionPlayer(items, { compact, onFinish: finish });

  // Only while she is actually working. Released the moment this unmounts, so a
  // session left open on the counter can't sit there draining her battery.
  useKeepAwake();

  const logAndLeave = useCallback(() => {
    logSession();
    navigation.goBack();
  }, [logSession, navigation]);

  const leave = useCallback(() => {
    // Past the last working set, only the cool-down is left. There is nothing
    // to weigh up here: the session happened, so leaving must not be able to
    // throw it away, and "just leave" is not offered.
    if (player.mainDone) {
      Alert.alert(
        'Finish here?',
        'The work is done — only the cool-down is left.',
        [
          { text: 'Keep going', style: 'cancel' },
          { text: 'Log it and finish', onPress: logAndLeave },
        ],
        { cancelable: true }
      );
      return;
    }

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
        { text: 'Log it as done', onPress: logAndLeave },
      ],
      { cancelable: true }
    );
  }, [navigation, player.mainDone, player.setsDone, player.setsTotal, logAndLeave]);

  // This screen runs without a nav header so the session can own the display, so
  // every branch has to carry its own way out — there is no back chevron and no
  // back-swipe to fall through to.
  if (!task || !items.length) {
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
        items={items}
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
    <SessionRunner player={player} title={task.title} items={items} onLeave={leave} />
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
 *
 * The one thing the phases add here is the shape line under the dial. She is
 * looking at "about 25 min" and deciding whether she has 25 minutes; being told
 * that four of them are a warm-up and three are stretching is what makes the
 * number recognisable rather than daunting.
 */
function SessionSetup({
  title,
  items,
  cadenceNote,
  onStart,
  onClose,
}: {
  title: string;
  items: SessionExercise[];
  /** How this session counts toward the week. Null when the task has no cadence to state. */
  cadenceNote: string | null;
  onStart: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const props = sessionProps(items);
  const minutes = Math.max(1, Math.round(sessionSeconds(items) / 60));
  const main = phaseCount(items, 'main');
  const warmup = phaseCount(items, 'warmup');
  const cooldown = phaseCount(items, 'cooldown');

  return (
    <View style={[styles.setup, { paddingTop: insets.top + spacing.xs }]}>
      {/* A faint wash instead of flat white — this is the last calm screen
          before the stage goes dark, and it can afford a little depth. */}
      <LinearGradient
        colors={[colors.surfaceElevated, colors.background]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

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
        <View style={styles.titleIconWrap}>
          <Ionicons name="barbell" size={22} color={colors.primaryDark} />
        </View>

        <Text style={styles.setupTitle}>{title}</Text>
        {cadenceNote && <Text style={styles.setupCadence}>{cadenceNote}</Text>}

        <LinearGradient
          colors={[colors.primaryLight, colors.primary]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.dialRing}
        >
          <View
            style={styles.dial}
            accessibilityRole="text"
            accessibilityLabel={`About ${minutes} minutes`}
          >
            <Text style={styles.dialAbout}>about</Text>
            <Text style={styles.dialValue} allowFontScaling={false}>
              {minutes}
            </Text>
            <Text style={styles.dialUnit}>min</Text>
          </View>
        </LinearGradient>

        <Text style={styles.setupCount}>
          {main} {main === 1 ? 'exercise' : 'exercises'}, guided end to end
        </Text>

        {/* Only drawn when there is something to say. A session with no
            bookends must look exactly as it did before they existed. */}
        {(warmup > 0 || cooldown > 0) && (
          <View style={styles.phaseStrip}>
            {warmup > 0 && <PhasePill phase="warmup" count={warmup} />}
            {cooldown > 0 && <PhasePill phase="cooldown" count={cooldown} />}
          </View>
        )}

        {props.length > 0 && (
          <View style={styles.propsCard}>
            <View style={styles.propsHead}>
              <Ionicons name="bag-handle-outline" size={14} color={colors.textMuted} />
              <Text style={styles.propsLabel}>You'll need</Text>
            </View>
            <View style={styles.propsChips}>
              {props.map((item) => (
                <View key={item} style={styles.propChip}>
                  <Text style={styles.propChipText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.setupFoot, { paddingBottom: insets.bottom + spacing.md }]}>
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

/** "Warm-up · 3" — that the session has a bookend, and how long a one. */
function PhasePill({ phase, count }: { phase: SessionPhase; count: number }) {
  const tone = phaseTone(phase);
  const icon: keyof typeof Ionicons.glyphMap = phase === 'warmup' ? 'sunny-outline' : 'moon-outline';
  return (
    <View style={[styles.phasePill, { backgroundColor: tone.surface, borderColor: tone.tint }]}>
      <Ionicons name={icon} size={13} color={tone.tint} />
      <Text style={styles.phasePillText}>
        {SESSION_PHASE_LABEL[phase]} · {count}
      </Text>
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
  const { exercise, dose, phase } = current;
  // The catalog writes "None" for bodyweight work. It is not a thing to fetch.
  const props = exercise.props && exercise.props.toLowerCase() !== 'none' ? exercise.props : null;

  if (step.kind === 'transition') {
    // The bookends announce themselves. "Next up" before the first hip circle
    // tells her nothing she can act on; "Warm-up" tells her what the next four
    // minutes are for, which is the whole reason they are worth doing.
    const label = phase === 'main' ? 'Next up' : SESSION_PHASE_LABEL[phase];
    return {
      label,
      support: [exerciseDose(exercise), props].filter(Boolean).join(' · ') || null,
    };
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
  // A warm-up move is not a set she is counting through — it is a thing to do
  // until the clock stops. Naming the phase keeps her oriented without asking
  // her to track a number that means nothing here.
  const label = paused
    ? 'Paused'
    : phase !== 'main'
      ? dose.sets > 1
        ? `${SESSION_PHASE_LABEL[phase]} · ${step.set} of ${dose.sets}`
        : SESSION_PHASE_LABEL[phase]
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
 *   session-progress track at the top gave green up (see `trackFill`) and why
 *   the cool-down no longer wears it (see `phaseTone`).
 *
 * Pausing does **not** change the colour. Colour answers "which interval am I
 * in", and a paused set is still the set; whether the clock is moving is said in
 * words instead — the chip reads "Paused" and the button reads "Resume".
 */
function stageTone(step: SessionStep, phase: SessionPhase): StepTone {
  // Outside the working part the traffic light goes off — see `phaseTone`.
  if (phase !== 'main') return phaseTone(phase);

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
 * One steady colour for a whole warm-up, and another for a whole cool-down.
 *
 * The traffic light above answers "am I working or recovering right now",
 * because in the working part that question turns over every forty seconds and
 * she has to be able to read the answer from the floor without focusing. In the
 * bookends there is no such question: a warm-up is four minutes of continuous
 * easy movement with nothing to recover from, and flashing red at her over a
 * hip circle would teach her to stop believing the red.
 *
 * So the phase holds one colour end to end. It holds its **own** colour, not a
 * borrowed interval one — the bookends used to run amber and green, and both
 * were wrong in a way that cost the screen more than it looked:
 *
 * - Amber is `warning` to the hex. The gentlest part of the session opened in
 *   the app's caution colour.
 * - Green already means "rest" thirty seconds later and "done" on the screen
 *   she came from. A cool-down is neither — it is active stretching.
 *
 * Dawn through the warm-up and dusk through the cool-down instead: a warm clay
 * for waking up, a calm indigo for coming down. Which leaves the traffic light
 * with exactly three colours that appear nowhere else, so the moment the screen
 * first turns red is still the moment the actual work starts.
 */
function phaseTone(phase: SessionPhase): StepTone {
  if (phase === 'cooldown') {
    return { tint: colors.cooldown, surface: colors.cooldownBg, onTint: colors.onCooldown };
  }
  return { tint: colors.warmup, surface: colors.warmupBg, onTint: colors.onWarmup };
}

/**
 * The running session — work, rest and the card between exercises.
 *
 * A full-bleed stage: the clip is the screen, and everything else floats on top
 * of it. It used to be a bordered box in a column with a caption under it and
 * buttons under that, and the column was the problem — every fixed thing in it
 * was subtracted from the picture, so the one element the screen exists to show
 * was the only one paying for the others. About a third of the display went to
 * chrome, and roughly half of that was empty space reserved so the caption
 * could not resize the video between sets.
 *
 * Now nothing is subtracted. The clip fills the display; the chrome sits over
 * it in two bands, top and bottom, each darkened by a scrim so white text has
 * the same contrast over every frame of every clip. Which also means the fixed
 * caption height costs nothing at all any more — it still holds its two lines
 * so the button under her thumb never moves, but it holds them over the
 * picture instead of instead of it.
 *
 * The same four zones, in the same order, all still there: how far in she is,
 * what the movement looks like, the one number that matters right now, and what
 * to tap. Which step she is on changes what fills them, never how many there are.
 *
 * The state colour got louder in the move. It used to be a 2pt border around
 * the clip; it is now a band around the whole display, which is the thing she
 * can actually read from a mat with her head down — a red edge in her
 * peripheral vision means keep going, a green one means put it down.
 */
function SessionRunner({
  player,
  title,
  items,
  onLeave,
}: {
  player: SessionPlayer;
  title: string;
  items: SessionExercise[];
  onLeave: () => void;
}) {
  const insets = useSafeAreaInsets();

  const { step, current, remaining, duration, paused, phase } = player;
  if (!current || step.kind === 'done') return null;

  const { exercise, dose } = current;
  const timed = duration !== null;
  const resting = step.kind === 'rest' || step.kind === 'switch';
  const working = step.kind === 'work';
  const { label, support } = stageCopy(step, current, working && paused);
  const tone = stageTone(step, phase);

  // "3 of 5" counted inside the phase she is in, not across the whole session.
  // A warm-up move announcing itself as exercise 2 of 11 makes the session look
  // twice as long as the work in it actually is.
  const inPhase = indexInPhase(items, step.index);
  const phaseTotal = phaseCount(items, phase);
  // The bookends are named; the main work still wears the task's own title,
  // which is what she chose to open.
  const trackTitle = phase === 'main' ? title : SESSION_PHASE_LABEL[phase];

  // Which override belongs under her thumb changes with the step. Mid-set the
  // clock is already running the session, and the only thing she reaches for is
  // a way to stop it — the phone rings, the dog walks across the mat, her form
  // goes. Finishing *ahead* of the clock is the rarer move, so "Done" steps down
  // into the row below. On every other step the big button ends a wait, which is
  // exactly what she wants it to do.
  // Pausing a warm-up move is not a thing anyone reaches for; moving on is.
  // The big button follows what she would actually tap, which in the bookends
  // is always "I'm done with this one".
  const pauseIsPrimary = working && timed && phase === 'main';
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

  const intervalPct = timed && duration ? Math.round((1 - (remaining ?? 0) / duration) * 100) : 0;

  return (
    // Deliberately not PlanScreenLayout. That shell is a ScrollView with
    // pull-to-refresh, and a session is a fixed, full-height screen she is
    // looking at from the floor — nothing here should scroll or reload under her.
    <View style={styles.runner}>
      {/* The stage runs under the clock and the home indicator, so the status
          bar has to be told it is sitting on ink now. RN restores the previous
          entry when this unmounts, which is what takes the celebration screen
          back to dark text on its own. */}
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* The demonstration, edge to edge, underneath everything else. `cover`
          rather than `contain`: on a stage a letterbox bar is a black band
          across her phone, not a neutral margin. The clips are shot 9:16 with
          the movement framed inside the central 76% of width precisely so this
          crop costs nothing — see `ExerciseVideo`. Until they are uploaded this
          is a designed placeholder holding the whole screen, as it will. */}
      <ExerciseVideo
        exercise={exercise}
        style={StyleSheet.absoluteFill}
        rounded={false}
        ground="dark"
        contentFit="cover"
      />

      <LinearGradient
        colors={SCRIM_TOP}
        locations={SCRIM_TOP_STOPS}
        style={[styles.scrimTop, { height: insets.top + 110 }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={SCRIM_BOTTOM}
        locations={SCRIM_BOTTOM_STOPS}
        style={styles.scrimBottom}
        pointerEvents="none"
      />

      <View
        style={[
          styles.chrome,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md },
        ]}
      >
        <View style={styles.runnerTop}>
          <AnimatedPressable
            containerStyle={styles.leaveWrap}
            style={[styles.leave, styles.leaveDark]}
            onPress={onLeave}
            accessibilityRole="button"
            accessibilityLabel="End session"
          >
            <Ionicons name="close" size={20} color={colors.onStage} />
          </AnimatedPressable>
          <View style={styles.trackWrap}>
            <View style={styles.track}>
              <View
                style={[styles.trackFill, { width: `${Math.round(player.progress * 100)}%` }]}
              />
            </View>
            <Text style={styles.trackLabel} numberOfLines={1}>
              {trackTitle} · {inPhase} of {phaseTotal}
            </Text>
          </View>
        </View>

        {/* The countdown rides in the top band, opposite the way out. It sits
            high on purpose: a standing figure is backdrop up here and a figure
            on a mat is nothing at all, where bottom-centre would cover the feet
            and the feet are what a squat is judged on. */}
        <View style={styles.hudRow} pointerEvents="none">
          <StepHud
            label={label}
            // Falls back to the written dose only if this step arrived without
            // anything runnable in it.
            readout={timed ? formatClock(remaining ?? 0) : exerciseDose(exercise)}
            tone={tone}
          />
        </View>

        <View style={styles.bottom}>
          {/* The interval's own bar, edge to edge, as the lid of the control
              panel. An arc has to be read; a bar draining left to right is
              legible from across the room. It is unmistakably not the pill at
              the top of the screen — that one is coral and counts the session,
              this one wears the state and counts the next forty seconds. */}
          <View style={styles.intervalTrack}>
            <View
              style={[
                styles.intervalFill,
                { width: `${intervalPct}%`, backgroundColor: tone.tint },
              ]}
            />
          </View>

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
              {/* In the bookends the big button is already "Done", so pause is what
                  is left over — she has answered the door mid-stretch. */}
              {working && timed && phase !== 'main' && (
                <SecondaryButton
                  icon={paused ? 'play' : 'pause'}
                  label={paused ? 'Resume' : 'Pause'}
                  accessibilityLabel={paused ? 'Resume' : 'Pause'}
                  onPress={player.togglePause}
                />
              )}
            </View>
          </View>
        </View>
      </View>

      {/* The state, as a band around the display. Drawn last so the edge-to-edge
          interval bar cannot clip its sides. Its width never changes, only its
          colour, and it is out of the layout entirely — turning the interval
          over cannot move a single pixel of anything else. */}
      <View style={[styles.frame, { borderColor: tone.tint }]} pointerEvents="none" />
    </View>
  );
}

/**
 * The countdown, in a solid chip over the picture.
 *
 * This was a 132pt ring in a row of its own until the clip became the stage.
 * Two things let it survive the move onto footage:
 *
 * - The readout sits in a **solid** chip, not floating text, so contrast never
 *   depends on what she happened to film against. She is reading this from the
 *   floor, at arm's length, mid-set; it is the one thing here that cannot be
 *   allowed to get subtle. The chip is pale even while the interval is red,
 *   because near-black on a light ground is the most legible pairing there is
 *   and the state is already being said by the frame, the bar and the button.
 * - The progress arc left with the ring. It is a bar now, at the top of the
 *   control panel, where it can run the full width of the display.
 *
 * It is out of the layout flow entirely, so it cannot reflow anything when the
 * readout changes width — which is also why the plain dose fallback no longer
 * needs a fixed slot to sit in.
 */
function StepHud({
  label,
  readout,
  tone,
}: {
  label: string;
  readout: string | null;
  /** Work / rest / get-ready / warm-up / cool-down, from `stageTone`. */
  tone: StepTone;
}) {
  return (
    <View
      style={[styles.hudChip, { backgroundColor: tone.surface, borderColor: tone.tint }]}
      accessibilityRole="text"
      accessibilityLabel={readout ? `${label}, ${readout}` : label}
    >
      <Text style={styles.hudLabel} numberOfLines={1}>
        {label}
      </Text>
      {readout && (
        <Text style={styles.hudReadout} numberOfLines={1} allowFontScaling={false}>
          {readout}
        </Text>
      )}
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
  /** The badge above the title — a quiet anchor before the numbers start. */
  titleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    backgroundColor: 'rgba(244, 124, 151, 0.12)',
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  /**
   * The gradient ring around the dial — a soft coral halo standing in for the
   * flat border it replaced, plus a glow so the disc lifts off the page.
   */
  dialRing: {
    width: 180,
    height: 180,
    borderRadius: radii.pill,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    ...shadows.glowPrimary,
  },
  /**
   * The length of the session, as the one thing she is really deciding about.
   *
   * A disc rather than a line of text because it is the shape of the clock she
   * is about to be handed — the runner's countdown is the same idea drawn small.
   */
  dial: {
    width: '100%',
    height: '100%',
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
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
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  setupFoot: {
    paddingTop: spacing.sm,
  },
  phaseStrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  phasePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  phasePillText: {
    ...typography.presets.caption,
    fontFamily: typography.family.semibold,
    color: colors.text,
  },
  propsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  propsLabel: {
    ...typography.presets.label,
    color: colors.textMuted,
  },
  propsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  propChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  propChipText: {
    ...typography.presets.caption,
    fontFamily: typography.family.medium,
    color: colors.text,
  },
  // Runner chrome — the full-bleed stage. Everything from here down sits on
  // ink, so it takes `onStage` / `stageChip` rather than the light palette the
  // setup and celebration screens above still use.
  runner: {
    flex: 1,
    backgroundColor: colors.stage,
  },
  scrimTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  /**
   * Tall enough to cover the interval bar, the caption and both rows of
   * buttons, with the fade itself finishing well above them. A percentage
   * rather than a fixed height so it scales with the display instead of
   * stopping halfway up an iPad.
   */
  scrimBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '52%',
  },
  /**
   * The state band. 4pt so the colour registers as a colour and not a hairline
   * — `cooldown` against the stage ground is the tightest pair on the screen at
   * 2.7:1, which is fine for a band and would not be for a line. It is a
   * redundant cue by design: the chip and the primary button say the same thing
   * for anyone who cannot use colour at all.
   */
  frame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 4,
  },
  /**
   * No horizontal padding of its own — the rows inside carry theirs, so the
   * interval bar can run edge to edge while the text stays inset.
   */
  chrome: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
  },
  runnerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
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
  leaveDark: {
    backgroundColor: colors.stageChip,
  },
  trackWrap: {
    flex: 1,
    gap: 4,
  },
  track: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.stageChip,
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
    color: colors.onStageMuted,
  },

  // Countdown, over the clip
  /**
   * `flex: 1` so the chip pins to the top of the space between the two bands
   * and the bottom block is pushed to the floor of the screen. The clip needs
   * no height allocation at all now — it is behind all of this.
   */
  hudRow: {
    flex: 1,
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  hudChip: {
    minWidth: 104,
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

  // The control panel, in the bottom band
  bottom: {
    gap: spacing.sm,
  },
  /**
   * Opaque, like every other fill on this screen. Android composites
   * translucent rgba View backgrounds as flat grey, and an unlit track is the
   * half of this bar that has to stay believable.
   */
  intervalTrack: {
    height: 5,
    backgroundColor: colors.stageChip,
    overflow: 'hidden',
  },
  intervalFill: {
    height: '100%',
  },
  /**
   * Fixed height, holding two lines of name and two of support whether or not
   * this step uses them, so the button under her thumb never moves between
   * steps. It used to cost the picture the same 132pt on every screen; over a
   * full-bleed stage it costs nothing, which is the main thing the stage bought.
   */
  caption: {
    height: CAPTION_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  exerciseName: {
    ...typography.presets.heading2,
    color: colors.onStage,
    textAlign: 'center',
  },
  support: {
    ...typography.presets.bodySmall,
    color: colors.onStageMuted,
    textAlign: 'center',
    maxWidth: 300,
  },

  // Controls
  controls: {
    gap: spacing.sm,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
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
  /**
   * Opaque, not a white wash. Android composites translucent rgba View
   * backgrounds as flat grey, and these two buttons sit on the one screen in
   * the app that is nothing but views floating over video.
   */
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.stageChip,
    borderWidth: 1,
    borderColor: colors.stageBorder,
  },
  secondaryText: {
    ...typography.presets.buttonSmall,
    color: colors.onStage,
  },
});

export default MovementSessionScreen;
