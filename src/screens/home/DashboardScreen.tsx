import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetchWithAuth, API_CONFIG, openWebDashboard } from '../../lib/api';
import { RefetchTrialContext } from '../../context/RefetchTrialContext';
import { useTrialStatus } from '../../hooks/useTrialStatus';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../../theme/tokens';
import { WhatLisaNoticedCard } from '../../components/WhatLisaNoticedCard';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';
import { DashboardSkeleton, ContentTransition } from '../../components/skeleton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WAVE_HEIGHT = 60;

function WavyDivider() {
  return (
    <View style={wavyStyles.wrap}>
      <Svg
        width="100%"
        height={WAVE_HEIGHT}
        viewBox="0 0 100 60"
        preserveAspectRatio="none"
      >
        {/* Deep shadow - darkest pink */}
        <Path
          d="M0,0 L100,0 Q50,120 0,0 Z"
          fill="#ffd2da"
          fillOpacity={0.6}
        />
        {/* Mid shadow - medium pink */}
        <Path
          d="M0,0 L100,0 Q50,90 0,0 Z"
          fill="#ffe9ec"
          fillOpacity={0.5}
        />
        {/* Main white curve */}
        <Path
          d="M0,0 L100,0 Q50,60 0,0 Z"
          fill="#FFFFFF"
        />
      </Svg>
    </View>
  );
}

const wavyStyles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: WAVE_HEIGHT,
    backgroundColor: colors.primaryLight,
    marginTop: -1,
  },
});

type HomeStackParamList = {
  Dashboard: undefined;
  Symptoms: undefined;
  SymptomLogs: undefined;
};
type NavProp = NativeStackNavigationProp<HomeStackParamList, 'Dashboard'>;

