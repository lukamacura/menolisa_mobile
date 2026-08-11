import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import { usePlan } from '../../context/PlanContext';
import { ContentTransition, PlanDetailSkeleton } from '../skeleton';

type PlanScreenLayoutProps = {
  children: React.ReactNode;
};

/**
 * The shell every pillar screen shares: pull-to-refresh, the skeleton gate, and
 * one place for the write-error banner.
 *
 * These screens read the plan out of context rather than fetching — the hub
 * already refreshes on focus, and four detail screens each firing their own GET
 * on every back-swipe would be four heavy reads for nothing.
 */
export function PlanScreenLayout({ children }: PlanScreenLayoutProps) {
  const { status, plan, error, refresh } = usePlan();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh(true).finally(() => setRefreshing(false));
  }, [refresh]);

  if (!plan && status === 'loading') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <PlanDetailSkeleton />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
          {children}
        </ScrollView>
      </ContentTransition>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  errorBanner: {
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.dangerBg,
  },
  errorText: {
    ...typography.presets.bodySmall,
    color: colors.danger,
  },
});
