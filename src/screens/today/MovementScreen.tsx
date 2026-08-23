import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../../theme/tokens';
import type { TodayStackParamList } from '../../navigation/types';
import { usePlan, tasksForPillar } from '../../context/PlanContext';
import {
  isPlanFinished,
  isTaskComplete,
  sessionSeconds,
  taskCadenceHint,
  taskProgress,
  taskRemainingLabel,
} from '../../lib/planFormat';
import type { PlanTask } from '../../lib/planTypes';
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
  const task = tasks.find((entry) => entry.key === route.params.taskKey) ?? tasks[0] ?? null;
  const finished = plan ? isPlanFinished(plan) : false;

  // One session done today. `count` replaces the day's total, so a second
  // session on the same day sends 2 — doneThisWeek is the server's sum across
  // the week's days and moves on its own.
  const markSession = useCallback(() => {
    if (!task) return;
    tick(task.key, task.doneToday + 1).catch(() => {});
  }, [task, tick]);

  const startSession = useCallback(() => {
    if (!task) return;
    navigation.navigate('MovementSession', { taskKey: task.key });
  }, [navigation, task]);

  const sessionMinutes = task?.exercises?.length
    ? Math.max(1, Math.round(sessionSeconds(task.exercises) / 60))
    : 0;

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
  const exerciseCount = task.exercises?.length ?? 0;

  return (
    <PlanScreenLayout>
      <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
        <View style={styles.header}>
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

      <StaggeredZoomIn delayIndex={2} reduceMotion={reduceMotion}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>
            {exerciseCount > 0 ? `One session · ${exerciseCount} exercises` : 'This session'}
          </Text>
          {sessionMinutes > 0 && <Text style={styles.sectionMeta}>about {sessionMinutes} min</Text>}
        </View>
        {task.exercises?.map((exercise) => (
          <ExerciseCard key={exercise.id} exercise={exercise} />
        ))}
      </StaggeredZoomIn>

      <StaggeredZoomIn delayIndex={3} reduceMotion={reduceMotion}>
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
  dotDone: {
    backgroundColor: colors.success,
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
  buttonWrap: {
    marginTop: spacing.lg,
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
