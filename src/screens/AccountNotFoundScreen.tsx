import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radii, typography, shadows, minTouchTarget, landingGradient } from '../theme/tokens';
import { StaggeredZoomIn, useReduceMotion } from '../components/StaggeredZoomIn';
import { getWebAppUrl } from '../lib/api';
import { logger } from '../lib/logger';
import type { AuthStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'AccountNotFound'>;
type RouteParams = RouteProp<AuthStackParamList, 'AccountNotFound'>;

export function AccountNotFoundScreen() {
  const reduceMotion = useReduceMotion();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteParams>();
  const email = route.params?.email ?? '';

  const handleRegisterOnWeb = useCallback(() => {
    const url = getWebAppUrl('/register');
    Linking.openURL(url).catch((err) => logger.warn('Failed to open web register', err));
  }, []);

  const handleUseDifferentEmail = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient
        colors={landingGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
            <View style={styles.imageWrap}>
              <Image
                source={require('../../assets/quiz/illustration_email.png')}
                style={styles.image}
                resizeMode="contain"
                accessibilityLabel="Illustration of an envelope"
              />
            </View>
          </StaggeredZoomIn>

          <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
            <View style={styles.header}>
              <Text style={styles.title}>We don't see you yet</Text>
              <Text style={styles.subtitle}>
                We couldn't find an account for{' '}
                <Text style={styles.subtitleEmail}>{email}</Text>. Finish signing up on the web to get started.
              </Text>
            </View>
          </StaggeredZoomIn>

          <StaggeredZoomIn delayIndex={2} reduceMotion={reduceMotion}>
            <View style={styles.actions}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.primaryButton}
                onPress={handleRegisterOnWeb}
              >
                <Text style={styles.primaryButtonText}>Register on web</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleUseDifferentEmail}
                style={styles.secondaryLinkWrap}
              >
                <Text style={styles.secondaryLink}>Use a different email</Text>
              </TouchableOpacity>
            </View>
          </StaggeredZoomIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['2xl'],
  },
  imageWrap: {
    width: '100%',
    height: 180,
    marginBottom: spacing.md,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  header: {
    marginBottom: spacing['2xl'],
  },
  title: {
    fontSize: 32,
    fontFamily: typography.family.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    lineHeight: 24,
  },
  subtitleEmail: {
    fontFamily: typography.family.semibold,
    color: colors.text,
  },
  actions: {
    gap: spacing.lg,
  },
  primaryButton: {
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    minHeight: minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    ...shadows.buttonPrimary,
  },
  primaryButtonText: {
    fontSize: 17,
    fontFamily: typography.display.semibold,
    color: colors.background,
    letterSpacing: 0.5,
  },
  secondaryLinkWrap: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  secondaryLink: {
    fontSize: 15,
    fontFamily: typography.family.medium,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
