import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import type { TodayStackParamList } from '../../navigation/types';
import { usePlan, tasksForPillar } from '../../context/PlanContext';
import {
  formatDuration,
  isPlanFinished,
  relaxationLength,
  taskProgressLabel,
} from '../../lib/planFormat';
import { PlanScreenLayout } from '../../components/plan/PlanScreenLayout';
import { BreathingPlayer } from '../../components/plan/BreathingPlayer';
import { MeditationPlayer } from '../../components/plan/MeditationPlayer';
import { PracticeTimer } from '../../components/plan/PracticeTimer';
import {
  RelaxationChoice,
  type RelaxationOption,
} from '../../components/plan/RelaxationChoice';
import { TickStepper } from '../../components/plan/TickStepper';
import {
  GratitudeSuccessPanel,
  GRATITUDE_DISMISS_MS,
} from '../../components/GratitudeSuccessPanel';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';

/**
 * Which of the two routes through today's relaxation she is on.
 *
 * `plan` is whatever the week asked for — a breathing pattern, a timed practice,
 * or a bare tick. `meditation` is the recording offered beside it. **Both
 * complete the same task**: the tick goes against `task.key` either way, so the
 * plan, her streaks and every adherence read stay ignorant of which one she
 * chose. That is deliberate. A woman who lay down and listened did her
 * relaxation; the app has no business grading the method.
 */
type RelaxationMode = 'plan' | 'meditation';

export function RelaxationScreen() {
  const route = useRoute<RouteProp<TodayStackParamList, 'Relaxation'>>();
  const reduceMotion = useReduceMotion();
  const { plan, currentWeek, tick } = usePlan();
  const [mode, setMode] = useState<RelaxationMode>('plan');
  /** The mode she finished in, or null. Doubles as "show the panel". */
  const [celebrating, setCelebrating] = useState<RelaxationMode | null>(null);

  const tasks = tasksForPillar(currentWeek, 'relaxation');
  // Read the live task by key so a tick here is reflected without re-navigating.
  const task = tasks.find((entry) => entry.key === route.params.taskKey) ?? tasks[0] ?? null;
  const finished = plan ? isPlanFinished(plan) : false;

  // Absent on an older server, and absent whenever media was not requested.
  // Both mean the same thing here: no choice, and the plan's practice stands
  // alone exactly as it did before this existed.
  const meditation = plan?.meditation ?? null;

  // A refresh can take the meditation away mid-session — a rollback, or a
  // server that stopped serving it. Falling back beats rendering a chosen mode
  // with nothing behind it.
  useEffect(() => {
    if (!meditation && mode === 'meditation') setMode('plan');
  }, [meditation, mode]);

  const options = useMemo((): RelaxationOption<RelaxationMode>[] | null => {
    if (!task || !meditation) return null;
    return [
      {
        key: 'plan',
        label: task.title,
        // No length on a task whose key is not a catalog id — it has no protocol
        // and therefore no duration to promise.
        length: task.relaxation ? relaxationLength(task.relaxation) : undefined,
      },
      { key: 'meditation', label: meditation.title, length: formatDuration(meditation.seconds) },
    ];
  }, [task, meditation]);

  const onComplete = useCallback(() => {
    if (!task) return;
    setCelebrating(mode);
    // Uncapped, like Movement: a second session in one day is a good day, not an
    // error, and silently discarding the tick made the player look broken.
    tick(task.key, (current) => current + 1).catch(() => {});
  }, [task, tick, mode]);

  // The panel has no controls, so without this she is left on a congratulations
  // screen with no way back to the practice except the header's back button.
  useEffect(() => {
    if (!celebrating) return;
    const timer = setTimeout(() => setCelebrating(null), GRATITUDE_DISMISS_MS);
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
    // The chip names what she actually did, not what the plan asked for. Telling
    // a woman who just finished eleven minutes of meditation that she did her
    // breathing is the app not paying attention.
    const viaMeditation = celebrating === 'meditation' && meditation !== null;
    return (
      <PlanScreenLayout>
        <GratitudeSuccessPanel
          title="That's your nervous system, settled"
          subtitle={task.why}
          encouragement="Reach for this again whenever you need it."
          metaChips={[
            viaMeditation
              ? { icon: 'headset', label: meditation.title }
              : { icon: 'leaf', label: task.title },
          ]}
          reduceMotion={reduceMotion}
        />
      </PlanScreenLayout>
    );
  }

  // The title names what is on the screen; the reason and the progress stay the
  // task's, because they are still true whichever route she takes — `why` is why
  // relaxation is on her plan today, not why it is a breathing pattern.
  const heading = mode === 'meditation' && meditation ? meditation.title : task.title;

  return (
    <PlanScreenLayout>
      <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
        <View style={styles.header}>
          <Text style={styles.title}>{heading}</Text>
          <Text style={styles.why}>{task.why}</Text>
          <Text style={styles.progress}>{taskProgressLabel(task, finished)}</Text>
        </View>
      </StaggeredZoomIn>

      {/* Only when there is something to choose between. One option is not a
          choice, it is a control that does nothing. */}
      {options && (
        <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion} style={styles.choice}>
          <RelaxationChoice options={options} selected={mode} onSelect={setMode} />
        </StaggeredZoomIn>
      )}

      {mode === 'meditation' && meditation ? (
        <StaggeredZoomIn delayIndex={2} reduceMotion={reduceMotion}>
          <MeditationPlayer meditation={meditation} onComplete={onComplete} />
        </StaggeredZoomIn>
      ) : (
        <>
          {task.relaxation?.kind === 'breathing' && (
            <StaggeredZoomIn delayIndex={2} reduceMotion={reduceMotion}>
              <BreathingPlayer detail={task.relaxation} onComplete={onComplete} />
            </StaggeredZoomIn>
          )}

          {task.relaxation?.kind === 'practice' && (
            <StaggeredZoomIn delayIndex={2} reduceMotion={reduceMotion}>
              <Text style={styles.use}>{task.relaxation.use}</Text>
              <PracticeTimer minutes={task.relaxation.minutes} onComplete={onComplete} />
            </StaggeredZoomIn>
          )}

          {/* A relaxation task whose key isn't a catalog id arrives with no
              protocol. It is still a real task — she just ticks it rather than
              being guided. */}
          {!task.relaxation && (
            <StaggeredZoomIn delayIndex={2} reduceMotion={reduceMotion} style={styles.manual}>
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
        </>
      )}
    </PlanScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.md,
  },
  choice: {
    marginBottom: spacing.sm,
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
