import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import type { TodayStackParamList } from '../../navigation/types';
import { usePlan, tasksForPillar } from '../../context/PlanContext';
import { isPlanFinished, relaxationLength, taskProgress, taskProgressLabel } from '../../lib/planFormat';
import type { PlanReady, PlanTask } from '../../lib/planTypes';
import { PlanGeneratingView } from '../../components/plan/PlanGeneratingView';
import { SegmentCard, type SegmentCardProps } from '../../components/plan/SegmentCard';
import { WeekHeader } from '../../components/plan/WeekHeader';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';
import { ContentTransition, DailyLoopSkeleton } from '../../components/skeleton';

type NavProp = NativeStackNavigationProp<TodayStackParamList, 'DailyLoop'>;

/** A segment with nothing scheduled still opens — it just says so. */
const NOTHING_SCHEDULED = 'Nothing scheduled this week';

export function DailyLoopScreen() {
  const navigation = useNavigation<NavProp>();
  const reduceMotion = useReduceMotion();
  const { status, plan, date, currentWeek, error, refresh } = usePlan();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh(true).finally(() => setRefreshing(false));
  }, [refresh]);

  const movementTask = tasksForPillar(currentWeek, 'movement')[0] ?? null;
  const relaxationTask = tasksForPillar(currentWeek, 'relaxation')[0] ?? null;
  const habitTasks = useMemo(() => tasksForPillar(currentWeek, 'habit'), [currentWeek]);

  const segments = useMemo<SegmentCardProps[] | null>(() => {
    if (!plan) return null;
    const finished = isPlanFinished(plan);

    return [
      movementSegment(movementTask, finished, () =>
        navigation.navigate('Movement', { taskKey: movementTask?.key ?? '' })
      ),
      nutritionSegment(plan, () => navigation.navigate('Nutrition')),
      relaxationSegment(relaxationTask, finished, () =>
        navigation.navigate('Relaxation', { taskKey: relaxationTask?.key ?? '' })
      ),
      habitSegment(plan, habitTasks, () => navigation.navigate('Habits')),
    ];
  }, [plan, movementTask, relaxationTask, habitTasks, navigation]);

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <DailyLoopSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (status === 'generating' || (status === 'error' && !plan)) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <PlanGeneratingView timedOut={status === 'error'} onRetry={() => refresh(true)} />
      </SafeAreaView>
    );
  }

  if (!plan || !segments) return <SafeAreaView style={styles.container} edges={['top']} />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ContentTransition>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
            <WeekHeader
              date={date}
              startedAt={plan.startedAt}
              currentWeek={plan.currentWeek}
              week={currentWeek}
            />
          </StaggeredZoomIn>

          <View style={styles.segments}>
            {segments.map((segment, index) => (
              <StaggeredZoomIn
                key={segment.title}
                delayIndex={index + 1}
                reduceMotion={reduceMotion}
              >
                <SegmentCard {...segment} />
              </StaggeredZoomIn>
            ))}
          </View>
        </ScrollView>
      </ContentTransition>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Segment state
//
// Each ring means something different, and each subtitle has to say which.
// Movement counts across the plan week (a beginner gets two sessions in seven
// days); everything else counts across today. A card that shows "0 of 1 today"
// on the five days she isn't meant to train teaches her the app is wrong.
// ---------------------------------------------------------------------------

function movementSegment(
  task: PlanTask | null,
  finished: boolean,
  onPress: () => void
): SegmentCardProps {
  const progress = task ? taskProgress(task, finished) : { value: 0, total: 0 };
  return {
    icon: 'barbell',
    tint: colors.primary,
    tintSoft: 'rgba(244, 124, 151, 0.14)',
    title: 'Movement',
    subtitle: task ? `${task.title} · ${taskProgressLabel(task, finished)}` : NOTHING_SCHEDULED,
    ...progress,
    onPress,
  };
}

function nutritionSegment(plan: PlanReady, onPress: () => void): SegmentCardProps {
  const { doneToday, total } = plan.nutrition;
  return {
    icon: 'nutrition',
    tint: colors.blue,
    tintSoft: 'rgba(58, 191, 163, 0.16)',
    title: 'Nutrition',
    subtitle: `${doneToday} of ${total} rows complete today`,
    value: doneToday,
    total,
    onPress,
  };
}

function relaxationSegment(
  task: PlanTask | null,
  finished: boolean,
  onPress: () => void
): SegmentCardProps {
  const progress = task ? taskProgress(task, finished) : { value: 0, total: 0 };
  const length = task?.relaxation ? ` · ${relaxationLength(task.relaxation)}` : '';
  return {
    icon: 'leaf',
    tint: colors.lavender,
    tintSoft: 'rgba(139, 124, 246, 0.16)',
    title: 'Relaxation',
    subtitle: task
      ? `${task.title}${length} · ${taskProgressLabel(task, finished)}`
      : NOTHING_SCHEDULED,
    ...progress,
    onPress,
  };
}

function habitSegment(
  plan: PlanReady,
  habitTasks: PlanTask[],
  onPress: () => void
): SegmentCardProps {
  // Her own habits are target 1; a plan habit task may be per_day.
  const total = habitTasks.length + plan.habits.length;
  const done =
    habitTasks.filter((task) => task.doneToday >= task.target).length +
    plan.habits.filter((habit) => habit.doneToday > 0).length;

  const bestStreak = plan.habits.reduce((best, habit) => Math.max(best, habit.streak), 0);
  const streakLabel = bestStreak > 0 ? ` · ${bestStreak}-day streak` : '';

  return {
    icon: 'checkmark-done',
    tint: colors.gold,
    tintSoft: 'rgba(255, 179, 138, 0.28)',
    title: 'Your habits',
    subtitle: total === 0 ? 'Add one you want to keep' : `${done} of ${total} done today${streakLabel}`,
    value: done,
    total,
    onPress,
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing['2xl'],
  },
  segments: {
    paddingHorizontal: spacing.lg,
  },
  errorBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.dangerBg,
  },
  errorText: {
    ...typography.presets.bodySmall,
    color: colors.danger,
  },
});
