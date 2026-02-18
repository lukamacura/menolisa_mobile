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
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { HomeStackParamList, MainTabParamList } from '../../navigation/types';
import { apiFetchWithAuth, API_CONFIG, openWebDashboard } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { RefetchTrialContext } from '../../context/RefetchTrialContext';
import { useTrialStatus } from '../../hooks/useTrialStatus';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../../theme/tokens';
import { WhatLisaNoticedCard } from '../../components/WhatLisaNoticedCard';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';
import { DashboardSkeleton, ContentTransition } from '../../components/skeleton';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';

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

type NavProp = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'Dashboard'>,
  BottomTabNavigationProp<MainTabParamList>
>;

const LISA_DAILY_MESSAGES = [
  "Happy Sunday. I hope you found some rest this weekend. I'm here whenever you want to talk.",
  "New week, fresh start. How are you feeling as things pick back up? I'm listening.",
  "Checking in — how's your body feeling today? Even small things are worth noticing.",
  "Midweek already. Take a breath with me. What's your body telling you right now?",
  "You're doing really well just by showing up. What's been on your mind today?",
  "Almost the weekend. How are you feeling as the week winds down? I'm here to listen.",
  "A quieter day — a good time to check in with yourself. What do you need most right now?",
] as const;

function getDailyLisaMessage(): string {
  return LISA_DAILY_MESSAGES[new Date().getDay()];
}

