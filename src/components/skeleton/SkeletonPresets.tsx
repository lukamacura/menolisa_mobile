import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing, radii, minTouchTarget } from '../../theme/tokens';
import { Skeleton } from './Skeleton';


/** Generic list with header + N rows (icon + 2 lines). Reusable for SymptomLogs, Symptoms, Notifications, ChatList. */
export function ListSkeleton({
  headerTitleWidth = 160,
  rowCount = 5,
  rowHasIcon = true,
}: {
  headerTitleWidth?: number;
  rowCount?: number;
  rowHasIcon?: boolean;
}) {
  return (
    <View style={styles.listWrap}>
      <View style={styles.listHeader}>
        <Skeleton width={headerTitleWidth} height={22} borderRadius={radii.sm} />
      </View>
      <View style={styles.listContent}>
        {Array.from({ length: rowCount }).map((_, i) => (
          <View key={i} style={styles.listRow}>
            {rowHasIcon && <Skeleton width={40} height={40} borderRadius={radii.md} />}
            <View style={{ flex: 1 }}>
              <Skeleton width="75%" height={16} style={{ marginBottom: 6 }} />
              <Skeleton width="50%" height={14} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Symptom logs: section titles + log rows. */
export function SymptomLogsSkeleton() {
  return (
    <View style={styles.listContentPadding}>
      <View style={styles.section}>
        <Skeleton width={60} height={14} style={{ marginBottom: spacing.sm }} />
        <View style={styles.logRow}>
          <Skeleton width={40} height={40} borderRadius={radii.md} />
          <View style={{ flex: 1 }}>
            <Skeleton width="50%" height={16} style={{ marginBottom: 6 }} />
            <Skeleton width="40%" height={14} />
          </View>
        </View>
        <View style={styles.logRow}>
          <Skeleton width={40} height={40} borderRadius={radii.md} />
          <View style={{ flex: 1 }}>
            <Skeleton width="45%" height={16} style={{ marginBottom: 6 }} />
            <Skeleton width="35%" height={14} />
          </View>
        </View>
      </View>
      <View style={styles.section}>
        <Skeleton width={80} height={14} style={{ marginBottom: spacing.sm }} />
        <View style={styles.logRow}>
          <Skeleton width={40} height={40} borderRadius={radii.md} />
          <View style={{ flex: 1 }}>
            <Skeleton width="55%" height={16} style={{ marginBottom: 6 }} />
            <Skeleton width="38%" height={14} />
          </View>
        </View>
      </View>
    </View>
  );
}

/** Symptoms screen: header row + list of symptom rows. */
export function SymptomsSkeleton() {
  return (
    <View style={styles.listContentPadding}>
      <View style={styles.viewHistoryRow}>
        <Skeleton width={24} height={24} borderRadius={radii.sm} />
        <Skeleton width={180} height={16} style={{ flex: 1, marginLeft: spacing.sm }} />
      </View>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={styles.symptomRow}>
          <Skeleton width={22} height={22} borderRadius={radii.sm} />
          <Skeleton width={120} height={16} style={{ flex: 1, marginHorizontal: spacing.md }} />
        </View>
      ))}
    </View>
  );
}

/** Notification prefs: title + 2 rows. */
export function NotificationPrefsSkeleton() {
  return (
    <>
      <Skeleton width={220} height={24} borderRadius={radii.sm} style={styles.prefsTitle} />
      <View style={styles.prefsSection}>
        <View style={styles.prefsRow}>
          <Skeleton width={120} height={18} borderRadius={radii.sm} />
        </View>
        <View style={styles.prefsRow}>
          <Skeleton width={180} height={18} borderRadius={radii.sm} />
        </View>
      </View>
    </>
  );
}


/** Daily loop hub: week header (date row, title, focus, week dots) + 4 segment cards. */
export function DailyLoopSkeleton() {
  return (
    <View>
      <View style={styles.loopHeader}>
        <View style={styles.skeletonRow}>
          <Skeleton width={150} height={16} borderRadius={radii.sm} />
          <Skeleton width={96} height={22} borderRadius={radii.pill} />
        </View>
        <Skeleton width="65%" height={28} borderRadius={radii.sm} style={{ marginTop: spacing.sm }} />
        <Skeleton width="85%" height={14} borderRadius={radii.sm} style={{ marginTop: 6 }} />
        <Skeleton width={140} height={10} borderRadius={radii.pill} style={{ marginTop: spacing.md }} />
      </View>
      <View style={styles.loopSegments}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.loopSegmentCard}>
            <Skeleton width={42} height={42} borderRadius={radii.pill} />
            <View style={{ flex: 1 }}>
              <Skeleton width="45%" height={18} borderRadius={radii.sm} style={{ marginBottom: 6 }} />
              <Skeleton width="75%" height={14} borderRadius={radii.sm} />
            </View>
            <Skeleton width={44} height={44} borderRadius={radii.pill} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Any pillar detail screen: a title, a supporting line, and a handful of rows. */
export function PlanDetailSkeleton() {
  return (
    <View>
      <Skeleton width="60%" height={24} borderRadius={radii.sm} style={{ marginBottom: 8 }} />
      <Skeleton width="90%" height={14} borderRadius={radii.sm} style={{ marginBottom: spacing.lg }} />
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.loopDetailRow}>
          <Skeleton width={34} height={34} borderRadius={radii.pill} />
          <Skeleton width="55%" height={16} borderRadius={radii.sm} style={{ flex: 1 }} />
          <Skeleton width={64} height={30} borderRadius={radii.pill} />
        </View>
      ))}
    </View>
  );
}

