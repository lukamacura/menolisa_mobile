import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WAVE_HEIGHT = 36;

/** Single irregular line dividing white (top) and pink (bottom). Top edge of the pink fill is the wave. */
function WavyDivider() {
  const w = SCREEN_WIDTH;
  const h = WAVE_HEIGHT;
  const dip = h * 0.75;
  const path = `M 0 0 C ${w * 0.35} ${dip} ${w * 0.65} ${dip} ${w} 0 L ${w} ${h} L 0 ${h} Z`;
  return (
    <View style={wavyStyles.wrap}>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={wavyStyles.svg}>
        <Path d={path} fill={colors.primaryLight} />
      </Svg>
    </View>
  );
}

const wavyStyles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: WAVE_HEIGHT,
    marginTop: -1,
    marginBottom: -2,
  },
  svg: {
    width: '100%',
    height: WAVE_HEIGHT,
    overflow: 'hidden',
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
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Top section — white */}
        <View style={styles.heroSection}>
          <Text style={styles.greeting}>Hi there</Text>
          {trialStatus.expired && (
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
          )}
          {!trialStatus.expired && !trialStatus.loading && trialStatus.daysLeft <= 2 && trialStatus.daysLeft >= 0 && (
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
          )}
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {streak != null && streak > 0 && (
            <View style={styles.streakCard}>
              <Ionicons name="flame" size={24} color={colors.primary} />
              <Text style={styles.streakText}>{streak} day streak</Text>
            </View>
          )}
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
                    ? "No symptoms logged yet — tap to add how you're feeling"
                    : todaySymptomCount === 1
                      ? '1 symptom logged'
                      : `${todaySymptomCount} symptoms logged`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Symptoms')}
          >
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={styles.primaryButtonText}>Log symptom</Text>
          </TouchableOpacity>
        </View>

        <WavyDivider />

        {/* Bottom section — pink (theme) */}
        <View style={styles.contentSection}>
          <View style={styles.disclaimerCard}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
            <Text style={styles.disclaimerText}>
              MenoLisa is for tracking and information only. It is not medical advice. Always consult a
              healthcare provider for medical decisions.
            </Text>
          </View>
          <WhatLisaNoticedCard />
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing['2xl'],
  },
  heroSection: {
    backgroundColor: colors.background,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  contentSection: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    marginTop: -2,
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: 16,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
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
