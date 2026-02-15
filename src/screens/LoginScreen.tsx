import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { getWebAppUrl } from '../lib/api';
import { logger } from '../lib/logger';
import { colors, spacing, radii, typography, shadows, minTouchTarget, landingGradient } from '../theme/tokens';
import { StaggeredZoomIn, useReduceMotion } from '../components/StaggeredZoomIn';

const FORGOT_PASSWORD_URL = getWebAppUrl('/forgot-password');

type NavigationProp = NativeStackNavigationProp<any>;

type ErrorType = 'user_not_found' | 'invalid_credentials' | 'invalid_email' | 'rate_limit' | 'network' | 'unknown' | null;

export function LoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const reduceMotion = useReduceMotion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<ErrorType>(null);
  const [loading, setLoading] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordValid = password.length >= 8;
  const canSubmit = emailValid && passwordValid && !loading;

  const handleLogin = useCallback(async () => {
    if (!canSubmit) return;

    setError(null);
    setErrorType(null);
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (authError) {
        logger.error('Login error:', authError);
        
        let friendly = 'An error occurred. Please try again.';
        let errorCategory: ErrorType = 'unknown';

        // Handle specific Supabase error messages
        if (authError.message.includes('Invalid login credentials')) {
          friendly = 'Invalid email or password. Please check your credentials and try again.';
          errorCategory = 'invalid_credentials';
        } else if (authError.message.includes('Email not confirmed')) {
          friendly = 'Please verify your email address before logging in.';
          errorCategory = 'invalid_email';
        } else if (authError.message.includes('Too many requests')) {
          friendly = 'Too many login attempts. Please wait a moment and try again.';
          errorCategory = 'rate_limit';
        } else if (authError.message.includes('User not found')) {
          friendly = "No account found with this email. Please register to create an account.";
          errorCategory = 'user_not_found';
        } else {
          friendly = authError.message;
        }

        setError(friendly);
        setErrorType(errorCategory);
        setLoading(false);
        return;
      }

      if (data.session) {
        // Login successful! Navigation will happen automatically via auth listener
        logger.log('Login successful');
      }
      
      setLoading(false);
    } catch (err: any) {
      logger.error('Unexpected login error:', err);
      
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
        setErrorType('network');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
        setErrorType('unknown');
      }
      setLoading(false);
    }
  }, [canSubmit, email, password]);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={landingGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          decelerationRate={0.98}
          scrollEventThrottle={16}
          bounces={true}
        >
          <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
            <Image
              source={require('../../assets/login.png')}
              style={styles.loginImage}
              resizeMode="contain"
            />
          </StaggeredZoomIn>
          <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
            <View style={styles.header}>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>
                We're so glad you're here. Let's get you back to your journey.
              </Text>
            </View>
          </StaggeredZoomIn>

          <StaggeredZoomIn delayIndex={2} reduceMotion={reduceMotion}>
          <View style={styles.formContainer}>
            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, !emailValid && email.length > 0 && styles.inputError]}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <View style={styles.passwordLabelRow}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity activeOpacity={1} onPress={() => Linking.openURL(FORGOT_PASSWORD_URL)}>
                  <Text style={styles.forgotLink}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput, !passwordValid && password.length > 0 && styles.inputError]}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  activeOpacity={1}
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={22}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
              {password.length > 0 && password.length < 8 && (
                <Text style={styles.helperText}>Password must be at least 8 characters</Text>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleLogin}
              disabled={!canSubmit}
            >
              <View style={styles.submitButtonInner}>
                {loading ? (
                  <>
                    <ActivityIndicator color={colors.background} />
                    <Text style={[styles.submitButtonText, !canSubmit && styles.submitButtonTextDisabled]}>
                      Signing in...
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.submitButtonText, !canSubmit && styles.submitButtonTextDisabled]}>
                    Sign in
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            {/* Error Display */}
            {error && (
              <View
                style={[
                  styles.errorContainer,
                  errorType === 'user_not_found' && styles.errorContainerInfo,
                  errorType === 'rate_limit' && styles.errorContainerWarning,
                ]}
              >
                <View style={styles.errorHeader}>
                  <Ionicons
                    name="alert-circle"
                    size={20}
                    color={
                      errorType === 'user_not_found'
                        ? '#3B82F6'
                        : errorType === 'rate_limit'
                        ? '#F59E0B'
                        : colors.danger
                    }
                  />
                  <Text
                    style={[
                      styles.errorTitle,
                      errorType === 'user_not_found' && styles.errorTitleInfo,
                      errorType === 'rate_limit' && styles.errorTitleWarning,
                    ]}
                  >
                    {errorType === 'user_not_found'
                      ? 'Account Not Found'
                      : errorType === 'rate_limit'
                      ? 'Too Many Requests'
                      : errorType === 'invalid_credentials'
                      ? 'Invalid Credentials'
                      : errorType === 'invalid_email'
                      ? 'Email Not Verified'
                      : errorType === 'network'
                      ? 'Network Error'
                      : 'Error'}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.errorText,
                    errorType === 'user_not_found' && styles.errorTextInfo,
                    errorType === 'rate_limit' && styles.errorTextWarning,
                  ]}
                >
                  {error}
                </Text>
                {errorType === 'user_not_found' && (
                  <View style={styles.errorAction}>
                    <Text style={styles.errorActionText}>Don't have an account yet?</Text>
                    <TouchableOpacity activeOpacity={1} onPress={() => navigation.navigate('Register')}>
                      <Text style={styles.errorActionLink}>Register here →</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity activeOpacity={1} onPress={() => navigation.navigate('Register')}>
                <Text style={styles.footerLink}>Sign up</Text>
              </TouchableOpacity>
            </View>
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
  loginImage: {
    width: '100%',
    maxHeight: 200,
    marginBottom: spacing.md,
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
  formContainer: {
    gap: spacing.lg,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  forgotLink: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  label: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.text,
  },
  input: {
    fontSize: 16,
    fontFamily: typography.family.regular,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.danger,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  passwordToggle: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  helperText: {
    fontSize: 12,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  submitButton: {
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    minHeight: minTouchTarget,
    justifyContent: 'center',
    marginTop: spacing.sm,
    ...shadows.buttonPrimary,
  },
  submitButtonDisabled: {
    opacity: 0.6,
    backgroundColor: '#E5E7EB',
  },
  submitButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  submitButtonText: {
    fontSize: 17,
    fontFamily: typography.family.semibold,
    color: colors.background,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  submitButtonTextDisabled: {
    color: colors.textMuted,
  },
  errorContainer: {
    backgroundColor: colors.dangerBg,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.30)',
  },
  errorContainerInfo: {
    backgroundColor: 'rgba(219, 234, 254, 0.8)',
    borderColor: 'rgba(59, 130, 246, 0.30)',
  },
  errorContainerWarning: {
    backgroundColor: 'rgba(254, 243, 199, 0.8)',
    borderColor: 'rgba(245, 158, 11, 0.30)',
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  errorTitle: {
    fontSize: 14,
    fontFamily: typography.family.semibold,
    color: colors.danger,
  },
  errorTitleInfo: {
    color: '#3B82F6',
  },
  errorTitleWarning: {
    color: '#F59E0B',
  },
  errorText: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.danger,
    lineHeight: 20,
  },
  errorTextInfo: {
    color: '#1E40AF',
  },
  errorTextWarning: {
    color: '#92400E',
  },
  errorAction: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(59, 130, 246, 0.20)',
  },
  errorActionText: {
    fontSize: 12,
    color: '#1E40AF',
    marginBottom: spacing.xs,
  },
  errorActionLink: {
    fontSize: 12,
    fontFamily: typography.family.semibold,
    color: '#3B82F6',
    textDecorationLine: 'underline',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  footerLink: {
    fontSize: 14,
    fontFamily: typography.family.semibold,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
