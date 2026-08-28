import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
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
import { usePlanCycleRecap } from '../../hooks/usePlanCycleRecap';
import { usePlanRenewalPrompt } from '../../hooks/usePlanRenewalPrompt';
import { useUpdateNudge } from '../../hooks/useAppUpdate';
import { useSymptomsToday } from '../../hooks/useSymptomsToday';
import { openAccountBillingEntry } from '../../lib/api';
import { AccessEndedView } from '../../components/AccessEndedView';
import { UpdateAvailableCard } from '../../components/UpdateAvailableCard';
import { RewardsSummaryCard } from '../../components/rewards/RewardsSummaryCard';
import {
  isPlanFinished,
  isTaskComplete,
  relaxationLength,
  taskProgress,
  taskProgressLabel,
  taskRemainingLabel,
} from '../../lib/planFormat';
import type { PlanReady, PlanTask } from '../../lib/planTypes';
import { PlanGeneratingView } from '../../components/plan/PlanGeneratingView';
import { SegmentCard, type SegmentCardProps } from '../../components/plan/SegmentCard';
import { WeekHeader } from '../../components/plan/WeekHeader';
import {
  StaggeredZoomIn,
  STAGGER_DELAY_MS,
  useReduceMotion,
} from '../../components/StaggeredZoomIn';
import { ContentTransition, DailyLoopSkeleton } from '../../components/skeleton';
import { errorMessage } from '../../lib/errorCopy';

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
  const { pendingCycle } = usePlanCycleRecap();
  const { pendingRenewal } = usePlanRenewalPrompt();
  // The soft half of the update prompt. The hard half is a gate in
  // AppNavigator and never reaches this screen.
  const updateNudge = useUpdateNudge();
  const [refreshing, setRefreshing] = useState(false);
  const [endingSoonDismissed, setEndingSoonDismissed] = useState(false);

  // Every dependency here is referentially stable, so this runs once per focus.
  // It previously listed callbacks that changed identity whenever their own
  // response landed, which re-armed the effect and fired a second round of
  // reads — including a second POST to Stripe — on every visit to the hub.
  const refetchStatus = trialStatus.refetch;
  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
      refreshRewards().catch(() => {});
      refreshSymptoms().catch(() => {});
      refetchStatus().catch(() => {});
    }, [refresh, refreshRewards, refreshSymptoms, refetchStatus])
  );

  /**
   * The handoff between two plans.
   *
   * Her eight weeks ran out, the server scored them and started writing the
   * next set, and she is owed the recap exactly once. This is the only place
   * that decides to show it — the hub is the app's front door, so there is no
   * route into a fresh week 1 that bypasses it.
   *
   * It runs on focus rather than on mount because the rollover is detected by
   * a `GET /api/plan` that may land while she is on another tab, and it is
   * deliberately not guarded by `status === 'ready'`: the new plan is usually
   * still generating at this point, and filling that wait is the whole idea.
   */
  useFocusEffect(
    useCallback(() => {
      // The recap wins when both are owed. It is about the eight weeks she has
      // just finished, so it has to come before the screen asking her to commit
      // to eight more — and dismissing it lands her back here, where the
      // renewal screen is still waiting.
      if (pendingCycle) {
        navigation.navigate('PlanRecap', { cycle: pendingCycle });
        return;
      }
      if (pendingRenewal) navigation.navigate('PlanContinue');
    }, [pendingCycle, pendingRenewal, navigation])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([refresh(true), refreshRewards(true), refreshSymptoms()])
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [refresh, refreshRewards, refreshSymptoms]);

  const handleOpenAccountWeb = useCallback(async () => {
    try {
      await openAccountBillingEntry();
    } catch (e) {
      Alert.alert(
        'Open account',
        errorMessage(e, 'Could not open account options. Please try again.')
      );
    }
  }, []);

  /**
   * Every movement entry the week holds, not just the first.
   *
   * A week used to carry exactly one, so `[0]` was the whole story. The
   * upper/lower split gives her two — and read one at a time, the second is
   * invisible on this hub and unreachable from it, because the card below is
   * also what navigates. The pillar stays one card: this screen is four
   * pillars, and a fifth would stop being a daily loop.
   */
  const movementTasks = useMemo(
    () => tasksForPillar(currentWeek, 'movement'),
    [currentWeek]
  );
  const relaxationTask = tasksForPillar(currentWeek, 'relaxation')[0] ?? null;
  const habitTasks = useMemo(() => tasksForPillar(currentWeek, 'habit'), [currentWeek]);

  const segments = useMemo<SegmentCardProps[] | null>(() => {
    if (!plan) return null;
    const finished = isPlanFinished(plan);

    return [
      // `onPress` is undefined when there is nothing scheduled, so the card
      // reads as inert rather than pushing a screen whose only content is the
      // same sentence she just tapped.
      movementSegment(
        movementTasks,
        finished,
        // Opens the day she still owes, not whichever the plan happens to list
        // first — on a split week that is the difference between landing on the
        // session she has left and landing on the one she finished on Monday.
        movementTasks.length
          ? () =>
              navigation.navigate('Movement', {
                taskKey: (
                  movementTasks.find((task) => !isTaskComplete(task, finished)) ??
                  movementTasks[0]
                ).key,
              })
          : undefined
      ),
      nutritionSegment(plan, () => navigation.navigate('Nutrition')),
      relaxationSegment(
        relaxationTask,
        finished,
        relaxationTask
          ? () => navigation.navigate('Relaxation', { taskKey: relaxationTask.key })
          : undefined
      ),
      habitSegment(plan, habitTasks, () => navigation.navigate('Habits')),
    ];
  }, [plan, movementTasks, relaxationTask, habitTasks, navigation]);

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

  const paywall = showEndingSoonPaywall ? (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.base)}
      exiting={reduceMotion ? undefined : FadeOutUp.duration(motion.duration.base)}
      style={[StyleSheet.absoluteFillObject, styles.paywallOverlay]}
      pointerEvents="box-none"
    >
      <AccessEndedView
        // Non-null: showEndingSoonPaywall requires it.
        daysLeft={trialStatus.daysLeft ?? 0}
        onPress={handleOpenAccountWeb}
        onSkip={() => setEndingSoonDismissed(true)}
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

  /*
    The fall-through: status is neither loading, generating, nor a hard error,
    and yet there is no plan to draw. It should not happen — but it used to
    return a bare `SafeAreaView`, and a white screen with nothing on it is the
    one state she cannot act on. No text, no refresh control, nothing to tap;
    the only way out was force-quitting the app. Whatever the cause, she gets a
    sentence and a button.
  */
  if (!plan || !segments) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {paywall}
        <View style={styles.blankState}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.blankTitle}>Your plan isn't showing</Text>
          <Text style={styles.blankText}>
            Nothing is lost — we just could not put today together. Try again in a moment.
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.blankButton}
            onPress={() => refresh(true)}
            accessibilityRole="button"
            accessibilityLabel="Reload your plan"
          >
            <Ionicons name="refresh" size={18} color={colors.background} />
            <Text style={styles.blankButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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

          {/* Sits with the error banner rather than among the plan cards: it is
              news about the app, not about her day, and nothing below it should
              have to shuffle around a message that is gone once she acts on it. */}
          {updateNudge.visible && updateNudge.latest ? (
            <UpdateAvailableCard
              latest={updateNudge.latest}
              onUpdate={updateNudge.openStore}
              onDismiss={updateNudge.dismiss}
            />
          ) : null}

          <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
            <WeekHeader
              date={date}
              startedAt={plan.startedAt}
              currentWeek={plan.currentWeek}
              week={currentWeek}
              onOpenDay={() => navigation.navigate('Progress', { focusDate: date })}
              onOpenWeek={() => navigation.navigate('Progress', { focusWeek: plan.currentWeek })}
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
                <SegmentCard {...segment} sweepDelayMs={(index + 2) * STAGGER_DELAY_MS} />
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
  tasks: PlanTask[],
  finished: boolean,
  onPress?: () => void
): SegmentCardProps {
  // Summed across the week's entries, so the ring counts the sessions she was
  // actually asked for. On a split week the upper day alone would read "1 of 2"
  // while she owed four.
  const progress = tasks.reduce(
    (running, task) => {
      const { value, total } = taskProgress(task, finished);
      return { value: running.value + value, total: running.total + total };
    },
    { value: 0, total: 0 }
  );

  return {
    icon: 'barbell',
    tint: colors.primary,
    tintSoft: 'rgba(244, 124, 151, 0.14)',
    title: 'Movement',
    // What is left, not where she is: "1 of 2 this week" is the ring's job, and
    // on the hub the sentence has to say what today still asks of her.
    subtitle: movementSubtitle(tasks, finished),
    ...progress,
    onPress,
  };
}

