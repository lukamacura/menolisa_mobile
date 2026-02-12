import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { apiFetchWithAuth, API_CONFIG } from '../lib/api';
import { colors, spacing, radii, typography, minTouchTarget } from '../theme/tokens';

type ActionSteps = { easy: string; medium: string; advanced: string };

type Insight = {
  patternHeadline: string;
  why: string;
  whatsWorking?: string | null;
  actionSteps: ActionSteps;
  doctorNote: string;
  trend: 'improving' | 'worsening' | 'stable';
  whyThisMatters?: string;
};

function getTrendStyle(trend: string): { bg: string; text: string } {
  switch (trend) {
    case 'improving':
      return { bg: 'rgba(16, 185, 129, 0.15)', text: '#047857' };
    case 'worsening':
      return { bg: 'rgba(245, 158, 11, 0.2)', text: '#B45309' };
    default:
      return { bg: 'rgba(107, 114, 128, 0.15)', text: '#4B5563' };
  }
}

export function WhatLisaNoticedCard() {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [whyExpanded, setWhyExpanded] = useState(false);
  const refreshRotation = useSharedValue(0);

  useEffect(() => {
    if (refreshing) {
      refreshRotation.value = withRepeat(
        withSequence(
          withTiming(360, { duration: 800, easing: Easing.linear }),
          withTiming(0, { duration: 0 })
        ),
        -1
      );
    } else {
      refreshRotation.value = withTiming(0, { duration: 200 });
    }
  }, [refreshing, refreshRotation]);

  const refreshIconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${refreshRotation.value}deg` }],
  }));

  const fetchInsight = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const url = refresh
        ? `${API_CONFIG.endpoints.insights}?refresh=true`
        : API_CONFIG.endpoints.insights;
      const res = await apiFetchWithAuth(url);
      const raw = res?.insight;
      if (typeof raw === 'string') {
        setInsight({
          patternHeadline: raw.split('\n')[0] || "Lisa didn't have enough data yet to notice something specific.",
          why: raw.substring(0, 200) || "Keep logging your symptoms and mood so Lisa can share what she notices.",
          whatsWorking: null,
          actionSteps: {
            easy: 'Keep tracking so Lisa can spot what helps.',
            medium: 'Try one small change this week and see if it helps.',
            advanced: 'Build a consistent routine that supports your body.',
          },
          doctorNote: 'Symptom and mood tracking in progress. Can review with healthcare provider when ready.',
          trend: 'stable',
          whyThisMatters: "When Lisa has a bit more data, she can point out things that might be useful to you and your healthcare team.",
        });
      } else if (raw && typeof raw === 'object' && raw.patternHeadline) {
        setInsight(raw as Insight);
      } else {
        setInsight(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load insight');
      setInsight(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInsight();
  }, [fetchInsight]);

  const onShareDoctorNote = useCallback(async () => {
    if (!insight?.doctorNote) return;
    try {
      await Share.share({
        message: `For your healthcare provider:\n\n${insight.doctorNote}`,
        title: 'Symptom summary',
      });
    } catch (_) {}
  }, [insight?.doctorNote]);

  if (loading && !refreshing) {
    return (
      <View style={styles.card}>
        <View style={styles.skeletonRow}>
          <View style={[styles.skeleton, { width: 120, height: 20 }]} />
          <View style={[styles.skeleton, { width: 70, height: 18 }]} />
        </View>
        <View style={[styles.skeleton, { width: '100%', height: 24, marginTop: 12 }]} />
        <View style={[styles.skeleton, { width: '90%', height: 16, marginTop: 8 }]} />
        <View style={[styles.skeleton, { width: '80%', height: 16, marginTop: 6 }]} />
      </View>
    );
  }

  if (error && !insight) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>What Lisa noticed</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!insight) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>What Lisa noticed</Text>
        <Text style={styles.mutedText}>Keep logging symptoms and Lisa will share what she noticed.</Text>
      </View>
    );
  }

  const trendStyle = getTrendStyle(insight.trend);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.cardTitle}>What Lisa noticed</Text>
          <View style={[styles.trendBadge, { backgroundColor: trendStyle.bg }]}>
            <Text style={[styles.trendText, { color: trendStyle.text }]}>
              {insight.trend}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => fetchInsight(true)}
          disabled={refreshing}
          style={styles.refreshBtn}
          accessibilityLabel="Refresh what Lisa noticed"
          activeOpacity={0.6}
        >
          <Animated.View style={refreshIconAnimatedStyle}>
            <Ionicons
              name="refresh"
              size={22}
              color={refreshing ? colors.textMuted : colors.primary}
            />
          </Animated.View>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.headline}>{insight.patternHeadline}</Text>
        <Text style={styles.why}>{insight.why}</Text>

        {insight.whatsWorking ? (
          <View style={styles.whatsWorkingBox}>
            <Text style={styles.whatsWorkingText}>✨ {insight.whatsWorking}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>What you can try</Text>
        <View style={styles.stepRow}>
          <View style={[styles.stepBadge, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
            <Text style={styles.stepBadgeText}>Easy</Text>
          </View>
          <Text style={styles.stepText}>{insight.actionSteps.easy}</Text>
        </View>
        <View style={styles.stepRow}>
          <View style={[styles.stepBadge, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
            <Text style={[styles.stepBadgeText, { color: '#B45309' }]}>Medium</Text>
          </View>
          <Text style={styles.stepText}>{insight.actionSteps.medium}</Text>
        </View>
        <View style={styles.stepRow}>
          <View style={[styles.stepBadge, { backgroundColor: 'rgba(255, 141, 161, 0.2)' }]}>
            <Text style={[styles.stepBadgeText, { color: colors.primaryDark }]}>Advanced</Text>
          </View>
          <Text style={styles.stepText}>{insight.actionSteps.advanced}</Text>
        </View>

        <View style={styles.doctorBox}>
          <Text style={styles.doctorLabel}>For your healthcare provider</Text>
          <Text style={styles.doctorNote}>{insight.doctorNote}</Text>
          <TouchableOpacity
            onPress={onShareDoctorNote}
            style={styles.shareBtn}
            accessibilityLabel="Share doctor note"
          >
            <Ionicons name="share-outline" size={20} color={colors.primary} />
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>

        {insight.whyThisMatters ? (
          <TouchableOpacity
            onPress={() => setWhyExpanded(!whyExpanded)}
            style={styles.whyMattersToggle}
            activeOpacity={0.7}
          >
            <Ionicons
              name={whyExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.text}
            />
            <Text style={styles.whyMattersLabel}>Why this matters</Text>
          </TouchableOpacity>
        ) : null}
        {insight.whyThisMatters && whyExpanded ? (
          <Text style={styles.whyMattersText}>{insight.whyThisMatters}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  skeleton: {
    backgroundColor: colors.border,
    borderRadius: radii.sm,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: typography.family.semibold,
    color: colors.text,
  },
  trendBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  trendText: {
    fontSize: 12,
    fontFamily: typography.family.semibold,
  },
  refreshBtn: {
    padding: spacing.xs,
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexGrow: 0,
  },
  headline: {
    fontSize: 17,
    fontFamily: typography.family.bold,
    color: colors.text,
    marginBottom: spacing.sm,
    lineHeight: 24,
  },
  why: {
    fontSize: 15,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  whatsWorkingBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  whatsWorkingText: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: '#047857',
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: typography.family.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  stepBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    minWidth: 52,
    alignItems: 'center',
  },
  stepBadgeText: {
    fontSize: 11,
    fontFamily: typography.family.semibold,
    color: '#047857',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    lineHeight: 20,
  },
  doctorBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  doctorLabel: {
    fontSize: 12,
    fontFamily: typography.family.semibold,
    color: '#1D4ED8',
    marginBottom: 4,
  },
  doctorNote: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: '#1E3A8A',
    lineHeight: 20,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: 6,
  },
  shareBtnText: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.primary,
  },
  whyMattersToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  whyMattersLabel: {
    fontSize: 14,
    fontFamily: typography.family.semibold,
    color: colors.text,
  },
  whyMattersText: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: 4,
    paddingLeft: 26,
  },
  errorText: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.danger,
  },
  mutedText: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
  },
});
