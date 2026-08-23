import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radii, shadows, typography } from '../../theme/tokens';
import type { TodayStackParamList } from '../../navigation/types';
import { usePlan } from '../../context/PlanContext';
import { usePlanHistory } from '../../hooks/usePlanHistory';
import { usePlanCycleRecap } from '../../hooks/usePlanCycleRecap';
import { toPercent } from '../../lib/planHistoryTypes';
import { formatLongDate } from '../../lib/planHistoryFormat';
import { PillarRing } from '../../components/progress/PillarRing';
import { PillarLegend } from '../../components/progress/PillarLegend';
import { AnimatedPressable } from '../../components/AnimatedPressable';

type RecapRoute = RouteProp<TodayStackParamList, 'PlanRecap'>;
type Navigation = NativeStackNavigationProp<TodayStackParamList, 'PlanRecap'>;

/**
 * The eight weeks she just finished, shown once, on the day the next eight
 * begin.
 *
 * This is the only screen in the app that looks purely backwards, and it exists
 * for one reason: a plan that silently resets to week 1 reads as a bug, while
 * the same reset behind a page that says "here is what you did" reads as
 * earning the next one. It is the renewal moment.
 *
 * Three rules it inherits from the rest of the progress feature:
 *
 * 1. **No failure colour and no shortfall.** There is no target line, no "you
 *    missed", no red. She is reading eight weeks of her own life.
 * 2. **A `null` pillar is not a zero.** `PillarRing` and `PillarLegend` both
 *    already know the difference; nothing here re-derives a percentage.
 * 3. **It never blocks her.** The next plan is usually still being written when
 *    she lands here — that is the point, the wait is what this fills — so the
 *    button is live from the first frame and simply returns her to the daily
 *    loop, which knows how to show a plan that is still generating.
 */
export function PlanRecapScreen() {
  const route = useRoute<RecapRoute>();
  const navigation = useNavigation<Navigation>();
  const { status: planStatus } = usePlan();
  const { markSeen } = usePlanCycleRecap();

  const cycle = route.params.cycle;
  const { status, history } = usePlanHistory(cycle);

  // Marked seen here rather than on mount: a recap she never actually read —
  // a crash, a force-quit while it loaded — is still owed to her next time.
  const onContinue = useCallback(() => {
    markSeen();
    navigation.goBack();
  }, [markSeen, navigation]);

  const overall = history?.overall;
  const score = overall ? toPercent(overall.score) : 0;

  const range =
    history && history.weeks.length
      ? `${formatLongDate(history.weeks[0].startDate)} – ${formatLongDate(
          history.weeks[history.weeks.length - 1].endDate
        )}`
      : null;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>Plan {cycle} complete</Text>
        <Text style={styles.title}>Eight weeks, done.</Text>
        {range ? <Text style={styles.range}>{range}</Text> : null}

        {status === 'loading' && !history ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {history ? (
          <>
            <View style={styles.hero}>
              <PillarRing
                movement={overall?.movement?.ratio ?? null}
                nutrition={overall?.nutrition?.ratio ?? null}
                relaxation={overall?.relaxation?.ratio ?? null}
                size={148}
                strokeWidth={12}
                animate
                accessibilityLabel={`${score} percent across your eight weeks.`}
              >
                <Text style={styles.heroPercent} allowFontScaling={false}>
                  {score}
                  <Text style={styles.heroPercentSign}>%</Text>
                </Text>
              </PillarRing>
            </View>

            <View style={styles.card}>
              <PillarLegend
                movement={overall?.movement ?? null}
                nutrition={overall?.nutrition ?? null}
                relaxation={overall?.relaxation ?? null}
                scope="span"
              />
            </View>
          </>
        ) : null}

        <View style={styles.next}>
          <Text style={styles.nextTitle}>What happens now</Text>
          <Text style={styles.nextBody}>
            {planStatus === 'generating'
              ? 'Lisa is writing your next eight weeks. She has your last eight in front of her, so this one is built around what actually worked for you — not a fresh start from scratch.'
              : 'Your next eight weeks are ready, built around what actually worked for you over these ones. Nothing here is lost — you can open any past plan from Progress whenever you like.'}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <AnimatedPressable
          style={styles.button}
          onPress={onContinue}
          accessibilityRole="button"
          accessibilityLabel="Start my next eight weeks"
        >
          <Text style={styles.buttonLabel}>Start my next 8 weeks</Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  eyebrow: {
    ...typography.presets.label,
    color: colors.primary,
    textAlign: 'center',
  },
  title: {
    ...typography.presets.heading1,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  range: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  loading: {
    paddingVertical: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  heroPercent: {
    ...typography.presets.heading1,
    color: colors.text,
  },
  heroPercentSign: {
    ...typography.presets.body,
    color: colors.textMuted,
  },
  card: {
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  next: {
    marginTop: spacing.xl,
  },
  nextTitle: {
    ...typography.presets.heading3,
    color: colors.text,
  },
  nextBody: {
    ...typography.presets.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonLabel: {
    ...typography.presets.button,
    color: colors.textInverse,
  },
});
