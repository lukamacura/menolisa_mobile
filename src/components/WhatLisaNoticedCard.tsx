import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Image,
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
import { WhatLisaNoticedCardSkeleton } from './skeleton';

const bannerSource = require('../../assets/lisa-noticed-banner.png');

type ActionSteps = { easy: string; medium: string; advanced: string };

type Insight = {
  patternHeadline: string;
  why: string;
  whatsWorking?: string | null;
  actionSteps: ActionSteps;
  doctorNote: string;
  trend: 'improving' | 'worsening' | 'stable';
  whyThisMatters?: string;
  generatedAt?: string;
  dataPoints?: {
    symptomLogs: number;
    chatSessions: number;
    daysWindow: number;
  };
};

function getTrendStyle(trend: string): { bg: string; text: string } {
  switch (trend) {
    case 'improving':
      return { bg: '#E1F7F1', text: '#047857' };
    case 'worsening':
      return { bg: '#FEF3C7', text: '#B45309' };
    default:
      return { bg: '#F0F0F2', text: '#4B5563' };
  }
}

export function WhatLisaNoticedCard() {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [whyExpanded, setWhyExpanded] = useState(false);
  const [whyMattersExpanded, setWhyMattersExpanded] = useState(false);
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
          why: raw.substring(0, 200) || 'Keep logging your symptoms and mood so Lisa can share what she notices.',
          whatsWorking: null,
          actionSteps: {
            easy: 'Keep tracking so Lisa can spot what helps.',
            medium: 'Try one small change this week and see if it helps.',
            advanced: 'Build a consistent routine that supports your body.',
          },
          doctorNote: 'Symptom and mood tracking in progress. Can review with healthcare provider when ready.',
          trend: 'stable',
          whyThisMatters: 'When Lisa has a bit more data, she can point out things that might be useful to you and your healthcare team.',
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

  const onGetFullReport = useCallback(async () => {
    if (!insight) return;
    const trendLabel = insight.trend === 'improving' ? 'Improving' : insight.trend === 'worsening' ? 'Needs attention' : 'Stable';
    const date = insight.generatedAt ? new Date(insight.generatedAt).toLocaleDateString() : new Date().toLocaleDateString();
    const lines: string[] = [
      '═══════════════════════════════════',
      '  MENOLISA — YOUR HEALTH REPORT',
      `  Generated: ${date}`,
      '═══════════════════════════════════',
      '',
      `TREND: ${trendLabel.toUpperCase()}`,
      '',
      '─── WHAT LISA NOTICED ─────────────',
      insight.patternHeadline,
      '',
      insight.why,
    ];
    if (insight.whatsWorking) {
      lines.push('', '─── WHAT\'S WORKING ────────────────', insight.whatsWorking);
    }
    lines.push(
      '',
      '─── WHAT YOU CAN TRY ──────────────',
      `Start here:         ${insight.actionSteps.easy}`,
      `A bit more energy:  ${insight.actionSteps.medium}`,
      `Go deeper:          ${insight.actionSteps.advanced}`,
    );
    lines.push(
      '',
      '─── FOR YOUR NEXT APPOINTMENT ─────',
      insight.doctorNote,
    );
    if (insight.whyThisMatters) {
      lines.push('', '─── WHY THIS MATTERS ──────────────', insight.whyThisMatters);
    }
    if (insight.dataPoints) {
      const { daysWindow, symptomLogs, chatSessions } = insight.dataPoints;
      lines.push('', '─── DATA SOURCES ──────────────────', `Based on ${daysWindow} days · ${symptomLogs} symptom logs · ${chatSessions} chats`);
    }
    lines.push('', '═══════════════════════════════════', '  menolisa.com', '═══════════════════════════════════');
    try {
      await Share.share({ message: lines.join('\n'), title: 'Menolisa Health Report' });
    } catch (_) {}
  }, [insight]);

  if (loading && !refreshing) {
    return <WhatLisaNoticedCardSkeleton />;
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
  const { dataPoints } = insight;

  return (
    <View style={styles.card}>
      {/* ── Banner illustration (full-width, no padding) ── */}
      <Image
        source={bannerSource}
        style={styles.bannerImage}
        resizeMode="cover"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />

      <View style={styles.cardInner}>
      {/* ── Header row: title + trend badge + refresh ── */}
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
        {/* ── 1. Headline ── */}
        <Text style={styles.headline}>{insight.patternHeadline}</Text>

        {/* ── 2. Why ── */}
        <View style={styles.whyContainer}>
          <Text
            style={styles.why}
            numberOfLines={whyExpanded ? undefined : 2}
          >
            {insight.why}
          </Text>
          <TouchableOpacity
            onPress={() => setWhyExpanded(!whyExpanded)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={whyExpanded ? 'Show less of why' : 'Read more of why'}
            style={styles.whyReadMoreBtn}
          >
            <Text style={styles.whyReadMoreText}>
              {whyExpanded ? 'Show less' : 'Read more'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── 3. What's working ── */}
        {insight.whatsWorking ? (
          <View style={styles.whatsWorkingBox}>
            <Text style={styles.whatsWorkingText}>✨ {insight.whatsWorking}</Text>
          </View>
        ) : null}

        {/* ── 4. Freshness bar ── */}
        {dataPoints ? (
          <View style={styles.freshnessContainer}>
            <Text style={styles.freshnessText}>
              {'Based on '}
              <Text style={styles.freshnessEmphasis}>{dataPoints.daysWindow} days</Text>
              {'  ·  '}
              <Text style={styles.freshnessEmphasis}>{dataPoints.symptomLogs} logs</Text>
              {'  ·  '}
              <Text style={styles.freshnessEmphasis}>{dataPoints.chatSessions} chats</Text>
            </Text>
            <View style={styles.freshnessDivider} />
          </View>
        ) : null}

        {/* ── 5. Action steps ── */}
        <Text style={styles.sectionLabel}>What you can try</Text>

        <View style={styles.stepRow}>
          <View style={[styles.stepBadge, styles.stepBadgeEasy]}>
            <Text style={[styles.stepBadgeText, styles.stepBadgeTextEasy]}>Start here</Text>
          </View>
          <Text style={styles.stepText}>{insight.actionSteps.easy}</Text>
        </View>

        <View style={styles.stepRow}>
          <View style={[styles.stepBadge, styles.stepBadgeMedium]}>
            <Text style={[styles.stepBadgeText, styles.stepBadgeTextMedium]}>A bit more energy</Text>
          </View>
          <Text style={styles.stepText}>{insight.actionSteps.medium}</Text>
        </View>

        <View style={styles.stepRow}>
          <View style={[styles.stepBadge, styles.stepBadgeAdvanced]}>
            <Text style={[styles.stepBadgeText, styles.stepBadgeTextAdvanced]}>Go deeper</Text>
          </View>
          <Text style={styles.stepText}>{insight.actionSteps.advanced}</Text>
        </View>

        {/* ── 6. For your next appointment ── */}
        <View style={styles.doctorBox}>
          <Text style={styles.doctorLabel}>For your next appointment</Text>
          <Text style={styles.doctorNote}>{insight.doctorNote}</Text>
        </View>

        {/* ── 7. Get full report ── */}
        <TouchableOpacity
          onPress={onGetFullReport}
          style={styles.getFullReportBtn}
          accessibilityLabel="Get full report"
          activeOpacity={0.7}
        >
          <Ionicons name="document-text-outline" size={20} color={colors.primary} />
          <Text style={styles.getFullReportBtnText}>Get full report</Text>
        </TouchableOpacity>

        {/* ── 8. Why this matters (expandable) ── */}
        {insight.whyThisMatters ? (
          <TouchableOpacity
            onPress={() => setWhyMattersExpanded(!whyMattersExpanded)}
            style={styles.whyMattersToggle}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={whyMattersExpanded ? 'Collapse why this matters' : 'Expand why this matters'}
            accessibilityState={{ expanded: whyMattersExpanded }}
          >
            <Ionicons
              name={whyMattersExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.text}
            />
            <Text style={styles.whyMattersLabel}>Why this matters</Text>
          </TouchableOpacity>
        ) : null}
        {insight.whyThisMatters && whyMattersExpanded ? (
          <Text style={styles.whyMattersText}>{insight.whyThisMatters}</Text>
        ) : null}
      </View>
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
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  cardInner: {
    padding: spacing.lg,
  },

  // Banner illustration
  bannerImage: {
    width: '100%',
    height: 110,
  },

  // Header
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
    fontFamily: typography.display.semibold,
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

  // Content wrapper
  content: {
    flexGrow: 0,
  },

  // 1. Headline
  headline: {
    fontSize: 17,
    fontFamily: typography.family.bold,
    color: colors.text,
    marginBottom: spacing.sm,
    lineHeight: 24,
  },

  // 2. Why
  whyContainer: {
    marginBottom: spacing.md,
  },
  why: {
    fontSize: 15,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    lineHeight: 22,
  },
  whyReadMoreBtn: {
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  whyReadMoreText: {
    ...typography.presets.caption,
    color: colors.primary,
  },

  // 3. What's working — opaque equivalent of rgba(16,185,129,0.08)
  whatsWorkingBox: {
    backgroundColor: '#EDF9F4',
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

  // 4. Freshness bar
  freshnessContainer: {
    marginBottom: spacing.md,
  },
  freshnessText: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },
  freshnessEmphasis: {
    fontFamily: typography.family.medium,
    color: colors.textMuted,
  },
  freshnessDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
  },

  // 5. Action steps
  sectionLabel: {
    fontSize: 13,
    fontFamily: typography.family.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  stepRow: {
    flexDirection: 'column',
    gap: 4,
    marginBottom: spacing.md,
  },
  stepBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    alignSelf: 'flex-start',
  },
  stepBadgeText: {
    fontSize: 11,
    fontFamily: typography.family.semibold,
  },
  // Easy — "Start here"
  stepBadgeEasy: {
    backgroundColor: '#E1F7F1',
  },
  stepBadgeTextEasy: {
    color: '#047857',
  },
  // Medium — "A bit more energy"
  stepBadgeMedium: {
    backgroundColor: '#FEF3C7',
  },
  stepBadgeTextMedium: {
    color: '#B45309',
  },
  // Advanced — "Go deeper"
  stepBadgeAdvanced: {
    backgroundColor: '#FDEAEE',
  },
  stepBadgeTextAdvanced: {
    color: colors.primaryDark,
  },
  stepText: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    lineHeight: 20,
  },

  // 6. For your next appointment — opaque equivalents of rgba blues
  doctorBox: {
    backgroundColor: '#EEF4FD',
    borderWidth: 1,
    borderColor: '#BDD1F5',
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  doctorLabel: {
    fontSize: 12,
    fontFamily: typography.family.semibold,
    color: colors.navy,
    marginBottom: 4,
  },
  doctorNote: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: '#1E3A8A',
    lineHeight: 20,
  },
  // 7. Get full report
  getFullReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  getFullReportBtnText: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.primary,
  },

  // 8. Why this matters
  whyMattersToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
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

  // States
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
