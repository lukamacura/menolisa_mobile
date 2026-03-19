import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, minTouchTarget, typography, landingGradient, shadows } from '../theme/tokens';
import { StaggeredZoomIn, useReduceMotion } from '../components/StaggeredZoomIn';

const { width } = Dimensions.get('window');

const CONTENT_MAX_WIDTH = 340;
const HORIZONTAL_PADDING = spacing.xl;

type AuthStackNav = { Landing: undefined; Register: undefined; Login: undefined };

export function LandingScreenWithButton() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackNav, 'Landing'>>();
  const reduceMotion = useReduceMotion();

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={landingGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Hero */}
        <View style={styles.hero}>
          <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
            <View style={styles.imageWrap}>
              <Image
                source={require('../../assets/paywall.png')}
                style={styles.heroImage}
                resizeMode="contain"
              />
            </View>
          </StaggeredZoomIn>

          <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
            <Text style={styles.brandName}>MenoLisa</Text>
          </StaggeredZoomIn>

          <StaggeredZoomIn delayIndex={2} reduceMotion={reduceMotion}>
            <Text style={styles.tagline}>
              Navigate menopause with confidence.{'\n'}Your journey, our support.
            </Text>
          </StaggeredZoomIn>
        </View>

        {/* CTA */}
        <StaggeredZoomIn delayIndex={3} reduceMotion={reduceMotion}>
          <View style={styles.ctaSection}>
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
        </StaggeredZoomIn>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: HORIZONTAL_PADDING,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xl,
  },
  imageWrap: {
    width: width * 0.72,
    maxWidth: 280,
    aspectRatio: 1,
    marginBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: {
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
  },
  tagline: {
    fontFamily: typography.family.regular,
    fontSize: 17,
    lineHeight: 26,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: CONTENT_MAX_WIDTH,
  },
  ctaSection: {
    paddingBottom: spacing.lg,
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
  },
});
