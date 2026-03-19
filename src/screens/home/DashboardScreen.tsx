import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Dimensions,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { HomeStackParamList, MainTabParamList } from '../../navigation/types';
import { apiFetchWithAuth, API_CONFIG, openWebDashboard } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { RefetchTrialContext } from '../../context/RefetchTrialContext';
import { useTrialStatus } from '../../hooks/useTrialStatus';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../../theme/tokens';
import { motion } from '../../theme/motion';
import { WhatLisaNoticedCard } from '../../components/WhatLisaNoticedCard';
import { DailyMoodHistoryCard } from '../../components/DailyMoodHistoryCard';
import { AccessEndedView } from '../../components/AccessEndedView';
import { DailyMoodModal } from '../../components/DailyMoodModal';
import { GratitudeSuccessPanel } from '../../components/GratitudeSuccessPanel';
import { useDailyMood } from '../../hooks/useDailyMood';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { DashboardSkeleton, ContentTransition } from '../../components/skeleton';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  withSpring,
  interpolate,
  Extrapolate,
  FadeInDown,
  FadeOutUp,
  FadeIn,
  FadeOut,
  LinearTransition,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const GRATITUDE_DISMISS_MS = 1800;

const STREAK_MILESTONE_COPY: Record<
  7 | 14 | 30,
  { title: string; subtitle: string }
> = {
  7: {
    title: 'One week of showing up',
    subtitle:
      'Seven days in a row of check-ins. That steadiness helps Lisa notice patterns and support you better.',
  },
  14: {
    title: 'Two weeks strong',
    subtitle:
      'Fourteen days of keeping up with yourself. Consistency like this makes insights much more meaningful.',
  },
  30: {
    title: 'A full month of care',
    subtitle:
      'Thirty days of showing up for your wellbeing. That commitment is something to be proud of.',
  },
};
const WAVE_HEIGHT = 60;
const VIDEO_HEIGHT = SCREEN_HEIGHT * 0.60;

// ---------------------------------------------------------------------------
// WavyDivider
// ---------------------------------------------------------------------------

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
          fill={colors.primaryLight}
          fillOpacity={0.6}
        />
        {/* Mid shadow - medium pink */}
        <Path
          d="M0,0 L100,0 Q50,90 0,0 Z"
          fill={colors.surfaceElevated}
          fillOpacity={0.5}
        />
        {/* Main white curve */}
        <Path
          d="M0,0 L100,0 Q50,60 0,0 Z"
          fill={colors.card}
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
    marginTop: -6,
  },
});

const heroVideoStyles = StyleSheet.create({
  video: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: VIDEO_HEIGHT,
  },
});

// ---------------------------------------------------------------------------
// AmbientVideoHero - looping background video with static image fallback
// ---------------------------------------------------------------------------

interface AmbientVideoHeroProps {
  reduceMotion: boolean;
}

function AmbientVideoHero({ reduceMotion }: AmbientVideoHeroProps) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const player = useVideoPlayer(require('../../../assets/dashboard_lisa.mp4'), (p) => {
    p.muted = true;
    p.loop = true;
  });

  useEffect(() => {
    if (reduceMotion) {
      player.pause();
      return;
    }

    player.play();
    return () => {
      player.pause();
    };
  }, [player, reduceMotion]);

  if (reduceMotion) {
    return null;
  }

  return (
    <VideoView
      player={player}
      contentFit="cover"
      nativeControls={false}
      style={heroVideoStyles.video}
      accessibilityLabel="Ambient looping background video"
    />
  );
}

// ---------------------------------------------------------------------------
// Navigation type
// ---------------------------------------------------------------------------

type NavProp = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'Dashboard'>,
  BottomTabNavigationProp<MainTabParamList>
>;

// ---------------------------------------------------------------------------
// Daily Lisa messages
// ---------------------------------------------------------------------------

const LISA_DAILY_MESSAGES = [
  "Happy Sunday. I hope you found some rest this weekend. I'm here whenever you want to talk.",
  "New week, fresh start. How are you feeling as things pick back up? I'm listening.",
  "Checking in - how's your body feeling today? Even small things are worth noticing.",
  "Midweek already. Take a breath with me. What's your body telling you right now?",
  "You're doing really well just by showing up. What's been on your mind today?",
  "Almost the weekend. How are you feeling as the week winds down? I'm here to listen.",
  "A quieter day - a good time to check in with yourself. What do you need most right now?",
] as const;

