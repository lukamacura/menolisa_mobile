import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  useWindowDimensions,
  Alert,
  Platform,
  Modal,
  AppState,
  type AppStateStatus,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import { HomeStackParamList, MainTabParamList } from '../../navigation/types';
import { apiFetchWithAuth, API_CONFIG, openWebAccount } from '../../lib/api';
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
  withTiming,
  withSequence,
  withSpring,
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const DASHBOARD_LISA_VIDEO = require('../../../assets/dashboard_lisa.mp4');

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

const HERO_HEIGHT_RATIO = 0.58;

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
        {/* Top curve: same as app canvas (not card) so hero meets background seamlessly */}
        <Path
          d="M0,0 L100,0 Q50,60 0,0 Z"
          fill={colors.background}
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
// Hero ambient video (native only; pause when unfocused / background for stability)
// ---------------------------------------------------------------------------

type DashboardHeroAmbientVideoProps = {
  shouldPlay: boolean;
  layoutWidth: number;
  layoutHeight: number;
};

function DashboardHeroAmbientVideo({
  shouldPlay,
  layoutWidth,
  layoutHeight,
}: DashboardHeroAmbientVideoProps) {
  const shouldPlayRef = useRef(shouldPlay);
  shouldPlayRef.current = shouldPlay;

  const player = useVideoPlayer(DASHBOARD_LISA_VIDEO, (p) => {
    p.loop = true;
    p.muted = true;
    p.volume = 0;
    p.showNowPlayingNotification = false;
    p.staysActiveInBackground = false;
    p.keepScreenOnWhilePlaying = false;
  });

  // play() before readyToPlay is a no-op; resume when the native player is ready
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay' && shouldPlayRef.current) {
      player.play();
    }
  });

  useEffect(() => {
    if (shouldPlay) {
      if (player.status === 'readyToPlay') {
        player.play();
      }
    } else {
      player.pause();
    }
  }, [shouldPlay, player]);

  return (
    <VideoView
      player={player}
      style={[styles.heroAmbientVideo, { width: layoutWidth, height: layoutHeight }]}
      contentFit="cover"
      nativeControls={false}
      fullscreenOptions={{ enable: false }}
      allowsPictureInPicture={false}
      pointerEvents="none"
      collapsable={false}
    />
  );
}

// ---------------------------------------------------------------------------
// DashboardScreen
// ---------------------------------------------------------------------------