function LisaHeroCard({ message, onPress }: { message: string; onPress: () => void }) {
  const reduceMotion = useReduceMotion();
  const [displayedText, setDisplayedText] = useState(reduceMotion ? message : '');
  const [isTyping, setIsTyping] = useState(!reduceMotion);

  // Card entrance: fade + slide up
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const translateY = useSharedValue(reduceMotion ? 0 : 14);

  // Logo breathing pulse
  const logoScale = useSharedValue(1);

  // Blinking cursor
  const cursorOpacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;

    opacity.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.quad) });
    translateY.value = withTiming(0, { duration: 480, easing: Easing.out(Easing.quad) });

    logoScale.value = withDelay(
      700,
      withRepeat(
        withSequence(
          withTiming(1.06, { duration: 1900, easing: Easing.inOut(Easing.sine) }),
          withTiming(1.0, { duration: 1900, easing: Easing.inOut(Easing.sine) }),
        ),
        -1,
        false,
      ),
    );

    cursorOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 520 }),
        withTiming(1, { duration: 520 }),
      ),
      -1,
      false,
    );
  }, [reduceMotion]);

  // Typewriter
  useEffect(() => {
    if (reduceMotion) {
      setDisplayedText(message);
      setIsTyping(false);
      return;
    }
    setDisplayedText('');
    setIsTyping(true);
    let intervalId: ReturnType<typeof setInterval>;
    const timeoutId = setTimeout(() => {
      let i = 0;
      intervalId = setInterval(() => {
        i++;
        setDisplayedText(message.slice(0, i));
        if (i >= message.length) {
          clearInterval(intervalId);
          setIsTyping(false);
        }
      }, 26);
    }, 380);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [message, reduceMotion]);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  return (
    <Animated.View style={[lisaCardStyles.wrapper, entranceStyle]}>
      <View style={lisaCardStyles.bubble}>
        <Animated.Image
          source={require('../../../assets/logo_transparent.png')}
          style={[lisaCardStyles.avatarImage, logoStyle]}
          resizeMode="contain"
        />
        <Text style={lisaCardStyles.bubbleText}>
          {displayedText}
          {isTyping && (
            <Animated.Text style={[lisaCardStyles.cursor, cursorStyle]}>|</Animated.Text>
          )}
        </Text>
        <TouchableOpacity activeOpacity={0.8} style={lisaCardStyles.talkButton} onPress={onPress}>
          <Ionicons name="chatbubble-ellipses" size={20} color={colors.navy} />
          <Text style={lisaCardStyles.talkButtonText}>Talk to Lisa</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const lisaCardStyles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.xl,
  },
  avatarImage: {
    width: 44,
    height: 44,
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  bubble: {
    backgroundColor: 'rgba(255, 184, 201, 0.18)',
    borderWidth: 1,
    borderColor: colors.primary + '30',
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 2,
  },
  bubbleText: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  cursor: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.primary,
    lineHeight: 22,
  },
  talkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue,
    paddingVertical: Math.max(spacing.md, (minTouchTarget - 24) / 2),
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    gap: spacing.sm,
    minHeight: minTouchTarget + 8,
    shadowColor: colors.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 2,
    elevation: 4,
  },
  talkButtonText: {
    fontSize: 17,
    fontFamily: typography.family.semibold,
    color: colors.navy,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

export function DashboardScreen() {
  const navigation = useNavigation<NavProp>();
  const refetchTrialRef = useContext(RefetchTrialContext);
  const trialStatus = useTrialStatus();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
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

  const handleTalkToLisa = useCallback(() => {
    navigation.getParent()?.navigate('ChatTab');
  }, [navigation]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('name')
          .eq('user_id', user.id)
          .single();
        if (profile?.name) {
          const first = profile.name.trim().split(/\s+/)[0];
          setUserName(first || profile.name);
        }
      }
      const today = new Date().toISOString().split('T')[0];
      const moodRes = await apiFetchWithAuth(
        `${API_CONFIG.endpoints.dailyMood}?date=${today}`
      ).catch(() => null);
      if (moodRes?.data?.current_streak != null) {
        setStreak(moodRes.data.current_streak);
      }
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
            <Text style={styles.greeting}>{userName ? `Hi there, ${userName}` : 'Hi there'}</Text>
          </StaggeredZoomIn>
          {streak != null && streak > 0 && (
            <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
              <View style={styles.streakPill}>
                <Ionicons name="flame" size={14} color={colors.primaryDark} />
                <Text style={styles.streakPillText}>{streak} day streak</Text>
              </View>
            </StaggeredZoomIn>
          )}
          {trialStatus.expired && (
            <StaggeredZoomIn delayIndex={2} reduceMotion={reduceMotion}>
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
            <StaggeredZoomIn delayIndex={3} reduceMotion={reduceMotion}>
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
            <StaggeredZoomIn delayIndex={4} reduceMotion={reduceMotion}>
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            </StaggeredZoomIn>
          )}
          <StaggeredZoomIn delayIndex={5} reduceMotion={reduceMotion}>
            <LisaHeroCard message={getDailyLisaMessage()} onPress={handleTalkToLisa} />
          </StaggeredZoomIn>
          <StaggeredZoomIn delayIndex={6} reduceMotion={reduceMotion}>
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
          <StaggeredZoomIn delayIndex={7} reduceMotion={reduceMotion}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Symptoms')}
            >
              <Ionicons name="add-circle" size={24} color={colors.navy} />
              <Text style={styles.primaryButtonText}>Log symptom</Text>
            </TouchableOpacity>
          </StaggeredZoomIn>
        </View>

        <StaggeredZoomIn delayIndex={8} reduceMotion={reduceMotion}>
          <WavyDivider />
        </StaggeredZoomIn>

        {/* Bottom section — pink (theme) */}
        <View style={styles.contentSection}>
          <StaggeredZoomIn delayIndex={9} reduceMotion={reduceMotion}>
            <View style={styles.disclaimerCard}>
              <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
              <Text style={styles.disclaimerText}>
                MenoLisa is for tracking and information only. It is not medical advice. Always consult a
                healthcare provider for medical decisions.
              </Text>
            </View>
          </StaggeredZoomIn>
          <StaggeredZoomIn delayIndex={10} reduceMotion={reduceMotion}>
            <WhatLisaNoticedCard />
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
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 184, 201, 0.25)',
    borderWidth: 1,
    borderColor: colors.primary + '30',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    gap: 5,
    marginBottom: spacing.lg,
  },
  streakPillText: {
    fontSize: 13,
    fontFamily: typography.family.medium,
    color: colors.primaryDark,
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
    backgroundColor: colors.gold,
    paddingVertical: Math.max(spacing.md, (minTouchTarget - 24) / 2),
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
    minHeight: minTouchTarget + 8,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 2,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 17,
    fontFamily: typography.family.semibold,
    color: colors.navy,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
