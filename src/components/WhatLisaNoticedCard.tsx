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
  FadeInDown,
  LinearTransition,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { apiFetchWithAuth, API_CONFIG } from '../lib/api';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../theme/tokens';
import { WhatLisaNoticedCardSkeleton } from './skeleton';

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

const AGE_BAND_LABELS: Record<string, string> = {
  under_40: 'Under 40',
  '40_45': '40–45',
  '46_50': '46–50',
  '51_plus': '51+',
  prefer_not: 'Prefer not to say',
};

export type WhatLisaNoticedCardProps = {
  /** First name or preferred short name from profile */
  displayName?: string | null;
  /** Raw `user_profiles.age_band` quiz id */
  ageBandId?: string | null;
  /**
   * Consecutive **daily mood check-in** streak (from `/api/daily-mood` → `current_streak`):
   * one log per calendar day keeps the count going; it is not based on symptom logs alone.
   */
  streakDays?: number | null;
  reduceMotion?: boolean;
};

function getTrendStyle(trend: string): { bg: string; text: string } {
  switch (trend) {
    case 'improving':
      return { bg: colors.successBg, text: colors.success };
    case 'worsening':
      return { bg: colors.warningBg, text: colors.warning };
    default:
      return { bg: colors.plumSoft, text: colors.textMuted };
  }
}

function trendDisplayLabel(trend: Insight['trend']): string {
  switch (trend) {
    case 'improving':
      return 'Improving';
    case 'worsening':
      return 'Needs attention';
    default:
      return 'Stable';
  }
}

type TimelineTone = 'easy' | 'medium' | 'advanced';

type TimelineStepDef = { key: string; label: string; body: string; tone: TimelineTone };

const TIMELINE_STEP_THEME: Record<
  TimelineTone,
  { nodeBorder: string; cardBg: string; cardBorder: string; labelColor: string }
> = {
  easy: {
    nodeBorder: colors.success,
    cardBg: colors.successBg,
    cardBorder: 'rgba(34, 160, 107, 0.35)',
    labelColor: colors.success,
  },
  medium: {
    nodeBorder: colors.warning,
    cardBg: colors.warningBg,
    cardBorder: 'rgba(217, 138, 31, 0.4)',
    labelColor: colors.warning,
  },
  advanced: {
    nodeBorder: colors.primary,
    cardBg: 'rgba(244, 124, 151, 0.18)',
    cardBorder: 'rgba(244, 124, 151, 0.45)',
    labelColor: colors.primaryDark,
  },
};

