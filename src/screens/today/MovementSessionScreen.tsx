import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  formatDuration,
  indexInPhase,
  isPlanFinished,
  phaseCount,
  sessionProps,
  sessionSeconds,
  setInstruction,
  taskCadenceHint,
  taskRemainingLabel,
} from '../../lib/planFormat';
import {
  SESSION_PHASE_LABEL,
  isWorkPhase,
  powerThisSession,
  type SessionPhase,
} from '../../lib/planTypes';
import { cardioExercise } from '../../lib/cardio';
import { useClipPrewarm } from '../../lib/clipCache';
import { prepareSessionSounds } from '../../lib/sessionSound';
import { CardioSession } from '../../components/plan/CardioSession';
import { ExerciseVideo } from '../../components/plan/ExerciseVideo';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { GratitudeSuccessPanel } from '../../components/GratitudeSuccessPanel';
import { useReduceMotion } from '../../components/StaggeredZoomIn';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import {
  useSessionPlayer,
  REST_BUMP_SECONDS,
  type SessionExercise,
  type SessionPlayer,
  type SessionStep,
} from '../../hooks/useSessionPlayer';

/**
 * Reserved height for the two lines over the clip — name (up to 2) and support
 * (1), at their preset line heights plus the gap between them.
 *
 * A floor, not a fixed height, and it reserves three lines rather than four.
 * What it protects is the primary button: a support line that grows from one to
 * two makes the thing under her thumb jump 22pt at the exact moment she is
 * reaching for it. But the only step whose support ever runs to two lines is the
 * transition card — the one place the dose and the props are printed together —
 * and there no clock is running, no set is in progress, and nothing is under her
 * thumb yet. Reserving that second line on every other step cost the picture
 * 22pt permanently to protect a jump that cannot happen while she is moving.
 */
const CAPTION_HEIGHT = 28 * 2 + spacing.xs + 22;

/**
 * What the exercise's own reason adds to the caption, on the one step that
 * shows it.
 *
 * Three lines of `bodySmall` plus the gap above them. It is only ever drawn on
 * the transition card — the card that exists to introduce the next movement —
 * so this height is added to the bottom scrim for that step alone rather than
 * reserved on every step, which would darken 74pt more of the picture for the
 * whole session to serve twelve seconds of it.
 */
const WHY_HEIGHT = 22 * 3 + spacing.xs;

/**
 * How much of the display the bottom band actually occupies, so the scrim under
 * it can be sized from the chrome instead of from a percentage that was right
 * on one phone. Every term is the style below it reads from.
 */
const INTERVAL_BAR_HEIGHT = 5;
const CONTROLS_HEIGHT = minTouchTarget + 12 + spacing.sm + minTouchTarget;
const BOTTOM_CHROME_HEIGHT =
  INTERVAL_BAR_HEIGHT + spacing.sm + CAPTION_HEIGHT + spacing.sm + CONTROLS_HEIGHT;

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

/**
 * The bottom scrim is only as tall as it has to be to sit fully opaque behind
 * every pixel of chrome — everything above that is picture being darkened for
 * nothing. It was `52%` of the display, which on a tall phone reached about
 * 130pt higher than the controls it exists to make legible.
 *
 * The gradient is transparent at its own top and hits 0.90 at
 * `SCRIM_BOTTOM_STOPS[1]`, so the solid part is the lower `1 - stop` of it:
 * divide the chrome by that and the fade lands exactly where the chrome ends.
 *
 * `extra` is chrome this step has that the others do not — today only the
 * exercise's reason on the transition card. Text the scrim does not reach is
 * white on whatever the clip is doing behind it, which is the one failure this
 * whole gradient exists to prevent.
 */
function scrimBottomHeight(bottomInset: number, extra = 0) {
  return Math.round(
    (bottomInset + spacing.md + BOTTOM_CHROME_HEIGHT + extra) / (1 - SCRIM_BOTTOM_STOPS[1]),
  );
}

/**
 * How much of a cardio block has to be behind her before leaving offers to log
 * it. Half, the same fraction the strength session counts sets against — the
 * measure differs because a walk has one set, not the standard.
 */
