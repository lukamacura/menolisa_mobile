import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing, typography } from '../../theme/tokens';
import { useRewards } from '../../context/RewardsContext';
import type { Achievement } from '../../lib/rewardTypes';
import { BadgeTile, formatCount } from '../../components/rewards/BadgeTile';
import { BadgeDetailSheet } from '../../components/rewards/BadgeDetailSheet';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';
import { ProgressSummaryCard } from '../../components/progress/ProgressSummaryCard';
import { usePlanHistory } from '../../hooks/usePlanHistory';
import type { TodayStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<TodayStackParamList, 'Rewards'>;

/**
 * Everything she has earned: level, streak and every badge.
 *
 * Earned badges come first and locked ones after, rather than one flat grid.
 * The wall of things she has already done is the reason to open this screen;
 * burying it among eighteen grey medals makes the screen feel like a to-do list.
 *
 * The badges are the screen. There is deliberately no lifetime-stats table
 * between the chips and the grid — seven counted rows of "nutrition rows" and
 * "habit ticks" read as a spreadsheet and push the medals below the fold, and
 * every number in it is already the reason one of those medals exists.
 */
export function RewardsScreen() {
  const navigation = useNavigation<NavProp>();
  const { status, rewards, refresh } = useRewards();
  // Badges are what she has earned; the grid is what she has done against the
  // plan. Different questions, so it links out rather than folding in here.
  const { history } = usePlanHistory();
  const reduceMotion = useReduceMotion();
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Achievement | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh(true).finally(() => setRefreshing(false));
  }, [refresh]);

  const { earned, locked } = useMemo(() => {
    const all = rewards?.achievements ?? [];
    return {
      earned: all.filter((a) => a.unlocked),
      locked: all.filter((a) => !a.unlocked),
    };
  }, [rewards]);

  if (!rewards) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {status === 'error'
              ? 'We could not load your rewards. Pull down to try again.'
              : 'Loading your rewards…'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const { level, streak, xp } = rewards;
  // The medals she can see, not `rewards.earned` — that is every tier flattened,
  // so a family she has taken twice would make the chip read one higher than the grid.
  const badgeCount = earned.length;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
          <View style={styles.hero}>
            <Text style={styles.heroLevel}>Level {level.level}</Text>
            <Text style={styles.heroName}>{level.name}</Text>

            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.round(Math.min(1, Math.max(0, level.progress)) * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.heroMeta}>
              {formatCount(xp.total)} XP · {level.toNext} to level {level.level + 1}
            </Text>
          </View>
        </StaggeredZoomIn>

        <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
          <View style={styles.statRow}>
            <StatChip
              icon="flame"
              tint="#F4623A"
              value={String(streak.current)}
              label="day streak"
            />
            <StatChip
              icon="trophy"
              tint={colors.gold}
              value={String(streak.best)}
              label="best streak"
            />
            <StatChip
              icon="medal"
              tint={colors.lavender}
              value={String(badgeCount)}
              label={badgeCount === 1 ? 'badge' : 'badges'}
            />
          </View>
        </StaggeredZoomIn>

        {history ? (
          <StaggeredZoomIn delayIndex={2} reduceMotion={reduceMotion}>
            <ProgressSummaryCard
              history={history}
              onPress={() => navigation.navigate('Progress')}
            />
          </StaggeredZoomIn>
        ) : null}

        {earned.length > 0 && (
          <StaggeredZoomIn delayIndex={3} reduceMotion={reduceMotion}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Earned</Text>
              <View style={styles.grid}>
                {earned.map((achievement) => (
                  <BadgeTile
                    key={achievement.id}
                    achievement={achievement}
                    onPress={setSelected}
                  />
                ))}
              </View>
            </View>
          </StaggeredZoomIn>
        )}

        {locked.length > 0 && (
          <StaggeredZoomIn delayIndex={4} reduceMotion={reduceMotion}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Still to come</Text>
              <View style={styles.grid}>
                {locked.map((achievement) => (
                  <BadgeTile
                    key={achievement.id}
                    achievement={achievement}
                    onPress={setSelected}
                  />
                ))}
              </View>
            </View>
          </StaggeredZoomIn>
        )}
      </ScrollView>

      <BadgeDetailSheet achievement={selected} onClose={() => setSelected(null)} />
    </SafeAreaView>
  );
}

function StatChip({
  icon,
  tint,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={20} color={tint} />
      <Text style={styles.chipValue}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing['2xl'],
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
  hero: {
    margin: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  heroLevel: {
    ...typography.presets.label,
    color: colors.lavender,
  },
  heroName: {
    ...typography.presets.heading1,
    color: colors.text,
    marginBottom: spacing.md,
  },
  track: {
    height: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.plumSoft,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.lavender,
  },
  heroMeta: {
    ...typography.presets.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipValue: {
    ...typography.presets.heading2,
    color: colors.text,
    marginTop: 2,
  },
  chipLabel: {
    ...typography.presets.caption,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.presets.heading2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    // No column gap: BadgeTile is exactly a third wide and carries its own
    // horizontal padding, so rows always hold three and stay aligned.
    rowGap: spacing.md,
  },
});
