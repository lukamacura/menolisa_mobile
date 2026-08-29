import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../../theme/tokens';
import type { TodayStackParamList } from '../../navigation/types';
import { usePlan, tasksForPillar } from '../../context/PlanContext';
import {
  buildSessionItems,
  isPlanFinished,
  isTaskComplete,
  phaseCount,
  sessionBlocks,
  sessionSeconds,
  taskCadenceHint,
  taskProgress,
  taskRemainingLabel,
} from '../../lib/planFormat';
import { SESSION_PHASE_LABEL, type PlanTask } from '../../lib/planTypes';
import { cardioExercise, cardioProtocol } from '../../lib/cardio';
import { PlanScreenLayout } from '../../components/plan/PlanScreenLayout';
import { CardioProtocol } from '../../components/plan/CardioProtocol';
import { ExerciseCard } from '../../components/plan/ExerciseCard';
import { ProgressRing } from '../../components/plan/ProgressRing';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';

export function MovementScreen() {
  const route = useRoute<RouteProp<TodayStackParamList, 'Movement'>>();
  const navigation = useNavigation<NativeStackNavigationProp<TodayStackParamList, 'Movement'>>();
  const reduceMotion = useReduceMotion();
  const { plan, currentWeek, tick } = usePlan();

  const tasks = tasksForPillar(currentWeek, 'movement');
  const finished = plan ? isPlanFinished(plan) : false;

  /**
   * Which of the week's movement days she is looking at.
   *
   * Held in state rather than read straight off the route because a week can
   * now carry more than one — the upper/lower split — and the switcher below
   * has to move between them without pushing a second copy of this screen onto
   * the stack. The route still wins whenever it changes: that is a movement
   * reminder naming its task, and it must land on the day it was about.
   *
   * The fallback is the first *unfinished* day, not `tasks[0]`. Landing her on
   * the session she finished on Monday, with its ring full and its button
   * offering to log another, is the wrong answer every day but the first.
   */
  const routeKey = route.params?.taskKey;
  const [selectedKey, setSelectedKey] = useState<string | undefined>(routeKey);
  useEffect(() => {
    if (routeKey) setSelectedKey(routeKey);
  }, [routeKey]);

  const task =
    tasks.find((entry) => entry.key === selectedKey) ??
    tasks.find((entry) => !isTaskComplete(entry, finished)) ??
    tasks[0] ??
    null;

  // One session done today. `count` replaces the day's total, so a second
  // session on the same day sends 2 — doneThisWeek is the server's sum across
  // the week's days and moves on its own.
  const markSession = useCallback(() => {
    if (!task) return;
    tick(task.key, (current) => current + 1).catch(() => {});
  }, [task, tick]);

  const startSession = useCallback(() => {
    if (!task) return;
    navigation.navigate('MovementSession', { taskKey: task.key });
  }, [navigation, task]);

  // The whole session — bookends, and the power block on the days that carry
  // it. She is being told how long this takes, and a warm-up she is asked to do
  // is part of how long it takes. Which is also why the length here is summed
  // rather than looked up: a power day is five to ten minutes longer than the
  // same task was yesterday, and no table per fitness level can know that.
  const items = useMemo(() => buildSessionItems(task), [task]);
  const blocks = useMemo(() => (task ? sessionBlocks(task) : []), [task]);
  const sessionMinutes = items.length ? Math.max(1, Math.round(sessionSeconds(items) / 60)) : 0;

  if (!task) {
    return (
      <PlanScreenLayout>
        <Text style={styles.empty}>Nothing scheduled this week.</Text>
      </PlanScreenLayout>
    );
  }

  const progress = taskProgress(task, finished);
  const complete = isTaskComplete(task, finished);
  const cadenceHint = taskCadenceHint(task);
  // The working exercises only — the same number the session's own setup screen
  // shows one tap later. It used to count the bookends too, so a session read as
  // "11 exercises" here and "4 exercises" there, and neither screen admitted the
  // other existed. The warm-up, power block and cool-down are named in the list
  // below, which is where they belong: they are part of how long this takes, not
  // part of what she is being asked to do. `exercises` is the main work only,
  // and every count in the app that asks "how much did she train" reads it.
  const exerciseCount = phaseCount(items, 'main');
  const powerNote = powerBlockNote(task);
  // A cardio task is one continuous block, so "1 exercise" is a count of
  // something she was never asked to think of as a list. The interval day is
  // the one that owes her more than a name and a duration — its structure is
  // the whole difference between it and a shorter walk.
  const cardio = cardioExercise(task);
  const protocol = cardio ? cardioProtocol(cardio) : null;

  return (
    <PlanScreenLayout>
      <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
        <View style={styles.header}>
          {/* Only when there is a choice to make. One movement day is the case
              this screen was built for, and a lone tab above the title would be
              a control that cannot do anything. */}
          {tasks.length > 1 && (
            <TaskTabs
              tasks={tasks}
              selectedKey={task.key}
              finished={finished}
              onSelect={setSelectedKey}
            />
          )}
          <Text style={styles.title}>{task.title}</Text>
          <Text style={styles.why}>{task.why}</Text>
        </View>
      </StaggeredZoomIn>

      {/* The nutrition screen has always opened with the same three facts — how
          much is asked of you, how much is done, and what's left. Movement used
          to open with a progress line alone, which tells her where she is but
          never what she was asked for; on day one of a week those read the same
          and mean opposite things. */}
      <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
        <View style={styles.summary}>
          <ProgressRing
            value={progress.value}
            total={progress.total}
            size={54}
            color={colors.primary}
            label={complete ? undefined : `${progress.value}/${Math.max(1, progress.total)}`}
            sweepDelayMs={140}
          />
          <View style={styles.summaryText}>
            <Text style={styles.summaryTitle}>{taskRemainingLabel(task, finished)}</Text>
            {cadenceHint && (
              <Text style={styles.summarySubtitle}>
                Your plan asks for {cadenceHint.toLowerCase()}
              </Text>
            )}
            <SessionDots task={task} value={progress.value} total={progress.total} />
          </View>
        </View>
      </StaggeredZoomIn>

      {/* The button that gets her here at all belongs above the fold, next to
          the summary that just told her what it's for — not stranded below a
          list of exercises she has to scroll past first. */}
      <StaggeredZoomIn delayIndex={2} reduceMotion={reduceMotion}>
        <AnimatedPressable
          containerStyle={styles.buttonWrap}
          style={styles.button}
          onPress={startSession}
          accessibilityRole="button"
          accessibilityLabel="Start the guided session"
        >
          <Ionicons name="play" size={20} color={colors.textInverse} />
          <Text style={styles.buttonText}>Start session</Text>
        </AnimatedPressable>

        {/* She may well have done this at the gym, or in a class, with the phone
            in a locker. Guiding her is the offer; logging it must never depend
            on having taken the offer. */}
        <AnimatedPressable
          containerStyle={styles.manualWrap}
          style={styles.manual}
          onPress={markSession}
          accessibilityRole="button"
          accessibilityLabel="Log this session without the timer"
        >
          <Ionicons
            name={complete ? 'checkmark-circle' : 'checkmark'}
            size={16}
            color={complete ? colors.success : colors.textMuted}
          />
          <Text style={styles.manualText}>
            {/* Hitting the target doesn't lock her out — an extra session is a
                good day, not an error. */}
            {complete ? 'Log another session' : 'I already did this'}
          </Text>
        </AnimatedPressable>
      </StaggeredZoomIn>

      <StaggeredZoomIn delayIndex={3} reduceMotion={reduceMotion}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>
            {cardio || exerciseCount === 0
              ? 'This session'
              : `One session · ${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'}`}
          </Text>
          {sessionMinutes > 0 && <Text style={styles.sectionMeta}>about {sessionMinutes} min</Text>}
        </View>

        {/* Split by phase only when there is more than one — a session that is
            all main work must keep reading as a plain list, not as a list with
            a redundant "Main work" rule drawn across the top of it. */}
        {blocks.map((block) => (
          <View key={block.phase}>
            {blocks.length > 1 && (
              <View style={styles.phaseHead}>
                <Text style={styles.phaseTitle}>{SESSION_PHASE_LABEL[block.phase]}</Text>
                <View style={styles.phaseRule} />
                <Text style={styles.phaseCount}>{block.exercises.length}</Text>
              </View>
            )}
            {/* The one phase that is not in every session of the week, so the
                one phase that has to say what it is doing here. Without this
                line it simply vanishes from the list after her second session
                and reads as something the app lost. */}
            {block.phase === 'power' && <Text style={styles.phaseNote}>{powerNote}</Text>}
            {block.exercises.map((exercise) => (
              <ExerciseCard key={`${block.phase}-${exercise.id}`} exercise={exercise} />
            ))}
          </View>
        ))}

        {/* The interval protocol, here as well as on the timer. She decides
            whether she has the legs for it on this screen, and "19 min" is not
            enough to decide on. */}
        {protocol && <CardioProtocol steps={protocol} style={styles.protocol} />}
      </StaggeredZoomIn>
    </PlanScreenLayout>
  );
}

