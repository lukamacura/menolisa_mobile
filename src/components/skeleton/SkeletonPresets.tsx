import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing, radii, minTouchTarget } from '../../theme/tokens';
import { Skeleton } from './Skeleton';

const WAVE_HEIGHT = 60;

/** Dashboard layout: greeting, streak pill, Lisa card, primary button, symptom card, secondary button, wavy, disclaimer, card, recent activity. Same structure/sizes as DashboardScreen. */
export function DashboardSkeleton() {
  return (
    <View style={styles.scrollContent}>
      <View style={styles.heroSection}>
        {/* Greeting */}
        <Skeleton width={140} height={28} borderRadius={radii.sm} style={styles.greetingSkeleton} />
        {/* Streak pill */}
        <Skeleton width={110} height={26} borderRadius={radii.pill} style={styles.streakPillSkeleton} />
        {/* Lisa card: avatar row + bubble */}
        <View style={styles.lisaCardSkeleton}>
          <View style={styles.lisaAvatarRow}>
            <Skeleton width={36} height={36} borderRadius={18} />
            <Skeleton width={32} height={14} borderRadius={radii.sm} />
          </View>
          <Skeleton width="100%" height={72} borderRadius={radii.lg} />
        </View>
        {/* Primary "Talk to Lisa" button */}
        <Skeleton
          width="100%"
          height={minTouchTarget + 8}
          borderRadius={radii.lg}
          style={styles.primaryButtonSkeleton}
        />
        {/* Symptom history card */}
        <View style={styles.recentActivityCard}>
          <Skeleton width={24} height={24} borderRadius={radii.sm} />
          <View style={styles.recentActivityTextWrap}>
            <Skeleton width={120} height={16} style={{ marginBottom: 4 }} />
            <Skeleton width={140} height={14} />
          </View>
        </View>
        {/* Secondary "Log symptom" button */}
        <Skeleton
          width="100%"
          height={minTouchTarget}
          borderRadius={radii.lg}
          style={styles.secondaryButtonSkeleton}
        />
      </View>

      <View style={styles.waveSkeleton} />

      <View style={styles.contentSection}>
        <View style={styles.disclaimerCard}>
          <Skeleton width={20} height={20} borderRadius={radii.sm} />
          <View style={{ flex: 1 }}>
            <Skeleton width="100%" height={12} style={{ marginBottom: 6 }} />
            <Skeleton width="95%" height={12} style={{ marginBottom: 6 }} />
            <Skeleton width="80%" height={12} />
          </View>
        </View>
        <View style={styles.whatLisaCard}>
          <View style={styles.whatLisaHeader}>
            <Skeleton width={160} height={18} />
            <Skeleton width={50} height={20} borderRadius={radii.sm} />
          </View>
          <Skeleton width="100%" height={20} style={{ marginTop: spacing.sm, marginBottom: 6 }} />
          <Skeleton width="90%" height={14} style={{ marginBottom: 6 }} />
          <Skeleton width="85%" height={14} style={{ marginBottom: spacing.md }} />
          <Skeleton width={60} height={14} style={{ marginBottom: 6 }} />
          <Skeleton width="100%" height={14} style={{ marginBottom: 4 }} />
          <Skeleton width="95%" height={14} />
        </View>
      </View>
    </View>
  );
}

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

/** Invite friends: single card with icon, title, subtext, 2 buttons. */
export function InviteFriendsSkeleton() {
  return (
    <View style={styles.inviteCard}>
      <Skeleton width={56} height={56} borderRadius={radii.md} style={{ marginBottom: spacing.md }} />
      <Skeleton width="80%" height={18} style={{ marginBottom: spacing.sm }} />
      <Skeleton width="100%" height={14} style={{ marginBottom: 6 }} />
      <Skeleton width="100%" height={14} style={{ marginBottom: spacing.xl }} />
      <View style={styles.inviteActions}>
        <Skeleton width={100} height={40} borderRadius={radii.md} />
        <Skeleton width={80} height={40} borderRadius={radii.md} />
      </View>
    </View>
  );
}

/** What Lisa Noticed card: header row + content lines. */
export function WhatLisaNoticedCardSkeleton() {
  return (
    <View style={styles.whatLisaCard}>
      <View style={styles.skeletonRow}>
        <Skeleton width={120} height={20} borderRadius={radii.sm} />
        <Skeleton width={70} height={18} borderRadius={radii.sm} />
      </View>
      <Skeleton width="100%" height={24} style={{ marginTop: 12 }} />
      <Skeleton width="90%" height={16} style={{ marginTop: 8 }} />
      <Skeleton width="80%" height={16} style={{ marginTop: 6 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 0 },
  heroSection: {
    backgroundColor: colors.background,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  greetingSkeleton: { marginBottom: spacing.lg },
  streakPillSkeleton: { marginBottom: spacing.lg },
  lisaCardSkeleton: { marginBottom: spacing.xl },
  lisaAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 6,
    marginLeft: 4,
  },
  primaryButtonSkeleton: { marginBottom: spacing.md },
  secondaryButtonSkeleton: { marginBottom: spacing.md },
  waveSkeleton: {
    width: '100%',
    height: WAVE_HEIGHT,
    backgroundColor: colors.primaryLight,
    marginTop: -1,
  },
  contentSection: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    marginTop: -1,
  },
  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  whatLisaCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  whatLisaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentActivityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    marginBottom: spacing.xl,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: minTouchTarget + spacing.lg,
  },
  recentActivityTextWrap: { flex: 1 },
  listWrap: { flex: 1 },
  listHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  inviteCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.orange + '90',
    padding: spacing.xl,
    alignItems: 'center',
  },
  inviteActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
