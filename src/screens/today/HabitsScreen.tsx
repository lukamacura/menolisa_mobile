import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget } from '../../theme/tokens';
import { usePlan, tasksForPillar, type TickValue } from '../../context/PlanContext';
import { MAX_HABITS, habitTaskKey, type HabitKind, type PlanTask } from '../../lib/planTypes';
import { isPlanFinished, taskProgressLabel } from '../../lib/planFormat';
import { PlanScreenLayout } from '../../components/plan/PlanScreenLayout';
import { HabitRow } from '../../components/plan/HabitRow';
import { AddHabitSheet } from '../../components/plan/AddHabitSheet';
import { ResistSuggestionCard } from '../../components/plan/ResistSuggestionCard';
import { TickStepper } from '../../components/plan/TickStepper';
import { WhySheet } from '../../components/plan/WhySheet';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';

/**
 * Everything habit-shaped in one place: what the plan asks of her this week,
 * what she has taken on herself, and what is still on offer.
 */
export function HabitsScreen() {
  const reduceMotion = useReduceMotion();
  const { plan, currentWeek, tick, addHabit, removeHabit } = usePlan();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [adopting, setAdopting] = useState<string | null>(null);

  const planTasks = tasksForPillar(currentWeek, 'habit');
  const finished = plan ? isPlanFinished(plan) : false;
  const atCap = (plan?.habits.length ?? 0) >= MAX_HABITS;

  const onAdd = useCallback(
    (title: string, kind: HabitKind) => addHabit(title, kind),
    [addHabit]
  );

  const adopt = useCallback(
    async (title: string) => {
      setAdopting(title);
      try {
        await addHabit(title, 'resist');
      } catch {
        // The context surfaces write failures through its own error banner.
      } finally {
        setAdopting(null);
      }
    },
    [addHabit]
  );

  return (
    <PlanScreenLayout>
      {planTasks.length > 0 && (
        <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>From your plan this week</Text>
            {planTasks.map((task) => (
              <PlanHabitRow
                key={task.key}
                task={task}
                finished={finished}
                onChange={(next) => tick(task.key, next).catch(() => {})}
              />
            ))}
          </View>
        </StaggeredZoomIn>
      )}

      <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Your habits</Text>
            <Text style={styles.cap}>
              {plan?.habits.length ?? 0} of {MAX_HABITS}
            </Text>
          </View>

          {plan?.habits.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              onChange={(next) => tick(habitTaskKey(habit.id), next).catch(() => {})}
              onRemove={() => removeHabit(habit.id).catch(() => {})}
            />
          ))}

          {plan?.habits.length === 0 && (
            <Text style={styles.empty}>
              Nothing here yet. Add one small thing you want to keep up — it gets its own streak.
            </Text>
          )}

          <AnimatedPressable
            containerStyle={styles.addWrap}
            style={[styles.add, atCap && styles.addDisabled]}
            onPress={() => setSheetOpen(true)}
            disabled={atCap}
            accessibilityRole="button"
            accessibilityLabel="Add a habit"
          >
            <Ionicons
              name="add"
              size={18}
              color={atCap ? colors.textMuted : colors.primaryDark}
            />
            <Text style={[styles.addText, atCap && styles.addTextDisabled]}>
              {atCap ? `You can track up to ${MAX_HABITS} habits` : 'Add a habit'}
            </Text>
          </AnimatedPressable>
        </View>
      </StaggeredZoomIn>

      {plan && plan.resistSuggestions.length > 0 && (
        <StaggeredZoomIn delayIndex={2} reduceMotion={reduceMotion}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Worth resisting</Text>
            <Text style={styles.sectionHint}>
              Take one on and you get credit for every day you hold it.
            </Text>
            {plan.resistSuggestions.map((suggestion) => (
              <ResistSuggestionCard
                key={suggestion.title}
                suggestion={suggestion}
                adding={adopting === suggestion.title}
                disabled={atCap}
                onAdd={() => adopt(suggestion.title)}
              />
            ))}
          </View>
        </StaggeredZoomIn>
      )}

      <AddHabitSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onAdd={onAdd}
      />
    </PlanScreenLayout>
  );
}

/** A `pillar: "habit"` task from the plan. Read-only apart from its tick. */
function PlanHabitRow({
  task,
  finished,
  onChange,
}: {
  task: PlanTask;
  finished: boolean;
  onChange: (next: TickValue) => void;
}) {
  const [whyOpen, setWhyOpen] = useState(false);

  return (
    <View style={styles.row}>
      <View style={styles.iconWell}>
        <Ionicons name="sparkles" size={17} color={colors.gold} />
      </View>

      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={2} onPress={() => setWhyOpen(true)}>
          {task.title}
        </Text>
        <Text style={styles.rowMeta}>{taskProgressLabel(task, finished)}</Text>
      </View>

      <TickStepper
        count={task.doneToday}
        target={task.target}
        max={task.target}
        onChange={onChange}
        label={task.title}
      />

      <WhySheet
        visible={whyOpen}
        title={task.title}
        why={task.why}
        onClose={() => setWhyOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.lg,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...typography.presets.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  sectionHint: {
    ...typography.presets.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  cap: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget + spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWell: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 179, 138, 0.28)',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    ...typography.presets.bodyMedium,
    color: colors.text,
  },
  rowMeta: {
    ...typography.presets.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  empty: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
  },
  addWrap: {
    marginTop: spacing.xs,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: minTouchTarget,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
  },
  addDisabled: {
    backgroundColor: colors.background,
    borderStyle: 'solid',
  },
  addText: {
    ...typography.presets.buttonSmall,
    color: colors.primaryDark,
  },
  addTextDisabled: {
    color: colors.textMuted,
  },
});
