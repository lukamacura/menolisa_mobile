import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import type { TodayStackParamList } from '../../navigation/types';
import { usePlan, tasksForPillar } from '../../context/PlanContext';
import { isPlanFinished, taskProgressLabel } from '../../lib/planFormat';
import { PlanScreenLayout } from '../../components/plan/PlanScreenLayout';
import { BreathingPlayer } from '../../components/plan/BreathingPlayer';
import { PracticeTimer } from '../../components/plan/PracticeTimer';
import { TickStepper } from '../../components/plan/TickStepper';
import {
  GratitudeSuccessPanel,
  GRATITUDE_DISMISS_MS,
} from '../../components/GratitudeSuccessPanel';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';

export function RelaxationScreen() {
  const route = useRoute<RouteProp<TodayStackParamList, 'Relaxation'>>();
  const reduceMotion = useReduceMotion();
  const { plan, currentWeek, tick } = usePlan();
  const [celebrating, setCelebrating] = useState(false);

  const tasks = tasksForPillar(currentWeek, 'relaxation');
  // Read the live task by key so a tick here is reflected without re-navigating.
  const task = tasks.find((entry) => entry.key === route.params.taskKey) ?? tasks[0] ?? null;
  const finished = plan ? isPlanFinished(plan) : false;

  const onComplete = useCallback(() => {
    if (!task) return;
    setCelebrating(true);
    // Uncapped, like Movement: a second session in one day is a good day, not an
    // error, and silently discarding the tick made the player look broken.
    tick(task.key, task.doneToday + 1).catch(() => {});
  }, [task, tick]);

  // The panel has no controls, so without this she is left on a congratulations
  // screen with no way back to the practice except the header's back button.
  useEffect(() => {
    if (!celebrating) return;
    const timer = setTimeout(() => setCelebrating(false), GRATITUDE_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [celebrating]);

  if (!task) {
    return (
      <PlanScreenLayout>
        <Text style={styles.empty}>Nothing scheduled this week.</Text>
      </PlanScreenLayout>
    );
  }

  if (celebrating) {
    return (
      <PlanScreenLayout>
        <GratitudeSuccessPanel
          title="That's your nervous system, settled"
          subtitle={task.why}
          encouragement="Reach for this again whenever you need it."
          metaChips={[{ icon: 'leaf', label: task.title }]}
          reduceMotion={reduceMotion}
        />
      </PlanScreenLayout>
    );
  }

  return (
    <PlanScreenLayout>
      <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
        <View style={styles.header}>
          <Text style={styles.title}>{task.title}</Text>
          <Text style={styles.why}>{task.why}</Text>
          <Text style={styles.progress}>{taskProgressLabel(task, finished)}</Text>
        </View>
      </StaggeredZoomIn>

      {task.relaxation?.kind === 'breathing' && (
        <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
          <BreathingPlayer detail={task.relaxation} onComplete={onComplete} />
        </StaggeredZoomIn>
      )}

      {task.relaxation?.kind === 'practice' && (
        <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
          <Text style={styles.use}>{task.relaxation.use}</Text>
          <PracticeTimer minutes={task.relaxation.minutes} onComplete={onComplete} />
        </StaggeredZoomIn>
      )}

      {/* A relaxation task whose key isn't a catalog id arrives with no protocol.
          It is still a real task — she just ticks it rather than being guided. */}
      {!task.relaxation && (
        <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion} style={styles.manual}>
          <Text style={styles.manualLabel}>Mark it done when you have</Text>
          <TickStepper
            count={task.doneToday}
            target={task.target}
            max={task.target}
            onChange={(next) => tick(task.key, next).catch(() => {})}
            label={task.title}
          />
        </StaggeredZoomIn>
      )}
    </PlanScreenLayout>
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
  progress: {
    ...typography.presets.caption,
    color: colors.primaryDark,
    marginTop: spacing.xs,
  },
  use: {
    ...typography.presets.body,
    color: colors.text,
    textAlign: 'center',
  },
  manual: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  manualLabel: {
    ...typography.presets.bodyMedium,
    color: colors.text,
    flex: 1,
  },
  empty: {
    ...typography.presets.body,
    color: colors.textMuted,
  },
});
