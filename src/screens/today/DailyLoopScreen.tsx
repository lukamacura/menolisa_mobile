import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import { motion } from '../../theme/motion';
import type { TodayStackParamList } from '../../navigation/types';
import { usePlan, tasksForPillar } from '../../context/PlanContext';
import { useRewards } from '../../context/RewardsContext';
import { useTrialStatus } from '../../hooks/useTrialStatus';
import { useSymptomsToday } from '../../hooks/useSymptomsToday';
import { openAccountBillingEntry } from '../../lib/api';
import { AccessEndedView } from '../../components/AccessEndedView';
import { RewardsSummaryCard } from '../../components/rewards/RewardsSummaryCard';
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
  const { rewards, refresh: refreshRewards } = useRewards();
  const { count: symptomsToday, refresh: refreshSymptoms } = useSymptomsToday();
  const trialStatus = useTrialStatus();
  const [refreshing, setRefreshing] = useState(false);
  const [endingSoonDismissed, setEndingSoonDismissed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
      refreshRewards().catch(() => {});
      refreshSymptoms().catch(() => {});
      trialStatus.refetch().catch(() => {});
    }, [refresh, refreshRewards, refreshSymptoms, trialStatus.refetch])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([refresh(true), refreshRewards(true), refreshSymptoms()]).finally(() =>
      setRefreshing(false)
    );
  }, [refresh, refreshRewards, refreshSymptoms]);

  const handleOpenAccountWeb = useCallback(async () => {
    try {
      await openAccountBillingEntry();
    } catch (e) {
      Alert.alert(
        'Open account',
        e instanceof Error ? e.message : 'Could not open account options. Please try again.'
      );
    }
  }, []);

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

  // Only nag when access really is about to stop — i.e. she cancelled and the
  // paid period runs out within two days. An auto-renewing subscriber is never
  // warned.
  const showEndingSoonPaywall =
    !trialStatus.expired &&
    !trialStatus.loading &&
    trialStatus.state === 'canceling' &&
    trialStatus.daysLeft !== null &&
    trialStatus.daysLeft <= 2 &&
    trialStatus.daysLeft >= 0 &&
    !endingSoonDismissed;

  const paywall = trialStatus.expired ? (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.base)}
      exiting={reduceMotion ? undefined : FadeOutUp.duration(motion.duration.base)}
      style={[StyleSheet.absoluteFillObject, styles.paywallOverlay]}
      pointerEvents="box-none"
    >
      <AccessEndedView
        variant="fullScreen"
        accessState="expired"
        onPress={handleOpenAccountWeb}
        onSubscriptionSuccess={() => trialStatus.refetch().catch(() => {})}
        reduceMotion={reduceMotion}
      />
    </Animated.View>
  ) : showEndingSoonPaywall ? (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.base)}
      exiting={reduceMotion ? undefined : FadeOutUp.duration(motion.duration.base)}
      style={[StyleSheet.absoluteFillObject, styles.paywallOverlay]}
      pointerEvents="box-none"
    >
      <AccessEndedView
        variant="fullScreen"
        accessState="ending_soon"
        // Non-null: showEndingSoonPaywall requires it.
        daysLeft={trialStatus.daysLeft ?? 0}
        onPress={handleOpenAccountWeb}
        onSkip={() => setEndingSoonDismissed(true)}
        onSubscriptionSuccess={() => trialStatus.refetch().catch(() => {})}
        reduceMotion={reduceMotion}
      />
    </Animated.View>
  ) : null;

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
        {paywall}
        <PlanGeneratingView timedOut={status === 'error'} onRetry={() => refresh(true)} />
      </SafeAreaView>
    );
  }

  if (!plan || !segments) return <SafeAreaView style={styles.container} edges={['top']} />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {paywall}
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

          {/* Above the plan on purpose: a streak only holds behaviour if she
              sees it before deciding whether today is worth the effort. Absent
              until rewards load rather than reserving space — a placeholder
              that resolves into a 0-day streak is a worse first impression. */}
          {rewards ? (
            <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
              <RewardsSummaryCard
                rewards={rewards}
                onPress={() => navigation.navigate('Rewards')}
              />
            </StaggeredZoomIn>
          ) : null}

          <View style={styles.segments}>
            {segments.map((segment, index) => (
              <StaggeredZoomIn
                key={segment.title}
                delayIndex={index + 2}
                reduceMotion={reduceMotion}
              >
                <SegmentCard {...segment} />
              </StaggeredZoomIn>
            ))}
          </View>

          {/* Tracking sits apart from the four pillars deliberately. The plan is
              what she was asked to do today; logging a symptom is what her body
              did to her. Mixing them in one list makes an unplanned bad day look
              like a missed task. */}
          <View style={styles.trackingGroup}>
            <StaggeredZoomIn delayIndex={segments.length + 2} reduceMotion={reduceMotion}>
              <View style={styles.trackingHeader}>
                <Text style={styles.trackingLabel}>Tracking</Text>
                <View style={styles.trackingRule} />
              </View>
            </StaggeredZoomIn>

            <StaggeredZoomIn delayIndex={segments.length + 3} reduceMotion={reduceMotion}>
              <SegmentCard
                icon="pulse"
                tint={colors.navy}
                tintSoft={colors.rowNavyBg}
                title="Symptoms"
                subtitle={symptomsSubtitle(symptomsToday)}
                onPress={() => navigation.navigate('Symptoms')}
              />
            </StaggeredZoomIn>
          </View>

          <StaggeredZoomIn delayIndex={segments.length + 4} reduceMotion={reduceMotion}>
            <View style={styles.disclaimerCard}>
              <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
              <Text style={styles.disclaimerText}>
                MenoLisa is for tracking and information only. It is not medical advice. Always
                consult a healthcare provider for medical decisions.
              </Text>
            </View>
          </StaggeredZoomIn>
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

/**
 * Never phrased as a target. An empty day is the good outcome here, so the copy
 * invites rather than counts down — and an unknown count says nothing at all
 * about her day.
 */
function symptomsSubtitle(count: number | null): string {
  if (count === null) return 'Log how you are feeling';
  if (count === 0) return 'Nothing logged today · tap to add';
  if (count === 1) return '1 logged today';
  return `${count} logged today`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  paywallOverlay: {
    zIndex: 9999,
    elevation: 9999,
  },
  content: {
    paddingBottom: spacing['2xl'],
  },
  segments: {
    paddingHorizontal: spacing.lg,
  },
  trackingGroup: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  trackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  trackingLabel: {
    ...typography.presets.label,
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  trackingRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disclaimerText: {
    flex: 1,
    ...typography.presets.caption,
    color: colors.textMuted,
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
