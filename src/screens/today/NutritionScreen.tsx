import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import { usePlan } from '../../context/PlanContext';
import { PlanScreenLayout } from '../../components/plan/PlanScreenLayout';
import { NutritionRow } from '../../components/plan/NutritionRow';
import { ProgressRing } from '../../components/plan/ProgressRing';
import { SupplementChips } from '../../components/plan/SupplementChips';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';

/**
 * All ten rows, every day, for everyone.
 *
 * Nothing here is hardcoded — labels, group headers, targets and the count all
 * come from the response, because the funnel and this screen share one catalog
 * and it has already changed once. `nutritionFocus` only marks which rows the
 * week pushes on; it never filters the list.
 */
export function NutritionScreen() {
  const reduceMotion = useReduceMotion();
  const { plan, tick } = usePlan();

  const onChange = useCallback(
    (key: string, next: number) => {
      tick(key, next).catch(() => {});
    },
    [tick]
  );

  return (
    <PlanScreenLayout>
      {plan && (
        <>
          <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
            <View style={styles.summary}>
              <ProgressRing
                value={plan.nutrition.doneToday}
                total={plan.nutrition.total}
                size={54}
                color={colors.blue}
                label={`${plan.nutrition.doneToday}/${plan.nutrition.total}`}
              />
              <View style={styles.summaryText}>
                <Text style={styles.summaryTitle}>
                  {plan.nutrition.doneToday === plan.nutrition.total
                    ? 'Every row done today'
                    : `${plan.nutrition.doneToday} of ${plan.nutrition.total} complete today`}
                </Text>
                <Text style={styles.summarySubtitle}>
                  Tap a row to read why it&apos;s on your list.
                </Text>
              </View>
            </View>
          </StaggeredZoomIn>

          {plan.nutrition.groups.map((group, groupIndex) => (
            <StaggeredZoomIn
              key={group.title}
              delayIndex={groupIndex + 1}
              reduceMotion={reduceMotion}
            >
              <View style={styles.group}>
                <Text style={styles.groupTitle}>{group.title}</Text>
                {group.items.map((item) => (
                  <NutritionRow
                    key={item.key}
                    item={item}
                    onChange={(next) => onChange(item.key, next)}
                  >
                    {item.id === 'supplements' && item.doneToday && (
                      <SupplementChips supplements={plan.nutrition.supplements} />
                    )}
                  </NutritionRow>
                ))}
              </View>
            </StaggeredZoomIn>
          ))}
        </>
      )}
    </PlanScreenLayout>
  );
}

const styles = StyleSheet.create({
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
  group: {
    marginBottom: spacing.lg,
  },
  groupTitle: {
    ...typography.presets.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
});
