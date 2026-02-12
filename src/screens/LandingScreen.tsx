import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, minTouchTarget, typography, landingGradient } from '../theme/tokens';

const { width, height } = Dimensions.get('window');

export function LandingScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      decelerationRate={0.98}
      scrollEventThrottle={16}
      bounces={true}
    >
      {/* Hero Section 1 - MenoLisa */}
      <View style={styles.heroSection}>
        <LinearGradient
          colors={['#ffb4d5', '#fff5f9', '#f0f9ff', '#a6eaff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroContent}>
          <Text style={styles.mainHeadline}>
            Smart AI Coach for Women in Menopause
          </Text>
          <Text style={styles.subheadline}>Feel like yourself again</Text>

          {/* Trust copy */}
          <View style={styles.trustCard}>
            <Text style={styles.trustText}>
              Powered by{' '}
              <Text style={styles.trustBold}>
                evidence-based menopause research
              </Text>
              , your coach builds a{' '}
              <Text style={styles.trustBold}>long-term understanding</Text> of
              your symptoms and needs, while keeping every conversation{' '}
              <Text style={styles.trustBold}>fully private</Text>.
            </Text>

            {/* Badges */}
            <View style={styles.badgesContainer}>
              <View style={[styles.badge, styles.badgePink]}>
                <Text style={styles.badgeText}>Evidence informed</Text>
              </View>
              <View style={[styles.badge, styles.badgeYellow]}>
                <Text style={[styles.badgeText, styles.badgeTextDark]}>
                  Private & secure
                </Text>
              </View>
              <View style={[styles.badge, styles.badgeBlue]}>
                <Text style={styles.badgeText}>3 days free</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Hero Section 2 - MenopauseReset */}
      <View style={styles.secondHeroSection}>
        <View style={styles.secondHeroContent}>
          <View style={styles.eyebrow}>
            <Text style={styles.eyebrowText}>
              Everything you need to feel like yourself again
            </Text>
          </View>

          <Text style={styles.secondTitle}>
            Your Complete Menopause Support System
          </Text>
          <Text style={styles.secondIntro}>
            Beyond Lisa, your personal AI coach, you get a full ecosystem
            designed to help you track, understand, and manage every aspect of
            your menopause journey.
          </Text>

          {/* Feature Pills */}
          <View style={styles.pillsContainer}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>AI-Powered Coaching</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Research-informed</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Private & secure</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Track symptoms and see what Lisa notices</Text>
            </View>
          </View>

          <View style={styles.bulletsContainer}>
            <Text style={styles.bullet}>
              • Track symptoms, nutrition, and fitness in one place
            </Text>
            <Text style={styles.bullet}>
              • Get weekly notes from Lisa based on your tracking
            </Text>
            <Text style={styles.bullet}>
              • Access research-informed guidance anytime, anywhere
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// First screen for non-registered users: full height, Duolingo-style layout
type AuthStackNav = { Landing: undefined; Register: undefined; Login: undefined };

const AnimatedImage = Animated.createAnimatedComponent(Image);

export function LandingScreenWithButton() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackNav, 'Landing'>>();
  const spinValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(spinValue, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(scaleValue, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
        ]),
        Animated.parallel([
          Animated.timing(spinValue, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(scaleValue, {
            toValue: 0.4,
            duration: 2000,
            useNativeDriver: true,
            easing: Easing.in(Easing.cubic),
          }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [spinValue, scaleValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={landingStyles.wrapper}>
      <LinearGradient
        colors={landingGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={landingStyles.container} edges={['top', 'bottom']}>
        {/* Central content: logo, brand, tagline */}
        <View style={landingStyles.centralContent}>
          <View style={landingStyles.logoContainer}>
            <AnimatedImage
              source={require('../../assets/logo.png')}
              style={[
                landingStyles.logo,
                {
                  transform: [{ rotate: spin }, { scale: scaleValue }],
                },
              ]}
              resizeMode="contain"
            />
          </View>
          <Text style={landingStyles.brandName}>MenoLisa</Text>
          <Text style={landingStyles.tagline}>
            Navigate menopause with confidence. Your journey, our support.
          </Text>
        </View>

        {/* Bottom CTAs */}
        <View style={landingStyles.ctaSection}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={landingStyles.primaryButton}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={landingStyles.primaryButtonText}>GET STARTED</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            style={landingStyles.secondaryButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={landingStyles.secondaryButtonText}>I ALREADY HAVE AN ACCOUNT</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const landingStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
    minHeight: height,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
  },
  centralContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing['2xl'],
  },
  logoContainer: {
    width: width * 0.5,
    maxWidth: 200,
    aspectRatio: 1,
    marginBottom: spacing['2xl'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  brandName: {
    fontFamily: typography.family.bold,
    fontSize: 34,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
    letterSpacing: 0.5,
  },
  tagline: {
    fontFamily: typography.family.regular,
    fontSize: 18,
    lineHeight: 26,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 320,
  },
  ctaSection: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    minHeight: minTouchTarget,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 4,
    elevation: 5,
  },
  primaryButtonText: {
    fontFamily: typography.family.semibold,
    fontSize: 17,
    letterSpacing: 0.5,
    color: colors.background,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    minHeight: minTouchTarget,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.textMuted,
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 4,
    elevation: 5,
  },
  secondaryButtonText: {
    fontFamily: typography.family.medium,
    fontSize: 16,
    letterSpacing: 0.3,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    paddingBottom: 100,
  },
  heroSection: {
    minHeight: 600,
    paddingTop: 60,
    paddingBottom: 40,
    position: 'relative',
  },
  heroContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
    zIndex: 1,
  },
  mainHeadline: {
    fontFamily: typography.family.bold,
    fontSize: 32,
    textAlign: 'center',
    color: '#1F2937',
    marginBottom: 16,
    paddingHorizontal: 10,
    lineHeight: 40,
  },
  subheadline: {
    fontFamily: typography.family.medium,
    fontSize: 24,
    textAlign: 'center',
    color: '#1D3557',
    opacity: 0.7,
    marginBottom: 30,
    fontStyle: 'italic',
  },
  trustCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 24,
    padding: 20,
    marginTop: 20,
    width: width - 40,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  trustText: {
    fontFamily: typography.family.regular,
    fontSize: 14,
    lineHeight: 22,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  trustBold: {
    fontFamily: typography.family.semibold,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    margin: 4,
  },
  badgePink: {
    backgroundColor: colors.primary,
  },
  badgeYellow: {
    backgroundColor: '#ffeb76',
  },
  badgeBlue: {
    backgroundColor: '#65dbff',
  },
  badgeText: {
    fontFamily: typography.family.medium,
    color: '#fff',
    fontSize: 12,
  },
  badgeTextDark: {
    color: '#1D3557',
  },
  secondHeroSection: {
    backgroundColor: '#FDF2F8',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  secondHeroContent: {
    alignItems: 'center',
  },
  eyebrow: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 141, 161, 0.3)',
  },
  eyebrowText: {
    fontFamily: typography.family.semibold,
    fontSize: 11,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secondTitle: {
    fontFamily: typography.family.semibold,
    fontSize: 28,
    textAlign: 'center',
    color: '#1D3557',
    marginBottom: 16,
    lineHeight: 36,
  },
  secondIntro: {
    fontFamily: typography.family.regular,
    fontSize: 16,
    textAlign: 'center',
    color: '#1D3557',
    opacity: 0.7,
    marginBottom: 24,
    lineHeight: 24,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 32,
  },
  pill: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 141, 161, 0.3)',
    margin: 4,
  },
  pillText: {
    fontFamily: typography.family.medium,
    fontSize: 12,
    color: '#1D3557',
  },
  bulletsContainer: {
    width: '100%',
    maxWidth: 400,
  },
  bullet: {
    fontFamily: typography.family.regular,
    fontSize: 16,
    color: '#1D3557',
    marginBottom: 12,
    lineHeight: 24,
  },
});