function getDailyLisaMessage(): string {
  return LISA_DAILY_MESSAGES[new Date().getDay()];
}

// ---------------------------------------------------------------------------
// LisaHeroCard
// ---------------------------------------------------------------------------

function LisaHeroCard({ message, onPress }: { message: string; onPress: () => void }) {
  const reduceMotion = useReduceMotion();
  const [displayedText, setDisplayedText] = useState(reduceMotion ? message : '');
  const [isTyping, setIsTyping] = useState(!reduceMotion);

  // Card entrance: fade + slide up
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const translateY = useSharedValue(reduceMotion ? 0 : 14);

  // Blinking cursor
  const cursorOpacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;

    opacity.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.quad) });
    translateY.value = withTiming(0, { duration: 480, easing: Easing.out(Easing.quad) });

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

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  return (
    <Animated.View style={[lisaCardStyles.wrapper, entranceStyle]}>
      <View style={lisaCardStyles.bubble}>

        <Text style={lisaCardStyles.bubbleText}>
          {displayedText}
          {isTyping && (
            <Animated.Text style={[lisaCardStyles.cursor, cursorStyle]}>|</Animated.Text>
          )}
        </Text>
        <TouchableOpacity
          activeOpacity={0.8}
          style={lisaCardStyles.talkButton}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="Talk to Lisa"
        >
          <Ionicons name="chatbubble-ellipses" size={20} color={colors.navy} />
          <Text style={lisaCardStyles.talkButtonText}>Talk to Lisa</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// Lisa card styles - blue retired, replaced with white glass + coral
const lisaCardStyles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.xl,
  },
  bubble: {
    // White glass instead of blue tint
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.40)',
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...(Platform.OS === 'web' ? { boxShadow: `0 2px 8px ${colors.primary}1f` } : { shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 2 }),
  },
  bubbleText: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.background,
    lineHeight: 22,
    marginBottom: spacing.md,
    ...(Platform.OS === 'web' ? { textShadow: '0 1px 4px rgba(0,0,0,0.85)' } : { textShadowColor: 'rgba(0, 0, 0, 0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }),
  },
  cursor: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.primary,
    lineHeight: 22,
    ...(Platform.OS === 'web' ? { textShadow: '0 1px 4px rgba(0,0,0,0.85)' } : { textShadowColor: 'rgba(0, 0, 0, 0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }),
  },
  talkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // Coral instead of blue
    backgroundColor: colors.primary,
    paddingVertical: Math.max(spacing.md, (minTouchTarget - 24) / 2),
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    gap: spacing.sm,
    minHeight: minTouchTarget + 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 2,
    elevation: 4,
  },
  talkButtonText: {
    fontSize: 17,
    fontFamily: typography.display.semibold,
    color: colors.navy,
    letterSpacing: 0.5,
  },
});

// ---------------------------------------------------------------------------
// DashboardScreen
// ---------------------------------------------------------------------------

