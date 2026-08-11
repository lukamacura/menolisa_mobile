import React, { useCallback, useState } from 'react';
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
import { GratitudeSuccessPanel } from '../../components/GratitudeSuccessPanel';
import { useReduceMotion } from '../../components/StaggeredZoomIn';

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
    tick(task.key, Math.min(task.doneToday + 1, task.target)).catch(() => {});
  }, [task, tick]);

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
      <View style={styles.header}>
        <Text style={styles.title}>{task.title}</Text>
        <Text style={styles.why}>{task.why}</Text>
        <Text style={styles.progress}>{taskProgressLabel(task, finished)}</Text>
      </View>

      {task.relaxation?.kind === 'breathing' && (
        <BreathingPlayer detail={task.relaxation} onComplete={onComplete} />
      )}

      {task.relaxation?.kind === 'practice' && (
        <>
          <Text style={styles.use}>{task.relaxation.use}</Text>
          <PracticeTimer minutes={task.relaxation.minutes} onComplete={onComplete} />
        </>
      )}

      {/* A relaxation task whose key isn't a catalog id arrives with no protocol.
          It is still a real task — she just ticks it rather than being guided. */}
      {!task.relaxation && (
        <View style={styles.manual}>
          <Text style={styles.manualLabel}>Mark it done when you have</Text>
          <TickStepper
            count={task.doneToday}
            target={task.target}
            max={task.target}
            onChange={(next) => tick(task.key, next).catch(() => {})}
            label={task.title}
          />
        </View>
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