/**
 * The switcher across the top: every movement task the week holds.
 *
 * A week used to hold one or two of these and two fit across a phone at equal
 * widths. It now holds three or four — the strength session plus one or two
 * cardio tasks — and at a quarter of the screen each "Zone 2 cardio" and
 * "Sprint intervals" both truncate to nothing anyone can tell apart. So past
 * two the row scrolls and every tab is only as wide as its own title: a
 * switcher that has to be guessed at is worse than one she has to swipe.
 */
function TaskTabs({
  tasks,
  selectedKey,
  finished,
  onSelect,
}: {
  tasks: PlanTask[];
  selectedKey: string;
  finished: boolean;
  onSelect: (key: string) => void;
}) {
  const scrolls = tasks.length > 2;

  /**
   * Bring the selected tab into view.
   *
   * Not a nicety: a movement reminder names its task, and the week's last task
   * is the interval day. Landing from that notification with the tab she was
   * sent to sitting off the right edge — the screen below it correct, the
   * switcher above it showing two other days — reads as the app having opened
   * the wrong thing.
   */
  const scroller = useRef<ScrollView>(null);
  const spans = useRef<Record<string, { x: number; width: number }>>({});
  const [viewport, setViewport] = useState(0);
  useEffect(() => {
    if (!scrolls || !viewport) return;
    const span = spans.current[selectedKey];
    if (!span) return;
    scroller.current?.scrollTo({
      x: Math.max(0, span.x + span.width / 2 - viewport / 2),
      animated: true,
    });
  }, [scrolls, selectedKey, viewport]);

  const tabs = tasks.map((entry) => {
    const selected = entry.key === selectedKey;
    const done = isTaskComplete(entry, finished);
    return (
      <Pressable
        key={entry.key}
        onPress={() => onSelect(entry.key)}
        onLayout={(event) => {
          spans.current[entry.key] = event.nativeEvent.layout;
        }}
        style={[styles.dayTab, scrolls && styles.dayTabAuto, selected && styles.dayTabSelected]}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={done ? `${entry.title}, done` : entry.title}
      >
        {done && (
          <Ionicons
            name="checkmark"
            size={13}
            color={selected ? colors.primaryDark : colors.textMuted}
          />
        )}
        <Text numberOfLines={1} style={[styles.dayTabText, selected && styles.dayTabTextSelected]}>
          {entry.title}
        </Text>
      </Pressable>
    );
  });

  if (!scrolls) {
    return (
      <View style={styles.dayTabs} accessibilityRole="tablist">
        {tabs}
      </View>
    );
  }

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(event) => setViewport(event.nativeEvent.layout.width)}
      style={styles.dayTabsScroller}
      contentContainerStyle={styles.dayTabsRow}
      accessibilityRole="tablist"
    >
      {tabs}
    </ScrollView>
  );
}