export function DashboardScreen() {
  const isScreenFocused = useIsFocused();
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const dashboardHeroHeight = Math.max(200, Math.round(windowHeight * HERO_HEIGHT_RATIO));

  const navigation = useNavigation<NavProp>();
  const refetchTrialRef = useContext(RefetchTrialContext);
  const trialStatus = useTrialStatus();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [ageBandId, setAgeBandId] = useState<string | null>(null);
  const [endingSoonPaywallDismissed, setEndingSoonPaywallDismissed] = useState(false);
  const reduceMotion = useReduceMotion();

  // Daily mood check-in
  const { hasMoodToday, loading: moodLoading, submitMood } = useDailyMood();
  const [moodModalVisible, setMoodModalVisible] = useState(false);
  const [moodHistoryRefreshKey, setMoodHistoryRefreshKey] = useState(0);
  const [streakGratitudeDays, setStreakGratitudeDays] = useState<7 | 14 | 30 | null>(null);

  // Show the modal once the mood check resolves and no entry exists for today
  useEffect(() => {
    if (!moodLoading && !hasMoodToday) {
      const timer = setTimeout(() => setMoodModalVisible(true), 600);
      return () => clearTimeout(timer);
    }
  }, [moodLoading, hasMoodToday]);

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

  const handleOpenAccountWeb = useCallback(async () => {
    try {
      await openWebAccount();
    } catch (e) {
      Alert.alert(
        'Open account',
        e instanceof Error ? e.message : 'Could not open your account on the web. Please try again.'
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
          .select('name, age_band')
          .eq('user_id', user.id)
          .single();
        if (profile?.name) {
          const first = profile.name.trim().split(/\s+/)[0];
          setUserName(first || profile.name);
        }
        setAgeBandId(
          profile?.age_band != null && typeof profile.age_band === 'string'
            ? profile.age_band
            : null,
        );
      }
      const today = new Date().toISOString().split('T')[0];
      const moodRes = await apiFetchWithAuth(
        `${API_CONFIG.endpoints.dailyMood}?date=${today}`
      ).catch(() => null);
      const streakVal =
        typeof moodRes?.current_streak === 'number'
          ? moodRes.current_streak
          : typeof moodRes?.data?.current_streak === 'number'
            ? moodRes.data.current_streak
            : null;
      if (streakVal !== null) {
        setStreak(streakVal);
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

  const handleMoodSubmit = useCallback(
    async (mood: 1 | 2 | 3 | 4) => {
      const ok = await submitMood(mood);
      if (ok) {
        setMoodHistoryRefreshKey((k) => k + 1);
        void loadData();
      }
      return ok;
    },
    [submitMood, loadData],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', setAppState);
    return () => sub.remove();
  }, []);

  const heroVideoShouldPlay = isScreenFocused && appState === 'active';
  const heroVideoPlayback =
    heroVideoShouldPlay && !reduceMotion;

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
            onPress={handleOpenAccountWeb}
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
            onPress={handleOpenAccountWeb}
            onSkip={() => setEndingSoonPaywallDismissed(true)}
            reduceMotion={reduceMotion}
          />
        </Animated.View>
      )}
      <Animated.View style={[{ flex: 1 }, screenFadeStyle]}>
      <ContentTransition>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* ----------------------------------------------------------------
              Hero: ambient video (native) / navy (web) + greeting + Talk to Lisa CTA
          ---------------------------------------------------------------- */}
          <View
            style={[
              styles.dashboardHero,
              { height: dashboardHeroHeight },
              Platform.OS !== 'web' && styles.dashboardHeroVideoCanvas,
            ]}
          >
            <View
              style={styles.heroAmbientMediaWrap}
              pointerEvents="none"
              collapsable={false}
            >
              {Platform.OS === 'web' ? (
                <View style={styles.dashboardHeroBg} />
              ) : (
                <DashboardHeroAmbientVideo
                  shouldPlay={heroVideoPlayback}
                  layoutWidth={windowWidth}
                  layoutHeight={dashboardHeroHeight}
                />
              )}
              {/* Readability only at bottom — full-hero navy was hiding the video */}
              <LinearGradient
                colors={['transparent', 'rgba(0, 0, 0, 0.35)']}
                locations={[0.35, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.heroVideoBottomReadability}
                pointerEvents="none"
              />
            </View>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.12)', 'transparent']}
              locations={[0, 0.4]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.dashboardHeroSheen}
              pointerEvents="none"
            />

            {/* Light accents so the hero stays on-brand without washing out the clip */}
            <View
              style={styles.heroDecorBlobTopRight}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            <View
              style={[
                styles.heroDecorBlobMidLeft,
                { top: Math.round(dashboardHeroHeight * 0.28) },
              ]}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            <View
              style={[
                styles.heroDecorBlobMidRight,
                { top: Math.round(dashboardHeroHeight * 0.46) },
              ]}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />

            <View
              style={styles.videoOverlayContent}
              accessibilityLabel="Welcome"
              accessible
            >
              <View style={styles.heroOverlayTop}>
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
              </View>

              <View style={styles.heroOverlaySpacer} />

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
                      <LinearGradient
                        colors={[colors.primary, colors.primaryDark]}
                        locations={[0, 1]}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={StyleSheet.absoluteFillObject}
                        pointerEvents="none"
                      />
                      <View style={styles.talkToLisaHeroButtonContent}>
                        <Ionicons
                          name="chatbubble-ellipses"
                          size={22}
                          color={colors.navy}
                          accessibilityElementsHidden
                          importantForAccessibility="no-hide-descendants"
                        />
                        <Text style={styles.talkToLisaHeroButtonText}>Talk to Lisa</Text>
                      </View>
                    </AnimatedPressable>
                  </View>
                </StaggeredZoomIn>
              )}
            </View>
          </View>

          {/* ----------------------------------------------------------------
              Below hero — CTAs and content
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
                  <AnimatedPressable
                    containerStyle={styles.pressableContainer}
                    style={[styles.symptomCategoryItem, styles.symptomHistoryRowAfterLog]}
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
                    <WhatLisaNoticedCard
                      displayName={userName}
                      ageBandId={ageBandId}
                      streakDays={streak}
                      reduceMotion={reduceMotion}
                    />
                  </Animated.View>
                </StaggeredZoomIn>
                <StaggeredZoomIn delayIndex={10} reduceMotion={reduceMotion}>
                  <Animated.View layout={reduceMotion ? undefined : cardLayoutTransition}>
                    <DailyMoodHistoryCard refreshKey={moodHistoryRefreshKey} />
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
        </ScrollView>
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

  dashboardHero: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.navy,
  },
  /** When video is the hero, letterboxing uses black — not navy — so the clip reads clearly */
  dashboardHeroVideoCanvas: {
    backgroundColor: '#000000',
  },
  heroAmbientMediaWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  heroVideoBottomReadability: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '52%',
  },
  heroAmbientVideo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  dashboardHeroBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.navy,
  },
  dashboardHeroSheen: {
    ...StyleSheet.absoluteFillObject,
  },
  /**
   * Hero pink blobs — colors.primary / primaryLight (same family as CTAs & pink sections).
   * Clipped by dashboardHero overflow; z-order under content.
   */
  heroDecorBlobTopRight: {
    position: 'absolute',
    width: 228,
    height: 228,
    borderRadius: 114,
    top: -72,
    right: -64,
    backgroundColor: 'rgba(244, 124, 151, 0.1)',
  },
  heroDecorBlobMidLeft: {
    position: 'absolute',
    width: 156,
    height: 156,
    borderRadius: 78,
    left: -56,
    backgroundColor: 'rgba(249, 184, 200, 0.1)',
  },
  heroDecorBlobMidRight: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    right: 10,
    backgroundColor: 'rgba(244, 124, 151, 0.08)',
  },
  videoOverlayContent: {
    flex: 1,
    width: '100%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    flexDirection: 'column',
  },
  heroOverlayTop: {
    width: '100%',
  },
  /** Fills space between top greeting and bottom Lisa card */
  heroOverlaySpacer: {
    flex: 1,
    minHeight: 0,
  },

  talkToLisaHeroCard: {
    marginTop: 0,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(46, 42, 77, 0.55)',
    borderWidth: 1,
    ...Platform.select({
      android: {
        elevation: 0,
        borderColor: 'rgba(255, 255, 255, 0.22)',
      },
      ios: {
        ...shadows.card,
        borderColor: 'rgba(255, 255, 255, 0.2)',
      },
      web: {
        borderColor: 'rgba(255, 255, 255, 0.2)',
        boxShadow:
          '0 10px 28px rgba(46, 42, 77, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.14)',
      },
      default: {
        borderColor: 'rgba(255, 255, 255, 0.2)',
      },
    }),
  },
  talkToLisaHeroSubheading: {
    ...typography.presets.bodyMedium,
    color: colors.background,
    marginBottom: spacing.lg,
    ...(Platform.OS === 'web'
      ? { textShadow: '0 1px 2px rgba(46, 42, 77, 0.35)' }
      : {
          textShadowColor: 'rgba(46, 42, 77, 0.35)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 3,
        }),
  },
  talkToLisaHeroButton: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: minTouchTarget + spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['2xl'],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    ...shadows.buttonPrimary,
  },
  talkToLisaHeroButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    zIndex: 1,
  },
  talkToLisaHeroButtonText: {
    ...typography.presets.button,
    color: colors.navy,
    letterSpacing: 0.25,
    fontFamily: typography.display.bold,
  },

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
    backgroundColor: 'rgba(255, 255, 255, 0.70)',
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

  greeting: {
    fontSize: 24,
    fontFamily: typography.display.bold,
    color: colors.navy,
    marginBottom: spacing.xs,
    ...(Platform.OS === 'web'
      ? {
          textShadow:
            '0 0 2px rgba(249, 184, 200, 0.95), 0 1px 6px rgba(244, 124, 151, 0.7), 0 2px 16px rgba(244, 124, 151, 0.5), 0 4px 28px rgba(249, 184, 200, 0.4)',
        }
      : {
          textShadowColor: 'rgba(244, 124, 151, 0.8)',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 14,
        }),
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
    backgroundColor: 'rgba(249, 184, 200, 0.25)',
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(244, 124, 151, 0.38)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
    paddingVertical: spacing.md,
    minHeight: minTouchTarget,
  },
  /** Divider above symptom history when it sits below Log Symptom */
  symptomHistoryRowAfterLog: {
    marginTop: spacing.sm,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
