import React, { createContext, useCallback, useContext, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  type LayoutChangeEvent,
} from 'react-native';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import { usePlan } from '../../context/PlanContext';
import { ContentTransition, PlanDetailSkeleton } from '../skeleton';

/**
 * The measured height of the scrollable area, in points. Null until the first
 * layout pass.
 *
 * Window height is not a usable stand-in here: the pushed header and the tab bar
 * eat ~175pt of an 844pt phone, and a screen that must fit without scrolling has
 * to size itself against what is actually left. Measured rather than estimated
 * because both of those depend on insets we cannot see from a leaf component.
 */
const PlanViewportContext = createContext<number | null>(null);

export function usePlanViewport(): number | null {
  return useContext(PlanViewportContext);
}

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
  const [viewport, setViewport] = useState<number | null>(null);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setViewport((current) => (current === height ? current : height));
  }, []);

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
    <View style={styles.container} onLayout={onLayout}>
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
          <PlanViewportContext.Provider value={viewport}>{children}</PlanViewportContext.Provider>
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
