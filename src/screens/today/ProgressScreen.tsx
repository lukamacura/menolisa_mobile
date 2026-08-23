import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import { colors, spacing, radii, shadows, typography } from '../../theme/tokens';
import type { TodayStackParamList } from '../../navigation/types';
import { usePlanHistory } from '../../hooks/usePlanHistory';
import { toPercent, type DayProgress } from '../../lib/planHistoryTypes';
import { overallHeadline, formatLongDate, weekdayInitial } from '../../lib/planHistoryFormat';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { PillarRing } from '../../components/progress/PillarRing';
import { PillarLegend } from '../../components/progress/PillarLegend';
import { WeekRow } from '../../components/progress/WeekRow';
import { DayDetailSheet } from '../../components/progress/DayDetailSheet';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';
import { ProgressSkeleton } from '../../components/skeleton';

type ProgressRoute = RouteProp<TodayStackParamList, 'Progress'>;

/** Gap between day columns. Small — seven of them have to fit a 320pt phone. */
const COLUMN_GAP = 4;
/** Leaves the focused week a little air above it rather than pinning it to the top edge. */
const SCROLL_MARGIN = 12;

/**
 * Her eight weeks, day by day.
 *
 * Three things about this screen are deliberate and easy to undo by accident:
 *
 * 1. **It scores movement, nutrition and relaxation — not habits, not
 *    symptoms.** Habits are hers to add and delete, so counting them would move
 *    the denominator under her feet: adding a habit today would quietly lower
 *    last Tuesday. Symptoms were never a target and a bad day must never render
 *    as a miss.
 * 2. **Rows are plan weeks, not calendar weeks.** The plan runs from
 *    `startedAt`, so a Monday-to-Sunday grid would split every week and open
 *    with a half-empty row. The column weekdays are still honest, because every
 *    plan week begins on the same weekday.
 * 3. **There is no failure colour anywhere.** A missed day is an unfilled ring
 *    in the same neutral as an untouched one. She may be opening this after a
 *    fortnight her body decided for her.
 *
 * Every 56 days she is written a new plan and the old one becomes a past cycle,
 * reachable from the switcher above the hero. That switcher renders only when
 * there is more than one, so for her first eight weeks this screen is exactly
 * what it always was.
 *
 * Switching cycles is a round-trip, so it answers on three channels at once: a
 * selection haptic on the tap, a skeleton shaped like the cards it replaces,
 * and a scroll back to the top — a new plan's week 6 is not where she was.
 */
