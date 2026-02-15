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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, minTouchTarget, typography, landingGradient, shadows } from '../theme/tokens';
import { StaggeredZoomIn, useReduceMotion } from '../components/StaggeredZoomIn';

const { width, height } = Dimensions.get('window');

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
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
          <View style={styles.centralContent}>
            <View style={styles.logoContainer}>
              <AnimatedImage
                source={require('../../assets/logo_transparent.png')}
                style={[
                  styles.logo,
                  {
                    transform: [{ rotate: spin }, { scale: scaleValue }],
                  },
                ]}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandName}>MenoLisa</Text>
            <Text style={styles.tagline}>
              Navigate menopause with confidence. Your journey, our support.
            </Text>
            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimerText}>
                For information only. Not medical advice.
              </Text>
            </View>
          </View>
        </StaggeredZoomIn>

        <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
        <View style={styles.ctaSection}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.primaryButtonText}>GET STARTED</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.secondaryButtonText}>I ALREADY HAVE AN ACCOUNT</Text>
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
  disclaimerBox: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(220, 38, 38, 0.18)',
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: radii.md,
    alignSelf: 'stretch',
    maxWidth: 320,
  },
  disclaimerText: {
    fontSize: 12,
    fontFamily: typography.family.semibold,
    color: '#B91C1C',
    textAlign: 'center',
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
    ...shadows.buttonPrimary,
  },
  primaryButtonText: {
    fontFamily: typography.family.semibold,
    fontSize: 17,
    letterSpacing: 0.5,
    color: colors.background,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    backgroundColor: colors.background,
    minHeight: minTouchTarget,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.textMuted,
    ...shadows.buttonPrimary,
  },
  secondaryButtonText: {
    fontFamily: typography.family.medium,
    fontSize: 16,
    letterSpacing: 0.3,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
});