export function DashboardScreen() {
  const navigation = useNavigation<NavProp>();
  const refetchTrialRef = useContext(RefetchTrialContext);
  const trialStatus = useTrialStatus();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [todaySymptomCount, setTodaySymptomCount] = useState<number | null>(null);
  const reduceMotion = useReduceMotion();

  // Register refetch so trial status refreshes when user returns from web dashboard
  useEffect(() => {
    if (refetchTrialRef) refetchTrialRef.current = trialStatus.refetch;
    return () => {
      if (refetchTrialRef) refetchTrialRef.current = null;
    };
  }, [refetchTrialRef, trialStatus.refetch]);

  // Refetch trial when screen gains focus (e.g. return from browser)
  useFocusEffect(
    useCallback(() => {
      trialStatus.refetch().catch(() => {});
    }, [trialStatus.refetch])
  );

  const handleOpenDashboard = useCallback(async () => {
    try {
      await openWebDashboard();
    } catch (e) {
      Alert.alert(
        'Open dashboard',
        e instanceof Error ? e.message : 'Could not open the web dashboard. Please try again.'
      );
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const today = new Date().toISOString().split('T')[0];
      const moodRes = await apiFetchWithAuth(
        `${API_CONFIG.endpoints.dailyMood}?date=${today}`
      ).catch(() => null);
      if (moodRes?.data?.current_streak != null) {
        setStreak(moodRes.data.current_streak);
      }
      const logsRes = await apiFetchWithAuth(
        `${API_CONFIG.endpoints.symptomLogs}?days=1`
      ).catch(() => null);
      const logs = logsRes?.data ?? [];
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const count = logs.filter(
        (log: { logged_at?: string }) =>
          log.logged_at && new Date(log.logged_at) >= todayStart
      ).length;
      setTodaySymptomCount(count);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={false}
        >
          <DashboardSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ContentTransition>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Top section — white */}
        <View style={styles.heroSection}>
          <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
            <Text style={styles.greeting}>Hi there</Text>
          </StaggeredZoomIn>
          {trialStatus.expired && (
            <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
              <View style={styles.trialExpiredBanner}>
                <Text style={styles.trialExpiredTitle}>Trial ended</Text>
                <Text style={styles.trialExpiredSubtitle}>Manage your subscription on the web</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.trialUpgradeButton}
                  onPress={handleOpenDashboard}
                >
                  <Text style={styles.trialUpgradeButtonText}>Manage subscription</Text>
                </TouchableOpacity>
              </View>
            </StaggeredZoomIn>
          )}
          {!trialStatus.expired && !trialStatus.loading && trialStatus.daysLeft <= 2 && trialStatus.daysLeft >= 0 && (
            <StaggeredZoomIn delayIndex={2} reduceMotion={reduceMotion}>
              <View style={styles.trialNearBanner}>
                <Text style={styles.trialNearText}>
                  Your trial ends in {trialStatus.daysLeft === 0 ? 'today' : trialStatus.daysLeft === 1 ? '1 day' : `${trialStatus.daysLeft} days`}. Manage subscription at menolisa.com.
                </Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.trialNearButton}
                  onPress={handleOpenDashboard}
                >
                  <Text style={styles.trialNearButtonText}>Manage subscription</Text>
                </TouchableOpacity>
              </View>
            </StaggeredZoomIn>
          )}
          {error && (
            <StaggeredZoomIn delayIndex={3} reduceMotion={reduceMotion}>
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            </StaggeredZoomIn>
          )}
          {streak != null && streak > 0 && (
            <StaggeredZoomIn delayIndex={4} reduceMotion={reduceMotion}>
              <View style={styles.streakCard}>
                <Ionicons name="flame" size={24} color={colors.primary} />
                <Text style={styles.streakText}>{streak} day streak</Text>
              </View>
            </StaggeredZoomIn>
          )}
          <StaggeredZoomIn delayIndex={5} reduceMotion={reduceMotion}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.symptomSummaryCard}
              onPress={() => navigation.navigate('Symptoms')}
            >
              <Ionicons name="fitness" size={24} color={colors.primary} />
              <View style={styles.symptomSummaryTextWrap}>
                <Text style={styles.symptomSummaryTitle}>Today&apos;s symptoms</Text>
                <Text style={styles.symptomSummarySubtitle}>
                  {todaySymptomCount === null
                    ? '…'
                    : todaySymptomCount === 0
                      ? "Tap to add how you're feeling"
                      : todaySymptomCount === 1
                        ? '1 symptom logged'
                        : `${todaySymptomCount} symptoms logged`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </StaggeredZoomIn>
          <StaggeredZoomIn delayIndex={6} reduceMotion={reduceMotion}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Symptoms')}
            >
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={styles.primaryButtonText}>Log symptom</Text>
            </TouchableOpacity>
          </StaggeredZoomIn>
        </View>

        <StaggeredZoomIn delayIndex={7} reduceMotion={reduceMotion}>
          <WavyDivider />
        </StaggeredZoomIn>

        {/* Bottom section — pink (theme) */}
        <View style={styles.contentSection}>
          <StaggeredZoomIn delayIndex={8} reduceMotion={reduceMotion}>
            <View style={styles.disclaimerCard}>
              <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
              <Text style={styles.disclaimerText}>
                MenoLisa is for tracking and information only. It is not medical advice. Always consult a
                healthcare provider for medical decisions.
              </Text>
            </View>
          </StaggeredZoomIn>
          <StaggeredZoomIn delayIndex={9} reduceMotion={reduceMotion}>
            <WhatLisaNoticedCard />
          </StaggeredZoomIn>
          <StaggeredZoomIn delayIndex={10} reduceMotion={reduceMotion}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.recentActivityCard}
              onPress={() => navigation.navigate('SymptomLogs')}
            >
              <Ionicons name="time" size={24} color={colors.primary} />
              <View style={styles.recentActivityTextWrap}>
                <Text style={styles.recentActivityTitle}>Symptom history</Text>
                <Text style={styles.recentActivitySubtitle}>See all your symptom logs</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </StaggeredZoomIn>
        </View>
      </ScrollView>
      </ContentTransition>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  heroSection: {
    backgroundColor: colors.background,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    // Remove any marginBottom if present
  },
  contentSection: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    marginTop: -1, // Overlap slightly to prevent gap
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
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    lineHeight: 18,
  },
  greeting: {
    fontSize: 24,
    fontFamily: typography.family.bold,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  errorBanner: {
    backgroundColor: colors.dangerBg,
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.danger,
  },
  trialExpiredBanner: {
    backgroundColor: colors.dangerBg,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  trialExpiredTitle: {
    fontSize: 17,
    fontFamily: typography.family.semibold,
    color: colors.danger,
    marginBottom: 4,
  },
  trialExpiredSubtitle: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  trialUpgradeButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
  },
  trialUpgradeButtonText: {
    fontSize: 15,
    fontFamily: typography.family.semibold,
    color: colors.background,
  },
  trialNearBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 141, 161, 0.15)',
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  trialNearText: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.text,
    minWidth: 200,
  },
  trialNearButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
  },
  trialNearButtonText: {
    fontSize: 14,
    fontFamily: typography.family.semibold,
    color: colors.background,
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  streakText: {
    fontSize: 16,
    fontFamily: typography.family.semibold,
    color: colors.text,
  },
  symptomSummaryCard: {
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
  symptomSummaryTextWrap: {
    flex: 1,
  },
  symptomSummaryTitle: {
    fontSize: 16,
    fontFamily: typography.family.semibold,
    color: colors.text,
  },
  symptomSummarySubtitle: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    marginTop: 2,
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
  recentActivityTextWrap: {
    flex: 1,
  },
  recentActivityTitle: {
    fontSize: 16,
    fontFamily: typography.family.semibold,
    color: colors.text,
  },
  recentActivitySubtitle: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    marginTop: 2,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: Math.max(spacing.md, (minTouchTarget - 24) / 2),
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
    minHeight: minTouchTarget + 8,
    ...shadows.buttonPrimary,
  },
  primaryButtonText: {
    fontSize: 17,
    fontFamily: typography.family.semibold,
    color: colors.background,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