export function ProgressScreen() {
  const route = useRoute<ProgressRoute>();
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  /** Which cycle she is looking at. Null means the one she is living in. */
  const [viewCycle, setViewCycle] = useState<number | null>(null);
  const { status, history, switching, refresh } = usePlanHistory(viewCycle);

  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayProgress | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  /** Where the grid card starts, so a week's own offset can be turned into a page offset. */
  const gridTopRef = useRef(0);
  /** Focus params are a one-shot: coming back from the day sheet must not re-scroll. */
  const handledFocus = useRef(false);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh(true).finally(() => setRefreshing(false));
  }, [refresh]);

  /**
   * Tapping a cycle chip.
   *
   * The active chip is a no-op on purpose: re-tapping it would fire a haptic
   * and blank the grid for a payload she is already looking at.
   */
  const onSelectCycle = useCallback(
    (entry: { cycle: number; current: boolean }, active: boolean) => {
      if (active) return;
      Haptics.selectionAsync().catch(() => {});
      // A different plan's week 6 is not where she was reading.
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      setViewCycle(entry.current ? null : entry.cycle);
    },
    []
  );

  const cellWidth = useMemo(
    () => (width - spacing.lg * 2 - spacing.md * 2 - COLUMN_GAP * 6) / 7,
    [width]
  );

  /** Weekday letters for the seven columns. Constant across weeks — see the note above. */
  const weekdays = useMemo(() => {
    const first = history?.weeks[0]?.days ?? [];
    return first.map((day) => weekdayInitial(day.date));
  }, [history]);

  const focusWeek = route.params?.focusWeek;
  const focusDate = route.params?.focusDate;

  /**
   * Jump to what she tapped.
   *
   * Runs off the week row's own layout rather than a computed row height, so a
   * longer week title that wraps can never drift the target by a row.
   */
  const onWeekLayout = useCallback(
    (weekNumber: number, y: number) => {
      if (handledFocus.current || !history) return;

      const target =
        focusWeek ??
        (focusDate ? history.weeks.find((w) => w.days.some((d) => d.date === focusDate))?.number : undefined);
      if (target !== weekNumber) return;

      handledFocus.current = true;
      // The offset is inside the grid card, so add where the card itself sits.
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, gridTopRef.current + y - SCROLL_MARGIN),
          animated: !reduceMotion,
        });
      });

      if (focusDate) {
        const day = history.weeks
          .flatMap((w) => w.days)
          .find((d) => d.date === focusDate);
        if (day && day.state !== 'future') setSelectedDay(day);
      }
    },
    [history, focusWeek, focusDate, reduceMotion]
  );

  if (!history) {
    // First load gets the same skeleton the switcher does — a centred spinner
    // line here and a card-shaped placeholder there would read as two screens.
    if (status === 'loading') {
      return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.skeletonTop} />
            <ProgressSkeleton cellWidth={cellWidth} />
          </ScrollView>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{emptyCopy(status)}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { overall, daysElapsed } = history;
  const cycles = history.cycles ?? [];
  /** One cycle is her first plan — there is nothing to switch between. */
  const showSwitcher = cycles.length > 1;
  const viewing = cycles.find((c) => c.cycle === history.cycle) ?? null;
  const isPast = viewing ? !viewing.current : false;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {showSwitcher ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.switcher}
          >
            {cycles.map((entry) => {
              const active = entry.cycle === history.cycle;
              return (
                <AnimatedPressable
                  key={entry.cycle}
                  style={[styles.chip, active && styles.chipActive]}
                  containerStyle={styles.chipContainer}
                  onPress={() => onSelectCycle(entry, active)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Plan ${entry.cycle}, starting ${formatLongDate(entry.startedAt)}`}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                    {entry.current ? 'Now' : `Plan ${entry.cycle}`}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </ScrollView>
        ) : null}

        {switching ? (
          <ProgressSkeleton cellWidth={cellWidth} />
        ) : (
          <>
          <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <PillarRing
                  movement={overall.movement?.ratio ?? null}
                  nutrition={overall.nutrition?.ratio ?? null}
                  relaxation={overall.relaxation?.ratio ?? null}
                  size={112}
                  strokeWidth={9}
                  animate
                  animateDelayMs={120}
                  accessibilityLabel={`${toPercent(overall.score)} percent of your plan so far`}
                >
                  <Text style={styles.heroPercent} allowFontScaling={false}>
                    {toPercent(overall.score)}%
                  </Text>
                </PillarRing>

                <View style={styles.heroText}>
                  <Text style={styles.heroTitle}>
                    {isPast ? `Plan ${history.cycle}` : 'Your eight weeks'}
                  </Text>
                  <Text style={styles.heroSubtitle}>
                    {isPast && viewing
                      ? `Complete · ${formatLongDate(viewing.startedAt)}`
                      : overallHeadline(overall.score, daysElapsed)}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <PillarLegend
                movement={overall.movement}
                nutrition={overall.nutrition}
                relaxation={overall.relaxation}
                scope="span"
              />
            </View>
          </StaggeredZoomIn>

          <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
            <View
              style={styles.grid}
              onLayout={(event) => {
                gridTopRef.current = event.nativeEvent.layout.y;
              }}
            >
              <View style={styles.weekdays}>
                {weekdays.map((letter, index) => (
                  <View key={index} style={{ width: cellWidth }}>
                    <Text style={styles.weekday} allowFontScaling={false}>
                      {letter}
                    </Text>
                  </View>
                ))}
              </View>

              {history.weeks.map((week) => (
                <View
                  key={week.number}
                  onLayout={(event) => onWeekLayout(week.number, event.nativeEvent.layout.y)}
                >
                  <WeekRow week={week} cellWidth={cellWidth} onDayPress={setSelectedDay} />
                </View>
              ))}
            </View>
          </StaggeredZoomIn>
          </>
        )}

        <Text style={styles.note}>
          Movement counts across the week, so a rest day never counts against you. Nutrition and
          relaxation are scored each day.
        </Text>
      </ScrollView>

      <DayDetailSheet day={selectedDay} onClose={() => setSelectedDay(null)} />
    </SafeAreaView>
  );
}

function emptyCopy(status: 'loading' | 'ready' | 'empty' | 'error'): string {
  if (status === 'empty') return 'Your progress starts once your plan is ready.';
  if (status === 'error') return 'We could not load your progress. Pull down to try again.';
  return 'Loading your progress…';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing['2xl'],
  },
  /** Stands in for the switcher's height so the hero does not jump on arrival. */
  skeletonTop: {
    height: spacing.md,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
  },
  switcher: {
    gap: spacing.xs,
    // Matches the hero and grid cards' margin, so the first chip sits on the
    // screen's left rule instead of against its edge, and the last one has
    // somewhere to scroll into.
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  chipContainer: {
    // AnimatedPressable defaults to full width; inside a horizontal scroller
    // that percentage has no parent width to resolve against.
    width: 'auto',
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipLabel: {
    ...typography.presets.buttonSmall,
    color: colors.textMuted,
  },
  chipLabelActive: {
    color: colors.textInverse,
  },
  hero: {
    margin: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadows.card,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroText: {
    flex: 1,
  },
  heroPercent: {
    fontFamily: typography.display.bold,
    fontSize: 26,
    color: colors.text,
  },
  heroTitle: {
    ...typography.presets.heading2,
    color: colors.text,
  },
  heroSubtitle: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  grid: {
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  weekdays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  weekday: {
    ...typography.presets.caption,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  note: {
    ...typography.presets.caption,
    color: colors.textMuted,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
});

export default ProgressScreen;
