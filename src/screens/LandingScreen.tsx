import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, minTouchTarget, typography, landingGradient, shadows } from '../theme/tokens';
import { StaggeredZoomIn, useReduceMotion } from '../components/StaggeredZoomIn';
import { getWebAppUrl } from '../lib/api';
import { logger } from '../lib/logger';

const CONTENT_MAX_WIDTH = 340;
const HORIZONTAL_PADDING = spacing.xl;
const LOGO_WIDTH = 240;
const LOGO_HEIGHT = 160;

const logoSource = require('../../assets/logo_transparent.png');

type AuthStackNav = { Landing: undefined; Login: undefined };

export function LandingScreenWithButton() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackNav, 'Landing'>>();
  const reduceMotion = useReduceMotion();

  const handleOpenWebRegister = () => {
    const url = getWebAppUrl('/register');
    Linking.openURL(url).catch((err) => logger.warn('Failed to open web register', err));
  };

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
            <Image
              source={logoSource}
              style={styles.logo}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel="MenoLisa"
            />
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
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.primaryButtonText}>Sign in</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleOpenWebRegister}
              style={styles.webLinkRow}
              accessibilityRole="link"
              accessibilityLabel="Create your account at menolisa.com"
            >
              <Text style={styles.webLinkText}>
                New to Menolisa?{' '}
                <Text style={styles.webLinkHighlight}>Create your account at menolisa.com</Text>
              </Text>
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
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
    marginBottom: spacing.md,
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
  webLinkRow: {
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  webLinkText: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
  },
  webLinkHighlight: {
    ...typography.presets.bodySmall,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