/**
 * The line under the power block's header — why it is here, and whether it is
 * in every session of the week or only some of them.
 *
 * It leads with what the block is *for* rather than with the schedule. "On 2 of
 * your 3 sessions" answers a question she has not asked yet; "keeps bone strong"
 * is the reason the block exists, and it is the only part of the session whose
 * benefit is invisible — she can feel a squat working and cannot feel anything
 * at all happening to her hip.
 *
 * The schedule half is added only when there is a schedule to explain. A task
 * whose every session carries the block — every beginner plan — would be told
 * "in 2 of your 2 sessions", which is a sentence that raises a question rather
 * than answering one.
 */
function powerBlockNote(task: PlanTask): string {
  const why = 'Impact work — the part that keeps bone strong.';
  const sessions = task.powerSessions;
  if (sessions === undefined || sessions >= task.target) return why;
  return `${why} In ${sessions} of your ${task.target} sessions this week.`;
}

/**
 * One dot per session the period asks for, filled as she does them.
 *
 * Drawn for a per-day cadence too — movement snacks are four short bursts a day
 * and the count matters there more than anywhere, not less.
 */
function SessionDots({ task, value, total }: { task: PlanTask; value: number; total: number }) {
  if (total <= 1 || (task.cadence !== 'weekly' && task.cadence !== 'per_day')) return null;
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }, (_, index) => index).map((index) => (
        <View key={index} style={[styles.dot, index < value && styles.dotDone]} />
      ))}
      {value > total && <Text style={styles.bonus}>+{value - total}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.md,
  },
  dayTabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  // The scroller keeps the row's margin; the content inside it keeps the gap.
  dayTabsScroller: {
    marginBottom: spacing.sm,
  },
  dayTabsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingRight: spacing.xs,
  },
  dayTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  // Inside the scroller a tab is as wide as its own title, never a share of a
  // row it no longer fills. `flexBasis: 'auto'` is the whole trick and it is not
  // optional: `flex: 1` above expands to a basis of 0, and unsetting only the
  // grow leaves a tab that is zero points wide with its label invisible inside
  // it. `flex: 0` does not help — it keeps the zero basis.
  dayTabAuto: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    paddingHorizontal: spacing.md,
  },
  dayTabSelected: {
    borderColor: colors.primary,
    // rgba, never an 8-digit hex — Android renders #RRGGBBAA backgrounds flat grey.
    backgroundColor: 'rgba(244, 124, 151, 0.14)',
  },
  dayTabText: {
    ...typography.presets.buttonSmall,
    color: colors.textMuted,
    flexShrink: 1,
  },
  dayTabTextSelected: {
    color: colors.primaryDark,
  },
  title: {
    ...typography.presets.heading2,
    color: colors.text,
  },
  why: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    marginTop: 2,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryText: {
    flex: 1,
    minWidth: 0,
  },
  summaryTitle: {
    ...typography.presets.heading3,
    color: colors.text,
  },
  summarySubtitle: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  dot: {
    width: 26,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  /**
   * Coral, not `success`. These dots sit inches from a `ProgressRing` drawn in
   * the brand coral and counting the identical thing; two colours for one number
   * reads as two numbers. Green also has a job on the session screen this button
   * leads to — it means "you are resting" — and the two must not shake hands.
   */
  dotDone: {
    backgroundColor: colors.primary,
  },
  bonus: {
    ...typography.presets.caption,
    color: colors.primaryDark,
    marginLeft: 2,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.presets.label,
    color: colors.textMuted,
  },
  sectionMeta: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },
  // The phase rules are quieter than the section head above them: they divide
  // one list, they do not start a new one.
  phaseHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  phaseTitle: {
    ...typography.presets.caption,
    fontFamily: typography.family.semibold,
    color: colors.textMuted,
  },
  phaseRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  phaseCount: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },
  protocol: {
    marginTop: spacing.sm,
  },
  phaseNote: {
    ...typography.presets.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  buttonWrap: {
    marginTop: 0,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: minTouchTarget + 6,
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
    ...shadows.buttonPrimary,
  },
  buttonText: {
    ...typography.presets.button,
    color: colors.textInverse,
  },
  manualWrap: {
    marginTop: spacing.sm,
  },
  manual: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: minTouchTarget,
    borderRadius: radii.xl,
  },
  manualText: {
    ...typography.presets.buttonSmall,
    color: colors.textMuted,
  },
  empty: {
    ...typography.presets.body,
    color: colors.textMuted,
  },
});
