import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../../theme/tokens';
import type { TodayStackParamList } from '../../navigation/types';
import { usePlan, tasksForPillar } from '../../context/PlanContext';
import { isPlanFinished, isTaskComplete, taskProgress, taskProgressLabel } from '../../lib/planFormat';
import type { PlanTask } from '../../lib/planTypes';
import { PlanScreenLayout } from '../../components/plan/PlanScreenLayout';
import { ExerciseCard } from '../../components/plan/ExerciseCard';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';

export function MovementScreen() {
  const route = useRoute<RouteProp<TodayStackParamList, 'Movement'>>();
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

  if (!task) {
    return (
      <PlanScreenLayout>
        <Text style={styles.empty}>Nothing scheduled this week.</Text>
      </PlanScreenLayout>
    );
  }

  const progress = taskProgress(task, finished);
  const complete = isTaskComplete(task, finished);

  return (
    <PlanScreenLayout>
      <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
        <View style={styles.header}>
          <Text style={styles.title}>{task.title}</Text>
          <Text style={styles.why}>{task.why}</Text>
          <SessionDots task={task} value={progress.value} total={progress.total} />
          <Text style={styles.progress}>{taskProgressLabel(task, finished)}</Text>
        </View>
      </StaggeredZoomIn>

      <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
        <Text style={styles.sectionTitle}>This session</Text>
        {task.exercises?.map((exercise) => (
          <ExerciseCard key={exercise.id} exercise={exercise} />
        ))}
      </StaggeredZoomIn>

      <StaggeredZoomIn delayIndex={2} reduceMotion={reduceMotion}>
        <AnimatedPressable
          containerStyle={styles.buttonWrap}
          style={[styles.button, complete && styles.buttonComplete]}
          onPress={markSession}
          accessibilityRole="button"
          accessibilityLabel="Mark this session complete"
        >
          <Ionicons
            name={complete ? 'checkmark-circle' : 'checkmark'}
            size={20}
            color={colors.textInverse}
          />
          <Text style={styles.buttonText}>
            {/* Hitting the target doesn't lock her out — an extra session is a
                good day, not an error. */}
            {complete ? 'Log another session' : 'Mark session complete'}
          </Text>
        </AnimatedPressable>
      </StaggeredZoomIn>
    </PlanScreenLayout>
  );
}

/** One dot per session the week asks for, filled as she does them. */
function SessionDots({ task, value, total }: { task: PlanTask; value: number; total: number }) {
  if (task.cadence !== 'weekly' || total <= 1) return null;
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
    marginBottom: spacing.lg,
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
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
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
  progress: {
    ...typography.presets.caption,
    color: colors.primaryDark,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.presets.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
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
  buttonComplete: {
    backgroundColor: colors.success,
    shadowColor: colors.success,
  },
  buttonText: {
    ...typography.presets.button,
    color: colors.textInverse,
  },
  empty: {
    ...typography.presets.body,
    color: colors.textMuted,
  },
});