/**
 * Progress screen: the hero card and the eight-week grid.
 *
 * Shaped against the real cards rather than generic blocks — same margins, same
 * radii, same ring size, same seven columns — so the swap from skeleton to
 * content moves nothing on screen. `cellWidth` comes from the screen so the
 * placeholder columns land exactly where the real day rings will.
 */
export function ProgressSkeleton({ cellWidth }: { cellWidth: number }) {
  const dot = Math.min(cellWidth - 4, 44);

  return (
    <View>
      <View style={styles.progressHero}>
        <View style={styles.progressHeroTop}>
          <Skeleton width={112} height={112} borderRadius={56} />
          <View style={{ flex: 1 }}>
            <Skeleton width="70%" height={22} borderRadius={radii.sm} style={{ marginBottom: 8 }} />
            <Skeleton width="90%" height={14} borderRadius={radii.sm} />
          </View>
        </View>
        <View style={styles.progressDivider} />
        <View style={styles.progressLegend}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.progressLegendRow}>
              <Skeleton width={16} height={16} borderRadius={radii.sm} />
              <View style={{ flex: 1 }}>
                <Skeleton width="55%" height={11} borderRadius={radii.sm} style={{ marginBottom: 4 }} />
                <Skeleton width="100%" height={6} borderRadius={radii.pill} />
              </View>
              <Skeleton width={32} height={11} borderRadius={radii.sm} />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.progressGrid}>
        <View style={styles.progressWeekdays}>
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <View key={i} style={{ width: cellWidth, alignItems: 'center' }}>
              <Skeleton width={8} height={11} borderRadius={radii.sm} />
            </View>
          ))}
        </View>

        {[1, 2, 3, 4, 5, 6, 7, 8].map((week) => (
          <View key={week} style={styles.progressWeek}>
            <View style={styles.progressWeekHeader}>
              <Skeleton width={54} height={11} borderRadius={radii.sm} />
              <Skeleton width="45%" height={11} borderRadius={radii.sm} style={{ flex: 1 }} />
              <Skeleton width={28} height={11} borderRadius={radii.sm} />
            </View>
            <View style={styles.progressDays}>
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <View key={day} style={{ width: cellWidth, alignItems: 'center' }}>
                  <Skeleton width={dot} height={dot} borderRadius={dot / 2} />
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  progressHero: {
    margin: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  progressHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  progressDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  progressLegend: {
    gap: spacing.sm,
  },
  progressLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  progressGrid: {
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressWeekdays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  progressWeek: {
    marginBottom: spacing.md,
  },
  progressWeekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 6,
  },
  progressDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  listWrap: { flex: 1 },
  listHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  loopHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  loopSegments: {
    paddingHorizontal: spacing.lg,
  },
  loopSegmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget + spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loopDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  listContent: {
    padding: spacing.lg,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  listContentPadding: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  section: { marginBottom: spacing.xl },
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  viewHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  symptomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  prefsTitle: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
  },
  prefsSection: { paddingHorizontal: spacing.lg },
  prefsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