export function DashboardScreen() {
  const navigation = useNavigation<NavProp>();
  const refetchTrialRef = useContext(RefetchTrialContext);
  const trialStatus = useTrialStatus();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [endingSoonPaywallDismissed, setEndingSoonPaywallDismissed] = useState(false);
  const reduceMotion = useReduceMotion();

  // Daily mood check-in
  const { hasMoodToday, loading: moodLoading, submitMood } = useDailyMood();
  const [moodModalVisible, setMoodModalVisible] = useState(false);
  const [streakGratitudeDays, setStreakGratitudeDays] = useState<7 | 14 | 30 | null>(null);

  // Show the modal once the mood check resolves and no entry exists for today
  useEffect(() => {
    if (!moodLoading && !hasMoodToday) {
      const timer = setTimeout(() => setMoodModalVisible(true), 600);
      return () => clearTimeout(timer);
    }
  }, [moodLoading, hasMoodToday]);

  const handleMoodSubmit = useCallback(
    async (mood: 1 | 2 | 3 | 4) => submitMood(mood),
    [submitMood]
  );

  useEffect(() => {
    if (streak == null || loading) return;
    if (streak !== 7 && streak !== 14 && streak !== 30) return;
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id || cancelled) return;
      const m: 7 | 14 | 30 = streak;
      const key = `@menolisa:streak_gratitude_${user.id}_${m}`;
      const done = await AsyncStorage.getItem(key);
      if (done === 'true' || cancelled) return;
      await AsyncStorage.setItem(key, 'true');
      if (!cancelled) setStreakGratitudeDays(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [streak, loading]);

  useEffect(() => {
    if (streakGratitudeDays == null) return;
    const timer = setTimeout(() => setStreakGratitudeDays(null), GRATITUDE_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [streakGratitudeDays]);

  // Register refetch so trial status refreshes when user returns from web dashboard
  useEffect(() => {
    if (refetchTrialRef) refetchTrialRef.current = trialStatus.refetch;
    return () => {
      if (refetchTrialRef) refetchTrialRef.current = null;
    };
  }, [refetchTrialRef, trialStatus.refetch]);

  // Refetch trial when screen gains focus (e.g. return from browser)
  // Fade-in + rise on every focus visit — screen + individual CTA images
  const screenOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const scrollY = useSharedValue(0);
  const endingSoonPulse = useSharedValue(1);
  const cardLayoutTransition = LinearTransition.duration(motion.duration.base).easing(Easing.out(Easing.quad));

  useFocusEffect(
    useCallback(() => {
      trialStatus.refetch().catch(() => {});
      if (reduceMotion) return;
      screenOpacity.value = 0;
      screenOpacity.value = withTiming(1, {
        duration: motion.duration.entrance,
        easing: Easing.out(Easing.quad),
      });
    }, [trialStatus.refetch, screenOpacity, reduceMotion])
  );

  const screenFadeStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (reduceMotion) return;
      scrollY.value = event.contentOffset.y;
    },
  });

  const heroMediaStyle = useAnimatedStyle(() => {
    if (reduceMotion) return {};

    const scale = interpolate(scrollY.value, [0, VIDEO_HEIGHT], [1, 0.96], Extrapolate.CLAMP);
    const translateY = interpolate(scrollY.value, [0, VIDEO_HEIGHT], [0, -26], Extrapolate.CLAMP);
    return {
      transform: [{ translateY }, { scale }],
    };
  });

  const heroOverlayStyle = useAnimatedStyle(() => {
    if (reduceMotion) return {};

    const translateY = interpolate(scrollY.value, [0, VIDEO_HEIGHT * 0.75], [0, -16], Extrapolate.CLAMP);
    const opacity = interpolate(scrollY.value, [0, VIDEO_HEIGHT * 0.85], [1, 0.84], Extrapolate.CLAMP);
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const heroGradientStyle = useAnimatedStyle(() => {
    if (reduceMotion) return {};

    const opacity = interpolate(scrollY.value, [0, VIDEO_HEIGHT * 0.8], [1, 0.9], Extrapolate.CLAMP);
    return { opacity };
  });

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

  const dismissMoodModal = useCallback(() => {
    setMoodModalVisible(false);
  }, []);

  const onMoodGratitudeComplete = useCallback(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const showEndingSoonPaywall =
    !trialStatus.expired &&
    !trialStatus.loading &&
    trialStatus.daysLeft <= 2 &&
    trialStatus.daysLeft >= 0 &&
    !endingSoonPaywallDismissed;

  useEffect(() => {
    if (reduceMotion || !showEndingSoonPaywall) {
      endingSoonPulse.value = 1;
      return;
    }

    endingSoonPulse.value = withSequence(
      withSpring(1.02, { damping: 16, stiffness: 220 }),
      withSpring(1, { damping: 18, stiffness: 260 })
    );
  }, [reduceMotion, showEndingSoonPaywall, endingSoonPulse]);

  const endingSoonOverlayStyle = useAnimatedStyle(() => ({
    transform: [{ scale: endingSoonPulse.value }],
  }));

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
      {trialStatus.expired && (
        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.base)}
          exiting={reduceMotion ? undefined : FadeOutUp.duration(motion.duration.base)}
          style={[StyleSheet.absoluteFillObject, styles.paywallOverlay]}
          pointerEvents="box-none"
        >
          <AccessEndedView
            variant="fullScreen"
            trialState="expired"
            onPress={handleOpenDashboard}
            reduceMotion={reduceMotion}
          />
        </Animated.View>
      )}
      {showEndingSoonPaywall && (
        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.base)}
          exiting={reduceMotion ? undefined : FadeOutUp.duration(motion.duration.base)}
          style={[StyleSheet.absoluteFillObject, styles.paywallOverlay, endingSoonOverlayStyle]}
          pointerEvents="box-none"
        >
          <AccessEndedView
            variant="fullScreen"
            trialState="ending_soon"
            daysLeft={trialStatus.daysLeft}
            onPress={handleOpenDashboard}
            onSkip={() => setEndingSoonPaywallDismissed(true)}
            reduceMotion={reduceMotion}
          />
        </Animated.View>
      )}
      <Animated.View style={[{ flex: 1 }, screenFadeStyle]}>
      <ContentTransition>
        <Animated.ScrollView
          contentContainerStyle={styles.scrollContent}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* ----------------------------------------------------------------
              Video hero - 60% screen height; video fills area (cover), no overlay
          ---------------------------------------------------------------- */}
          <View style={styles.videoHero}>
            <View style={styles.videoHeroParallaxBackdrop} />
            <Animated.View style={[styles.videoHeroMediaWrap, heroMediaStyle]}>
              <AmbientVideoHero reduceMotion={reduceMotion} />
            </Animated.View>

            {/* Linear gradient top → bottom (transparent to darker) so overlay text is readable */}
            <Animated.View style={[styles.videoHeroGradientWrap, heroGradientStyle]}>
              <LinearGradient
                colors={['transparent', 'rgba(0, 0, 0, 0.45)']}
                style={[styles.videoHeroGradient, { pointerEvents: 'none' }]}
              />
            </Animated.View>

            {/* Content pinned to the bottom of the hero — greeting + Lisa CTA card */}
            <Animated.View style={[styles.videoOverlayContent, heroOverlayStyle]}>
              <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
                <Text style={styles.greeting}>
                  {userName ? `Hi there, ${userName}` : 'Hi there'}
                </Text>
              </StaggeredZoomIn>

              {error && (
                <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
                  <Animated.View
                    entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.base)}
                    exiting={reduceMotion ? undefined : FadeOutUp.duration(motion.duration.fast)}
                    style={styles.errorBanner}
                  >
                    <Text style={styles.errorText}>{error}</Text>
                  </Animated.View>
                </StaggeredZoomIn>
              )}

              {!trialStatus.expired && (
                <StaggeredZoomIn delayIndex={2} reduceMotion={reduceMotion}>
                  <View style={styles.talkToLisaHeroCard}>
                    {/* i18n: dashboard.lisaDailyMessage */}
                    <Text style={styles.talkToLisaHeroSubheading}>{getDailyLisaMessage()}</Text>
                    <AnimatedPressable
                      containerStyle={styles.pressableContainer}
                      style={styles.talkToLisaHeroButton}
                      onPress={handleTalkToLisa}
                      accessibilityRole="button"
                      accessibilityLabel="Talk to Lisa"
                    >
                      <Ionicons name="chatbubble-ellipses" size={20} color={colors.navy} />
                      <Text style={styles.talkToLisaHeroButtonText}>Talk to Lisa</Text>
                    </AnimatedPressable>
                  </View>
                </StaggeredZoomIn>
              )}
            </Animated.View>
          </View>

          {/* ----------------------------------------------------------------
              Below video — message, then CTAs
          ---------------------------------------------------------------- */}
          {!trialStatus.expired && (
            <Animated.View
              layout={reduceMotion ? undefined : cardLayoutTransition}
              entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.slow)}
              exiting={reduceMotion ? undefined : FadeOutUp.duration(motion.duration.base)}
              style={styles.belowVideoSection}
            >
              {/* Symptom box */}
              <StaggeredZoomIn delayIndex={3} reduceMotion={reduceMotion}>
                <Animated.View
                  layout={reduceMotion ? undefined : cardLayoutTransition}
                  style={styles.symptomCategoryBox}
                >
                  <AnimatedPressable
                    containerStyle={styles.pressableContainer}
                    style={styles.symptomCategoryItem}
                    onPress={() => navigation.navigate('SymptomLogs')}
                    accessibilityRole="button"
                    accessibilityLabel="View symptom history"
                  >
                    <Ionicons name="time" size={24} color={colors.primary} />
                    <View style={styles.recentActivityTextWrap}>
                      <Text style={styles.recentActivityTitle}>Symptom history</Text>
                      <Text style={styles.recentActivitySubtitle}>See all your symptom logs</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  </AnimatedPressable>
                  <AnimatedPressable
                    containerStyle={styles.pressableContainer}
                    style={styles.logSymptomCtaPressable}
                    onPress={() => navigation.navigate('Symptoms')}
                    accessibilityRole="button"
                    accessibilityLabel="Log symptom"
                  >
                    <Image
                      source={require('../../../assets/symptoms.png')}
                      style={styles.logSymptomImage}
                      resizeMode="contain"
                      accessibilityIgnoresInvertColors
                    />
                    <View style={styles.logSymptomLabelWrap}>
                      {/* i18n: dashboard.cta.logSymptom */}
                      <Text style={styles.logSymptomLabel}>Log Symptom</Text>
                    </View>
                  </AnimatedPressable>
                </Animated.View>
              </StaggeredZoomIn>
            </Animated.View>
          )}

          {/* ----------------------------------------------------------------
              Wavy divider + pink content section (unchanged)
          ---------------------------------------------------------------- */}
          {!trialStatus.expired && (
            <>
              <StaggeredZoomIn delayIndex={8} reduceMotion={reduceMotion}>
                <WavyDivider />
              </StaggeredZoomIn>

              {/* Bottom section - pink (theme) */}
              <Animated.View
                layout={reduceMotion ? undefined : cardLayoutTransition}
                entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.slow)}
                exiting={reduceMotion ? undefined : FadeOutUp.duration(motion.duration.base)}
                style={styles.contentSection}
              >
                <StaggeredZoomIn delayIndex={9} reduceMotion={reduceMotion}>
                  <Animated.View layout={reduceMotion ? undefined : cardLayoutTransition}>
                    <WhatLisaNoticedCard />
                  </Animated.View>
                </StaggeredZoomIn>
                <StaggeredZoomIn delayIndex={10} reduceMotion={reduceMotion}>
                  <Animated.View layout={reduceMotion ? undefined : cardLayoutTransition}>
                    <DailyMoodHistoryCard />
                  </Animated.View>
                </StaggeredZoomIn>
                <StaggeredZoomIn delayIndex={11} reduceMotion={reduceMotion}>
                  <Animated.View layout={reduceMotion ? undefined : cardLayoutTransition}>
                    <View style={styles.disclaimerCard}>
                      <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
                      <Text style={styles.disclaimerText}>
                        MenoLisa is for tracking and information only. It is not medical advice. Always consult a
                        healthcare provider for medical decisions.
                      </Text>
                    </View>
                  </Animated.View>
                </StaggeredZoomIn>
              </Animated.View>
            </>
          )}
        </Animated.ScrollView>
      </ContentTransition>
      </Animated.View>

      <DailyMoodModal
        visible={moodModalVisible}
        onSubmit={handleMoodSubmit}
        onDismiss={dismissMoodModal}
        onGratitudeComplete={onMoodGratitudeComplete}
      />

      <Modal
        visible={streakGratitudeDays != null}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setStreakGratitudeDays(null)}
      >
        <View style={styles.streakGratitudeRoot}>
          {streakGratitudeDays != null ? (
            <GratitudeSuccessPanel
              title={STREAK_MILESTONE_COPY[streakGratitudeDays].title}
              subtitle={STREAK_MILESTONE_COPY[streakGratitudeDays].subtitle}
              metaChips={[{ icon: 'flame', label: `${streakGratitudeDays} day streak` }]}
              encouragement="Keep going — you're building something meaningful."
              reduceMotion={reduceMotion}
            />
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  paywallOverlay: {
    zIndex: 9999,
    elevation: 9999,
  },
  streakGratitudeRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  pressableContainer: {
    width: '100%',
  },

  // --- Video hero (replaces heroSection) ---
  videoHero: {
    height: VIDEO_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.primaryLight,
  },
  videoHeroParallaxBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primaryLight,
  },
  videoHeroMediaWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primaryLight,
  },
  videoHeroGradientWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  videoHeroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  videoOverlayContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },

  talkToLisaHeroCard: {
    marginTop: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderWidth: 1,
    ...Platform.select({
      // Translucent views + elevation on Android composites as gray, muddy fills and harsh drop shadows.
      android: {
        elevation: 0,
        borderColor: 'rgba(255, 255, 255, 0.26)',
      },
      ios: {
        ...shadows.card,
        borderColor: 'rgba(255, 255, 255, 0.14)',
      },
      web: {
        borderColor: 'rgba(255, 255, 255, 0.14)',
        boxShadow:
          '0 10px 28px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.12)',
      },
      default: {
        borderColor: 'rgba(255, 255, 255, 0.14)',
      },
    }),
  },
  talkToLisaHeroSubheading: {
    ...typography.presets.body,
    fontFamily: typography.family.bold,
    color: colors.background,
    marginBottom: spacing.md,
    ...(Platform.OS === 'web'
      ? { textShadow: '0 1px 3px rgba(0, 0, 0, 0.45)' }
      : {
          textShadowColor: 'rgba(0, 0, 0, 0.45)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 4,
        }),
  },
  talkToLisaHeroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: Math.max(spacing.md, (minTouchTarget - 24) / 2),
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    gap: spacing.sm,
    minHeight: minTouchTarget + 8,
    ...shadows.buttonPrimary,
  },
  talkToLisaHeroButtonText: {
    fontSize: 17,
    fontFamily: typography.display.semibold,
    color: colors.navy,
    letterSpacing: 0.5,
  },

  // --- Below video, white bg ---
  belowVideoSection: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },

  // --- Bare image CTAs ---
  actionCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: spacing.md,
  },
  actionBubbleWrap: {
    alignItems: 'center',
  },
  actionBubbleImage: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.xl) / 2,
    height: (SCREEN_WIDTH - spacing.lg * 2 - spacing.xl) / 2,
  },
  actionBubbleLabel: {
    ...typography.presets.label,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // --- Tertiary history link (de-emphasised, below the two cards) ---
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    minHeight: minTouchTarget,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  historyLinkText: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },

  // --- Existing sections (unchanged) ---
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
    backgroundColor: colors.card + 'B3',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    lineHeight: 18,
  },

  // --- Greeting - white for readability over video overlay ---
  greeting: {
    fontSize: 24,
    fontFamily: typography.display.bold,
    color: colors.background,
    marginBottom: spacing.lg,
    ...(Platform.OS === 'web' ? { textShadow: '0 2px 6px rgba(0,0,0,0.85)' } : { textShadowColor: 'rgba(0, 0, 0, 0.85)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 }),
  },

  // --- Error banner ---
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

  // --- Trial expired banner styles (kept for AccessEndedView context) ---
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
    fontFamily: typography.display.semibold,
    color: colors.background,
  },

  // --- Trial near banner - translucent on video overlay ---
  trialNearBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight + '40',
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + '60',
  },
  trialNearText: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.background,
    minWidth: 200,
    ...(Platform.OS === 'web' ? { textShadow: '0 1px 4px rgba(0,0,0,0.85)' } : { textShadowColor: 'rgba(0, 0, 0, 0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }),
  },
  trialNearButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
  },
  trialNearButtonText: {
    fontSize: 14,
    fontFamily: typography.display.semibold,
    color: colors.background,
    ...(Platform.OS === 'web' ? { textShadow: '0 1px 4px rgba(0,0,0,0.85)' } : { textShadowColor: 'rgba(0, 0, 0, 0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }),
  },

  // --- Streak pill - white glass on video overlay ---
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    gap: 5,
    marginBottom: spacing.lg,
  },
  streakPillText: {
    fontSize: 13,
    fontFamily: typography.family.medium,
    color: colors.background,
    ...(Platform.OS === 'web' ? { textShadow: '0 1px 4px rgba(0,0,0,0.85)' } : { textShadowColor: 'rgba(0, 0, 0, 0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }),
  },

  // --- Symptom category box - white with coral accent (gold retired) ---
  symptomCategoryBox: {
    backgroundColor: colors.card + 'F2',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  symptomCategoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: 0,
    gap: spacing.md,
    minHeight: minTouchTarget,
  },
  symptomCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // Coral instead of gold
    backgroundColor: colors.primary,
    paddingVertical: Math.max(spacing.md, (minTouchTarget - 24) / 2),
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    gap: spacing.sm,
    minHeight: minTouchTarget + 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 2,
    elevation: 4,
  },
  logSymptomCtaPressable: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.lg,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    minHeight: minTouchTarget,
  },
  logSymptomImage: {
    width: Math.min(168, (SCREEN_WIDTH - spacing.lg * 4) * 0.42),
    height: Math.min(168, (SCREEN_WIDTH - spacing.lg * 4) * 0.42),
    marginBottom: 0,
  },
  logSymptomLabelWrap: {
    marginTop: spacing.xs / 2,
    paddingVertical: spacing.xs / 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 214, 102, 0.36)',
  },
  logSymptomLabel: {
    ...typography.presets.label,
    color: '#CA8A04',
    textAlign: 'center',
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
    fontFamily: typography.display.semibold,
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
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 2,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 17,
    fontFamily: typography.display.semibold,
    color: colors.navy,
    letterSpacing: 0.5,
  },
});
