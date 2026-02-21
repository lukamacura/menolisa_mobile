import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, minTouchTarget, typography, landingGradient, shadows } from '../theme/tokens';
import { StaggeredZoomIn, useReduceMotion } from '../components/StaggeredZoomIn';

const { width, height } = Dimensions.get('window');

/** Max width for content column – keeps layout centered and readable on large screens */
const CONTENT_MAX_WIDTH = 320;
const HORIZONTAL_PADDING = spacing.xl;

const AnimatedImage = Animated.createAnimatedComponent(Image);

type AuthStackNav = { Landing: undefined; Register: undefined; Login: undefined };

export function LandingScreenWithButton() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackNav, 'Landing'>>();
  const reduceMotion = useReduceMotion();
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
          Animated.timing(spinValue, { toValue: 0, duration: 0, useNativeDriver: true }),
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
    <View style={styles.wrapper}>
      <LinearGradient
        colors={landingGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero block – logo, brand, tagline, disclaimer – all centered */}
          <View style={styles.hero}>
            <View style={styles.contentColumn}>
              <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
                <View style={styles.logoWrap}>
                  <AnimatedImage
                    source={require('../../assets/logo_transparent.png')}
                    style={[styles.logo, { transform: [{ rotate: spin }, { scale: scaleValue }] }]}
                    resizeMode="contain"
                  />
                </View>
              </StaggeredZoomIn>
              <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
                <Text style={styles.brandName}>MenoLisa</Text>
              </StaggeredZoomIn>
              <StaggeredZoomIn delayIndex={2} reduceMotion={reduceMotion}>
                <Text style={styles.tagline}>
                  Navigate menopause with confidence. Your journey, our support.
                </Text>
              </StaggeredZoomIn>
              <StaggeredZoomIn delayIndex={3} reduceMotion={reduceMotion}>
                <View style={styles.disclaimerWrap}>
                  <Text style={styles.disclaimerText}>
                    For information only. Not medical advice.
                  </Text>
                </View>
              </StaggeredZoomIn>
            </View>
          </View>

          {/* CTA block – centered, fixed width */}
          <StaggeredZoomIn delayIndex={4} reduceMotion={reduceMotion}>
            <View style={styles.ctaSection}>
              <View style={styles.ctaColumn}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.primaryButton}
                  onPress={() => navigation.navigate('Register')}
                >
                  <Text style={styles.primaryButtonText}>Get started</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.secondaryButton}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={styles.secondaryButtonText}>I already have an account</Text>
                </TouchableOpacity>
              </View>
            </View>
          </StaggeredZoomIn>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    minHeight: height,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.xl,
    justifyContent: 'space-between',
    minHeight: height,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  contentColumn: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: width * 0.42,
    maxWidth: 160,
    aspectRatio: 1,
    marginBottom: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  brandName: {
    fontFamily: typography.display.bold,
    fontSize: 32,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tagline: {
    fontFamily: typography.family.regular,
    fontSize: 17,
    lineHeight: 26,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  disclaimerWrap: {
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.35)',
    borderRadius: radii.md,
    alignSelf: 'stretch',
  },
  disclaimerText: {
    fontSize: 12,
    fontFamily: typography.family.semibold,
    color: colors.danger,
    textAlign: 'center',
  },
  ctaSection: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  ctaColumn: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    gap: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    minHeight: minTouchTarget + 4,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.buttonPrimary,
  },
  primaryButtonText: {
    fontFamily: typography.display.semibold,
    fontSize: 17,
    letterSpacing: 0.5,
    color: colors.background,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    backgroundColor: colors.background,
    minHeight: minTouchTarget + 4,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.borderStrong,
    ...shadows.buttonPrimary,
  },
  secondaryButtonText: {
    fontFamily: typography.display.semibold,
    fontSize: 16,
    letterSpacing: 0.3,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
});