/**
 * The one line under the Movement ring, however many entries the week holds.
 *
 * With two, naming the *next unfinished* day is the only version that stays
 * true all week: naming the first would go on advertising the upper day after
 * she had done it, and naming both does not fit on one line of a card.
 */
function movementSubtitle(tasks: PlanTask[], finished: boolean): string {
  if (tasks.length === 0) return NOTHING_SCHEDULED;

  const next = tasks.find((task) => !isTaskComplete(task, finished));
  if (next) return `${next.title} · ${taskRemainingLabel(next, finished)}`;
  if (tasks.length === 1) return `${tasks[0].title} · ${taskRemainingLabel(tasks[0], finished)}`;

  // Everything done. `taskRemainingLabel` speaks for one entry only, so the
  // all-clear for several is written here rather than borrowed from one of them.
  const period = tasks[0].cadence === 'weekly' && !finished ? 'this week' : 'today';
  return `All ${tasks.length} sessions done ${period}`;
}

function nutritionSegment(plan: PlanReady, onPress: () => void): SegmentCardProps {
  const { doneToday, total } = plan.nutrition;
  return {
    icon: 'nutrition',
    tint: colors.blue,
    tintSoft: 'rgba(58, 191, 163, 0.16)',
    title: 'Nutrition',
    subtitle: `${doneToday} of ${total} tasks complete today`,
    value: doneToday,
    total,
    onPress,
  };
}

function relaxationSegment(
  task: PlanTask | null,
  finished: boolean,
  onPress?: () => void
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
  blankState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing['2xl'],
  },
  blankTitle: {
    ...typography.presets.heading3,
    color: colors.text,
    textAlign: 'center',
  },
  blankText: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
  },
  blankButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
  },
  blankButtonText: {
    ...typography.presets.button,
    color: colors.background,
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