const CARDIO_LOG_FRACTION = 0.5;

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

  /**
   * Whether this run carries the power block, decided once and then held.
   *
   * The gate is `doneThisWeek < powerSessions`, and logging the session moves
   * `doneThisWeek` — so on her second of two power sessions, the moment she
   * finishes the block the gate that put it there goes false. Re-deriving it
   * per render would pull exercises out of the list underneath a player that is
   * standing on them, and the index it is holding would land on a different
   * movement or past the end.
   *
   * Latched on the task key rather than on the task: the plan object is
   * replaced on every optimistic tick and every background reconcile, and this
   * must survive all of them. It re-reads only when she opens a different day's
   * session, which is the one time the answer is allowed to change.
   */
  const withPower = useRef<{ key: string; value: boolean } | null>(null);
  if (task && withPower.current?.key !== task.key) {
    withPower.current = { key: task.key, value: powerThisSession(task) };
  }
  const includePower = withPower.current?.value ?? false;

  // Warm-up, work, power and cool-down as one runnable list. Memoised because
  // the player re-arms its clock whenever this array's identity changes.
  const items = useMemo(() => buildSessionItems(task, includePower), [task, includePower]);

  const [started, setStarted] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  /**
   * The single `K` row a cardio task holds, or null for a workout.
   *
   * A walk is not run on the video stage — see `CardioSession` for why — but it
   * is run on the same player, logged down the same path and counted by the
   * same weekly `target`. Everything below that branches on this branches on
   * presentation only.
   */
  const cardio = cardioExercise(task);

  // Snacks are four ~5-minute bursts a day. They get the same player with the
  // ceremony stripped out — no long rests, no waiting on a "next up" card.
  const compact = task?.cadence === 'per_day';

  const logSession = useCallback(() => {
    if (!task) return;
    // `count` replaces the day's total, so a second session today sends 2.
    tick(task.key, (current) => current + 1).catch(() => {});
  }, [task, tick]);

  const finish = useCallback(() => {
    logSession();
    setCelebrating(true);
  }, [logSession]);

  const player = useSessionPlayer(items, {
    compact,
    // The clock may not run behind the setup card. It used to: the player armed
    // on mount, so the first transition drained while she was still reading how
    // long the session was, and she landed on the stage already mid-set. On a
    // twenty-five minute cardio block, left open, it ran the whole session out
    // and logged one she never did.
    armed: started,
    // One continuous block has nothing to introduce, and twelve seconds of
    // standing still is the wrong way to open twenty-five minutes of walking.
    skipIntro: Boolean(cardio),
    onFinish: finish,
  });

  // Decode the countdown cues while she is still reading the intro card. Doing
  // it on first play would cost the first tick a few hundred milliseconds, and
  // a tick that lands late is a tick on the wrong second.
  useEffect(() => {
    prepareSessionSounds();
  }, []);

  /**
   * Pull the clips she is about to need down onto the device before she needs
   * them — the setup card's first two while she reads it, and from then on the
   * two exercises ahead of the one she is working.
   *
   * A clip that only starts downloading when its exercise starts is a clip she
   * watches load, and the moment it lands on is the exact moment she is looking
   * up from the mat for the next movement. Two ahead is a whole exercise of
   * lead time — a set, its rest and the card between — over a file the size of
   * a photo. See `lib/clipCache.ts` for what happens to the bytes.
   */
  const stepIndex = 'index' in player.step ? player.step.index : items.length;
  const upcoming = useMemo(() => {
    const from = started ? stepIndex + 1 : 0;
    return [items[from]?.exercise.video, items[from + 1]?.exercise.video];
  }, [items, started, stepIndex]);
  useClipPrewarm(upcoming);

  // Only while she is actually working. Released the moment this unmounts, so a
  // session left open on the counter can't sit there draining her battery.
  useKeepAwake();

  const logAndLeave = useCallback(() => {
    logSession();
    navigation.goBack();
  }, [logSession, navigation]);

  const leave = useCallback(() => {
    /*
     * A cardio block is one set, so "how many sets has she finished" is a
     * question with only two answers and neither is useful until the very end.
     * Twenty-four minutes of a twenty-five minute walk counted as nothing, and
     * closing the screen threw it away without so much as asking. Time on the
     * clock is the honest measure of a session that *is* a clock.
     */
    if (cardio) {
      const total = player.duration ?? 0;
      const elapsed = started && total > 0 ? total - (player.remaining ?? total) : 0;
      if (elapsed < total * CARDIO_LOG_FRACTION) {
        navigation.goBack();
        return;
      }
      Alert.alert(
        'End this session?',
        `You've been going ${formatDuration(elapsed)}. Want it logged?`,
        [
          { text: 'Keep going', style: 'cancel' },
          { text: 'Just leave', style: 'destructive', onPress: () => navigation.goBack() },
          { text: 'Log it as done', onPress: logAndLeave },
        ],
        { cancelable: true }
      );
      return;
    }

    // Past the last working set, only the tail of the session is left. There is
    // nothing to weigh up here: the session happened, so leaving must not be
    // able to throw it away, and "just leave" is not offered.
    if (player.mainDone) {
      Alert.alert(
        'Finish here?',
        // Said accurately, because the two are not the same offer. Walking out
        // of a cool-down costs her a stretch; walking out of the power block
        // costs her the bone loading, which is the one thing in the session
        // nothing else in the plan does. She is still allowed to — it is her
        // morning — but she should not be told the work is done when the hops
        // are still ahead of her.
        player.phase === 'power'
          ? 'The main work is done — the jumping is still to come.'
          : 'The work is done — only the cool-down is left.',
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
  }, [
    navigation,
    cardio,
    started,
    player.duration,
    player.remaining,
    player.mainDone,
    player.phase,
    player.setsDone,
    player.setsTotal,
    logAndLeave,
  ]);

  /**
   * Android's back button, which this screen's contract forgot about.
   *
   * `gestureEnabled: false` stops the swipe and the header is hidden, but the
   * hardware button pops the screen by itself — so on Android, backing out of a
   * session she was most of the way through discarded it without ever offering
   * to log it, which is the exact loss `leave` exists to prevent. Routed
   * through the same handler as the close button so both exits ask the same
   * question. The two branches below have nothing to weigh up and just leave.
   */
  const onAndroidBack = useCallback(() => {
    if (celebrating || !task || !items.length) navigation.goBack();
    else leave();
  }, [celebrating, task, items.length, navigation, leave]);
  useAndroidBack(onAndroidBack);

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
          // A walk builds neither muscle nor bone, and telling her it did is
          // the sort of small lie that costs an app its credibility on the one
          // pillar she can least see working. What cardio earns is the heart.
          encouragement={
            cardio
              ? "That's your heart stronger than it was half an hour ago."
              : "That's muscle and bone that wasn't there this morning."
          }
          metaChips={[{ icon: cardio ? 'walk' : 'barbell', label: task.title }]}
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

  // What this one session is worth against the week's ask. She is one tap from
  // starting; this is the last place the number can still mean something.
  const finished = plan ? isPlanFinished(plan) : false;
  const cadence = taskCadenceHint(task);
  const cadenceNote = cadence
    ? `${taskRemainingLabel(task, finished)} · your plan asks for ${cadence.toLowerCase()}`
    : null;

  /*
   * A walk gets one screen, not two. The setup card exists to answer "how long
   * is this and what do I have to fetch" before a session she cannot easily
   * pause — and for cardio both answers fit above the timer, so putting a
   * doorway in front of it would be a tap she pays for nothing.
   */
  if (cardio) {
    return (
      <CardioSession
        title={task.title}
        exercise={cardio}
        player={player}
        started={started}
        cadenceNote={cadenceNote}
        onStart={() => setStarted(true)}
        onLeave={leave}
      />
    );
  }

  if (!started) {
    return (
      <SessionSetup
        title={task.title}
        items={items}
        cadenceNote={cadenceNote}
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
  const power = phaseCount(items, 'power');
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
            bookends and no power block must look exactly as it did before any
            of them existed. In run order, so the strip reads as the shape of
            the session rather than as three unrelated facts about it. */}
        {(warmup > 0 || power > 0 || cooldown > 0) && (
          <View style={styles.phaseStrip}>
            {warmup > 0 && <PhasePill phase="warmup" count={warmup} />}
            {power > 0 && <PhasePill phase="power" count={power} />}
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

/** Dawn, impact, dusk — the three phases that bracket and follow the work. */
const PHASE_ICON: Partial<Record<SessionPhase, keyof typeof Ionicons.glyphMap>> = {
  warmup: 'sunny-outline',
  power: 'flash-outline',
  cooldown: 'moon-outline',
};

/** "Warm-up · 3" — that the session has a phase beyond the work, and how long a one. */
function PhasePill({ phase, count }: { phase: SessionPhase; count: number }) {
  const tone = phaseTone(phase);
  const icon = PHASE_ICON[phase] ?? 'ellipse-outline';
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
  /**
   * The catalog's reason for this movement, on the transition card only.
   *
   * The card between exercises is the one moment she is standing still, being
   * told what is coming, with nothing on a clock she is counted against — which
   * is exactly where "why am I doing this one" can be answered. On a working
   * set it would be two sentences of prose over a set she is halfway through,
   * competing with the countdown for the only attention she has.
   *
   * Null everywhere else, and null on the transition card too when the server
   * sent no reason for this exercise.
   */
  why: string | null;
} {
  const { exercise, dose, phase } = current;
  // The catalog writes "None" for bodyweight work. It is not a thing to fetch.
  const props = exercise.props && exercise.props.toLowerCase() !== 'none' ? exercise.props : null;

  if (step.kind === 'transition') {
    // Every phase but the main work announces itself. "Next up" before the first
    // hip circle tells her nothing she can act on; "Warm-up" tells her what the
    // next four minutes are for, which is the whole reason they are worth doing.
    // "Jumping" does the same job at the moment the session turns into hopping —
    // she is entitled to know that is about to happen before she is mid-air.
    const label = phase === 'main' ? 'Next up' : SESSION_PHASE_LABEL[phase];
    return {
      label,
      support: [exerciseDose(exercise), props].filter(Boolean).join(' · ') || null,
      why: exercise.why ?? null,
    };
  }
  if (step.kind === 'switch') {
    return { label: 'Switch sides', support: 'Same move, other side.', why: null };
  }
  if (step.kind === 'rest') {
    return { label: 'Rest', support: `Then: set ${step.set + 1} of ${dose.sets}`, why: null };
  }
  // Unreachable — the runner returns before it renders a finished session.
  if (step.kind === 'done') {
    return { label: '', support: null, why: null };
  }

  // A stopped clock has to say so. The stage goes neutral while she is paused
  // (see `stageTone`), and a grey chip still reading "Set 2 of 3" looks like a
  // set that is running — the word is what tells her the seconds aren't moving.
  // A warm-up move is not a set she is counting through — it is a thing to do
  // until the clock stops. Naming the phase keeps her oriented without asking
  // her to track a number that means nothing here.
  const label = paused
    ? 'Paused'
    : !isWorkPhase(phase)
      ? dose.sets > 1
        ? `${SESSION_PHASE_LABEL[phase]} · ${step.set} of ${dose.sets}`
        : SESSION_PHASE_LABEL[phase]
      : dose.sets > 1
        ? `Set ${step.set} of ${dose.sets}`
        : 'Your turn';
  if (dose.perSide) {
    return { label, support: step.side === 0 ? 'Left side' : 'Right side', why: null };
  }
  return { label, support: props ?? setInstruction(dose), why: null };
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
  // Outside the working part the traffic light goes off — see `phaseTone`. The
  // power block is inside it: hops are worked and rested exactly like a squat,
  // and that is the one stretch of the session where "am I meant to be moving
  // right now" has to be readable from the floor at a glance.
  if (!isWorkPhase(phase)) return phaseTone(phase);

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
  // Only reached from the setup pill, never from the running stage — inside the
  // power block `stageTone` keeps the traffic light on. It is here so the pill
  // that announces the block on the way in is not wearing the warm-up's clay.
  if (phase === 'power') {
    return { tint: colors.power, surface: colors.powerBg, onTint: colors.onPower };
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
  const { label, support, why } = stageCopy(step, current, working && paused);
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
  // is always "I'm done with this one". In the power block it is pause again:
  // a set of hops is the one thing in the session she is most likely to need to
  // stop partway through.
  const pauseIsPrimary = working && timed && isWorkPhase(phase);
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
          crop costs nothing — see `ExerciseVideo`. An exercise with no clip —
          a cardio dose, which will never have one — leaves this as the stage
          ground, and the chrome below already names the movement. */}
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
        style={[styles.scrimBottom, { height: scrimBottomHeight(insets.bottom, why ? WHY_HEIGHT : 0) }]}
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
            {/* Why this movement, before the set rather than after it — she is
                reading it in the seconds she has to get into position, which is
                the only reason it changes what she does next. Three lines: the
                catalog writes two sentences and a cut-off one is not a reason. */}
            {why && (
              <Text style={styles.why} numberOfLines={3}>
                {why}
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
              containerStyle={[styles.primaryWrap, styles.primaryWrapStage]}
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
              {working && timed && !isWorkPhase(phase) && (
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
  /** Height comes from `scrimBottomHeight` — it is measured, not guessed. */
  scrimBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
    height: INTERVAL_BAR_HEIGHT,
    backgroundColor: colors.stageChip,
    overflow: 'hidden',
  },
  intervalFill: {
    height: '100%',
  },
  /**
   * A floor of two name lines and one support line, held whether or not this
   * step uses them, so the button under her thumb never moves between work,
   * rest and the set after it. The transition card is the one step allowed to
   * push past it — see `CAPTION_HEIGHT`.
   */
  caption: {
    minHeight: CAPTION_HEIGHT,
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
  /**
   * The same ink as the support line, and deliberately no card, no border and
   * no accent behind it. It is part of the exercise she is about to do, not an
   * announcement about it — anything louder would read on the stage as the app
   * selling her the set.
   */
  why: {
    ...typography.presets.bodySmall,
    color: colors.onStageMuted,
    textAlign: 'center',
    maxWidth: 320,
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
  /**
   * On the stage that margin is doubled up — `bottom` already gaps the caption
   * off the controls — and every point of it is picture. The setup and
   * celebration screens keep it: there the button ends a scrolling column and
   * has nothing above it holding a gap of its own.
   */
  primaryWrapStage: {
    marginTop: 0,
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
