import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
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
import { PlanScreenLayout } from '../../components/plan/PlanScreenLayout';
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

  // The whole session, bookends included — she is being told how long this
  // takes, and a warm-up she is asked to do is part of how long it takes.
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
  // other existed. The warm-up and cool-down are named in the list below, which
  // is where they belong: they are part of how long this takes, not part of what
  // she is being asked to do.
  const exerciseCount = phaseCount(items, 'main');

  return (
    <PlanScreenLayout>
      <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
        <View style={styles.header}>
          {/* Only when there is a choice to make. One movement day is the case
              this screen was built for, and a lone tab above the title would be
              a control that cannot do anything. */}
          {tasks.length > 1 && (
            <View style={styles.dayTabs} accessibilityRole="tablist">
              {tasks.map((entry) => {
                const selected = entry.key === task.key;
                const done = isTaskComplete(entry, finished);
                return (
                  <Pressable
                    key={entry.key}
                    onPress={() => setSelectedKey(entry.key)}
                    style={[styles.dayTab, selected && styles.dayTabSelected]}
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
                    <Text
                      numberOfLines={1}
                      style={[styles.dayTabText, selected && styles.dayTabTextSelected]}
                    >
                      {entry.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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
            {exerciseCount > 0
              ? `One session · ${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'}`
              : 'This session'}
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
            {block.exercises.map((exercise) => (
              <ExerciseCard key={`${block.phase}-${exercise.id}`} exercise={exercise} />
            ))}
          </View>
        ))}
      </StaggeredZoomIn>
    </PlanScreenLayout>
  );
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