function ActionStepsTimeline({
  steps,
  reduceMotion,
}: {
  steps: TimelineStepDef[];
  reduceMotion: boolean;
}) {
  return (
    <View style={styles.timelineContainer}>
      <LinearGradient
        colors={[colors.success, colors.warning, colors.danger]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.timelineSpine}
        pointerEvents="none"
      />
      {steps.map((step, index) => {
        const theme = TIMELINE_STEP_THEME[step.tone];
        const entering = reduceMotion
          ? undefined
          : FadeInDown.duration(440)
              .delay(60 + index * 100)
              .easing(Easing.out(Easing.cubic));
        return (
          <Animated.View
            key={step.key}
            entering={entering}
            layout={reduceMotion ? undefined : LinearTransition.springify().damping(22).stiffness(200)}
            style={styles.timelineRow}
          >
            <View style={styles.timelineRail} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={styles.timelineRailFlex} />
              <View
                style={[
                  styles.timelineNode,
                  { borderColor: theme.nodeBorder, backgroundColor: colors.card },
                ]}
              />
              <View style={styles.timelineRailFlex} />
            </View>
            <View
              style={[
                styles.timelineCard,
                { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
              ]}
            >
              <Text style={[styles.timelineLabel, { color: theme.labelColor }]}>{step.label}</Text>
              <Text style={styles.timelineBody}>{step.body}</Text>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

export function WhatLisaNoticedCard({
  displayName,
  ageBandId,
  streakDays,
  reduceMotion = false,
}: WhatLisaNoticedCardProps) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [whyExpanded, setWhyExpanded] = useState(false);
  const refreshRotation = useSharedValue(0);

  const ageLine =
    ageBandId && AGE_BAND_LABELS[ageBandId] ? AGE_BAND_LABELS[ageBandId] : null;
  const profileName = displayName?.trim() || 'You';

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
          patternHeadline:
            raw.split('\n')[0] ||
            "Lisa didn't have enough data yet to notice something specific.",
          why:
            raw.substring(0, 200) ||
            'Keep logging your symptoms and mood so Lisa can share what she notices.',
          whatsWorking: null,
          actionSteps: {
            easy: 'Keep tracking so Lisa can spot what helps.',
            medium: 'Try one small change this week and see if it helps.',
            advanced: 'Build a consistent routine that supports your body.',
          },
          doctorNote:
            'Symptom and mood tracking in progress. Can review with healthcare provider when ready.',
          trend: 'stable',
          whyThisMatters:
            'When Lisa has a bit more data, she can point out things that might be useful to you and your healthcare team.',
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
    const trendLabel =
      insight.trend === 'improving'
        ? 'Improving'
        : insight.trend === 'worsening'
          ? 'Needs attention'
          : 'Stable';
    const date = insight.generatedAt
      ? new Date(insight.generatedAt).toLocaleDateString()
      : new Date().toLocaleDateString();
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
      lines.push('', "─── WHAT'S WORKING ────────────────", insight.whatsWorking);
    }
    lines.push(
      '',
      '─── WHAT YOU CAN TRY ──────────────',
      `Start here:         ${insight.actionSteps.easy}`,
      `A bit more energy:  ${insight.actionSteps.medium}`,
      `Go deeper:          ${insight.actionSteps.advanced}`,
    );
    lines.push('', '─── FOR YOUR NEXT APPOINTMENT ─────', insight.doctorNote);
    if (insight.whyThisMatters) {
      lines.push('', '─── WHY THIS MATTERS ──────────────', insight.whyThisMatters);
    }
    if (insight.dataPoints) {
      const { daysWindow, symptomLogs, chatSessions } = insight.dataPoints;
      lines.push(
        '',
        '─── DATA SOURCES ──────────────────',
        `Based on ${daysWindow} days · ${symptomLogs} symptom logs · ${chatSessions} chats`,
      );
    }
    lines.push(
      '',
      '═══════════════════════════════════',
      '  menolisa.com',
      '═══════════════════════════════════',
    );
    try {
      await Share.share({ message: lines.join('\n'), title: 'Menolisa Health Report' });
    } catch (_) {}
  }, [insight]);

  if (loading && !refreshing) {
    return <WhatLisaNoticedCardSkeleton />;
  }

  if (error && !insight) {
    return (
      <View style={styles.root}>
        <View style={styles.sectionEyebrowWrap} accessibilityRole="header">
          <Text style={styles.sectionEyebrowText}>What Lisa noticed</Text>
        </View>
        <View style={styles.errorTile}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  if (!insight) {
    return (
      <View style={styles.root}>
        <View style={styles.sectionEyebrowWrap} accessibilityRole="header">
          <Text style={styles.sectionEyebrowText}>What Lisa noticed</Text>
        </View>
        <View style={styles.emptyTile}>
          <Text style={styles.mutedText}>
            Keep logging symptoms and Lisa will share what she noticed.
          </Text>
        </View>
      </View>
    );
  }

  const trendStyle = getTrendStyle(insight.trend);
  const { dataPoints } = insight;
  const hasMoodStreak = streakDays != null && streakDays > 0;
  const streakValue = hasMoodStreak ? String(streakDays) : '0';

  return (
    <View style={styles.root}>
      <View style={styles.sectionEyebrowWrap} accessibilityRole="header">
        <Text style={styles.sectionEyebrowText}>What Lisa noticed</Text>
      </View>

      {/* Bento row: profile + streak (icon left, primary + secondary text — aligned column, vertically centered) */}
      <View style={styles.bentoRow}>
        <View style={styles.bentoTile} accessibilityRole="summary">
          <View style={styles.bentoTileContent}>
            <View style={styles.bentoIconWrap}>
              <View style={styles.bentoIconDisc}>
                <Ionicons name="person" size={18} color={colors.primary} />
              </View>
            </View>
            <View style={styles.bentoBody}>
              <Text style={styles.profileName} numberOfLines={1}>
                {profileName}
              </Text>
              <Text style={styles.profileMeta} numberOfLines={1}>
                {ageLine ?? 'Your space'}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={styles.bentoTile}
          accessibilityRole="text"
          accessibilityLabel={
            hasMoodStreak
              ? `Mood check-in streak, ${streakDays} days in a row`
              : 'Mood check-in streak, log your mood today to start'
          }
        >
          <View style={styles.bentoTileContent}>
            <View style={styles.bentoIconWrap}>
              {hasMoodStreak ? (
                reduceMotion ? (
                  <View style={styles.bentoIconDisc}>
                    <Ionicons name="flame" size={18} color={colors.primary} />
                  </View>
                ) : (
                  <LottieView
                    source={require('../../assets/Fire.json')}
                    autoPlay
                    loop
                    style={styles.bentoLottie}
                    resizeMode="contain"
                  />
                )
              ) : (
                <View style={styles.bentoIconDisc}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
                </View>
              )}
            </View>
            <View style={styles.bentoBody}>
              <Text style={[styles.streakNumber, !hasMoodStreak && styles.streakNumberMuted]}>
                {streakValue}
              </Text>
              <Text style={styles.streakCaption}>
                {hasMoodStreak ? 'Day streak' : 'Log mood daily'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Hero insight (accent tile) */}
      <View style={styles.heroTile}>
        <View style={styles.heroTopRow}>
          <View style={[styles.trendBadge, { backgroundColor: trendStyle.bg }]}>
            <Text style={[styles.trendText, { color: trendStyle.text }]}>
              {trendDisplayLabel(insight.trend)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => fetchInsight(true)}
            disabled={refreshing}
            style={styles.refreshBtn}
            accessibilityLabel="Refresh what Lisa noticed"
            activeOpacity={0.6}
          >
            <Animated.View style={refreshIconAnimatedStyle}>
              <Ionicons name="refresh" size={22} color={colors.textInverse} />
            </Animated.View>
          </TouchableOpacity>
        </View>
        <Text style={styles.heroKicker}>Lisa noticed</Text>
        <Text style={styles.heroHeadline}>{insight.patternHeadline}</Text>
        {dataPoints ? (
          <Text style={styles.heroMeta} numberOfLines={1}>
            Last {dataPoints.daysWindow} days · {dataPoints.symptomLogs} logs
            {dataPoints.chatSessions > 0
              ? ` · ${dataPoints.chatSessions} chats`
              : ''}
          </Text>
        ) : null}
      </View>

      {/* Short “why” on the surface */}
      <View style={styles.whySurface}>
        <Text style={styles.whySurfaceText} numberOfLines={whyExpanded ? undefined : 2}>
          {insight.why}
        </Text>
        <TouchableOpacity
          onPress={() => setWhyExpanded(!whyExpanded)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={whyExpanded ? 'Show less' : 'Read more'}
          style={styles.textLinkWrap}
        >
          <Text style={styles.textLink}>{whyExpanded ? 'Show less' : 'Read more'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.detailsBlock}>
        {insight.whatsWorking ? (
          <View style={styles.whatsWorkingBox}>
            <Text style={styles.whatsWorkingText}>✨ {insight.whatsWorking}</Text>
          </View>
        ) : null}

        <View style={styles.sectionEyebrowWrap} accessibilityRole="header">
          <Text style={styles.sectionEyebrowText}>What you can try</Text>
        </View>
        <ActionStepsTimeline
          reduceMotion={reduceMotion}
          steps={[
            { key: 'easy', tone: 'easy', label: 'Start here', body: insight.actionSteps.easy },
            { key: 'medium', tone: 'medium', label: 'A bit more energy', body: insight.actionSteps.medium },
            { key: 'advanced', tone: 'advanced', label: 'Go deeper', body: insight.actionSteps.advanced },
          ]}
        />

        <View style={styles.doctorBox}>
          <Text style={styles.doctorLabel}>For your next appointment</Text>
          <Text style={styles.doctorNote}>{insight.doctorNote}</Text>
        </View>

        {insight.whyThisMatters ? (
          <View style={styles.whyMattersBlock}>
            <Text style={styles.whyMattersLabel}>Why this matters</Text>
            <Text style={styles.whyMattersText}>{insight.whyThisMatters}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={onGetFullReport}
          style={styles.getFullReportBtn}
          accessibilityRole="button"
          accessibilityLabel="Get full report"
          activeOpacity={0.85}
        >
          <View style={styles.getFullReportBtnContent}>
            <Ionicons
              name="document-text-outline"
              size={22}
              color={colors.textInverse}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            <Text style={styles.getFullReportBtnText}>Get full report</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginBottom: spacing.xl,
  },
  sectionEyebrowWrap: {
    alignSelf: 'flex-start',
    backgroundColor: colors.dangerBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    marginBottom: spacing.sm,
  },
  sectionEyebrowText: {
    ...typography.presets.caption,
    fontFamily: typography.family.semibold,
    color: colors.danger,
  },

  bentoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  bentoTile: {
    flex: 1,
    minHeight: 74,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    ...shadows.card,
  },
  bentoTileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  /** Fixed square so both tiles share the same icon column width and optical alignment */
  bentoIconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoLottie: {
    width: 28,
    height: 28,
  },
  bentoIconDisc: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  profileName: {
    ...typography.presets.bodyMedium,
    fontFamily: typography.family.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  profileMeta: {
    ...typography.presets.caption,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textMuted,
    marginTop: 1,
  },
  streakNumber: {
    fontFamily: typography.display.bold,
    fontSize: 19,
    lineHeight: 24,
    color: colors.text,
  },
  streakNumberMuted: {
    color: colors.textMuted,
  },
  streakCaption: {
    ...typography.presets.caption,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textMuted,
    marginTop: 1,
  },

  heroTile: {
    backgroundColor: colors.navy,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  heroKicker: {
    ...typography.presets.caption,
    color: colors.textInverse,
    opacity: 0.85,
    marginBottom: 4,
  },
  heroHeadline: {
    fontFamily: typography.display.semibold,
    fontSize: 20,
    lineHeight: 28,
    color: colors.textInverse,
  },
  heroMeta: {
    ...typography.presets.caption,
    color: colors.textInverse,
    opacity: 0.75,
    marginTop: spacing.sm,
  },
  trendBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  trendText: {
    ...typography.presets.caption,
    fontFamily: typography.family.semibold,
  },
  refreshBtn: {
    padding: spacing.xs,
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },

  whySurface: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  whySurfaceText: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
  },
  textLinkWrap: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  textLink: {
    ...typography.presets.caption,
    fontFamily: typography.family.medium,
    color: colors.primary,
  },

  detailsBlock: {
    marginTop: spacing.sm,
    paddingBottom: spacing.sm,
  },

  whatsWorkingBox: {
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: 'rgba(34, 160, 107, 0.35)',
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  whatsWorkingText: {
    ...typography.presets.bodySmall,
    fontFamily: typography.family.medium,
    color: colors.success,
  },

  timelineContainer: {
    marginTop: spacing.xs,
    position: 'relative',
  },
  /** Continuous vertical line (green → amber → red) behind hollow nodes */
  timelineSpine: {
    position: 'absolute',
    left: 13,
    width: 3,
    top: 8,
    bottom: 8,
    borderRadius: 2,
    zIndex: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    zIndex: 1,
  },
  timelineRail: {
    width: 28,
    marginRight: spacing.md,
    alignItems: 'center',
  },
  timelineRailFlex: {
    flex: 1,
    minHeight: 4,
    width: 2,
  },
  timelineNode: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  timelineCard: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  timelineLabel: {
    ...typography.presets.caption,
    fontFamily: typography.family.semibold,
    marginBottom: 4,
  },
  timelineBody: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
  },

  doctorBox: {
    backgroundColor: colors.infoBg,
    borderWidth: 1,
    borderColor: 'rgba(75, 141, 248, 0.35)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  doctorLabel: {
    ...typography.presets.caption,
    fontFamily: typography.family.semibold,
    color: colors.navy,
    marginBottom: 4,
  },
  doctorNote: {
    ...typography.presets.bodySmall,
    color: colors.navy,
  },

  whyMattersBlock: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  whyMattersLabel: {
    ...typography.presets.label,
    color: colors.text,
    marginBottom: 4,
  },
  whyMattersText: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
  },

  getFullReportBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: minTouchTarget + spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['2xl'],
    borderRadius: radii.xl,
    backgroundColor: colors.navy,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    ...shadows.card,
  },
  getFullReportBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  getFullReportBtnText: {
    ...typography.presets.button,
    fontFamily: typography.display.bold,
    color: colors.textInverse,
    letterSpacing: 0.25,
  },

  errorTile: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  emptyTile: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  errorText: {
    ...typography.presets.bodySmall,
    color: colors.danger,
  },
  mutedText: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
  },
});
