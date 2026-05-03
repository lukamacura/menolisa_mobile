import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { getWebAppUrl, API_CONFIG } from '../lib/api';

const REVIEWER_EMAILS = new Set<string>(['luka.xzy@gmail.com']);
import { colors, spacing, radii, typography, shadows, minTouchTarget, landingGradient } from '../theme/tokens';
import { StaggeredZoomIn, useReduceMotion } from '../components/StaggeredZoomIn';

type Mode = 'email' | 'code';
type ErrorType = 'no_account' | 'invalid_code' | 'rate_limit' | 'network' | 'unknown' | null;

const RESEND_COOLDOWN_SECONDS = 60;
const CODE_LENGTH = 6;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginScreen() {
  const reduceMotion = useReduceMotion();
  const [mode, setMode] = useState<Mode>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<ErrorType>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeInputRef = useRef<TextInput | null>(null);

  // Countdown for resend cooldown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Auto-focus code field when entering code step
  useEffect(() => {
    if (mode === 'code') {
      const t = setTimeout(() => codeInputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [mode]);

  const emailValid = EMAIL_REGEX.test(email);
  const codeValid = /^\d{6}$/.test(code);

  const sendOtp = useCallback(async (targetEmail: string) => {
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: { shouldCreateUser: false },
    });
    return otpError;
  }, []);

  const handleRequestCode = useCallback(async () => {
    if (!emailValid || loading) return;
    setLoading(true);
    setError(null);
    setErrorType(null);
    try {
      const targetEmail = email.toLowerCase().trim();

      if (REVIEWER_EMAILS.has(targetEmail)) {
        try {
          const res = await fetch(`${API_CONFIG.baseURL}/api/auth/reviewer-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: targetEmail }),
          });
          if (res.ok) {
            const { token_hash } = await res.json();
            const { error: verifyError } = await supabase.auth.verifyOtp({
              token_hash,
              type: 'magiclink',
            });
            if (verifyError) {
              logger.error('reviewer verifyOtp error:', verifyError);
              setError(verifyError.message || 'Could not sign in. Please try again.');
              setErrorType('unknown');
              return;
            }
            return;
          }
          logger.warn('reviewer-login non-OK status', res.status);
        } catch (bypassErr) {
          logger.warn('reviewer-login bypass failed, falling back to OTP', bypassErr);
        }
      }

      const otpError = await sendOtp(targetEmail);
      if (otpError) {
        const msg = otpError.message || '';
        if (
          msg.includes('Signups not allowed') ||
          msg.toLowerCase().includes('user not found') ||
          msg.toLowerCase().includes('not found')
        ) {
          setError("We couldn't find an account for this email.");
          setErrorType('no_account');
        } else if (msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('too many')) {
          setError('Too many requests. Please wait a moment and try again.');
          setErrorType('rate_limit');
        } else {
          setError(msg || 'Could not send code. Please try again.');
          setErrorType('unknown');
        }
        return;
      }
      setMode('code');
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      logger.error('signInWithOtp error:', err);
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Network') || msg.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
        setErrorType('network');
      } else {
        setError('Something went wrong. Please try again.');
        setErrorType('unknown');
      }
    } finally {
      setLoading(false);
    }
  }, [email, emailValid, loading, sendOtp]);

  const handleVerifyCode = useCallback(async () => {
    if (!codeValid || loading) return;
    setLoading(true);
    setError(null);
    setErrorType(null);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.toLowerCase().trim(),
        token: code,
        type: 'email',
      });
      if (verifyError) {
        const msg = verifyError.message || '';
        if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid')) {
          setError('That code is invalid or expired. Please request a new one.');
          setErrorType('invalid_code');
        } else {
          setError(msg || 'Could not verify code. Please try again.');
          setErrorType('unknown');
        }
        return;
      }
      // Success — auth listener picks up the session and AppNavigator routes accordingly.
    } catch (err) {
      logger.error('verifyOtp error:', err);
      setError('Something went wrong verifying your code. Please try again.');
      setErrorType('unknown');
    } finally {
      setLoading(false);
    }
  }, [code, codeValid, email, loading]);

  const handleResend = useCallback(async () => {
    if (resendIn > 0 || loading) return;
    setError(null);
    setErrorType(null);
    setLoading(true);
    try {
      const otpError = await sendOtp(email.toLowerCase().trim());
      if (otpError) {
        setError(otpError.message || 'Could not resend code.');
        setErrorType('unknown');
        return;
      }
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } finally {
      setLoading(false);
    }
  }, [email, loading, resendIn, sendOtp]);

  const handleOpenWebRegister = useCallback(() => {
    const url = getWebAppUrl('/register');
    Linking.openURL(url).catch((err) => logger.warn('Failed to open web register', err));
  }, []);

  const handleEditEmail = useCallback(() => {
    setMode('email');
    setCode('');
    setError(null);
    setErrorType(null);
  }, []);

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
            <View style={styles.loginImageWrap}>
              <Image
                source={require('../../assets/quiz/illustration_email.png')}
                style={styles.loginImage}
                resizeMode="contain"
                accessibilityLabel="Illustration of an envelope"
              />
            </View>
          </StaggeredZoomIn>

          <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
            <View style={styles.header}>
              <Text style={styles.title}>
                {mode === 'email' ? 'Welcome back' : 'Check your inbox'}
              </Text>
              <Text style={styles.subtitle}>
                {mode === 'email'
                  ? "Enter your email and we'll send you a 6-digit code to sign in."
                  : `We sent a 6-digit code to ${email.toLowerCase().trim()}.`}
              </Text>
            </View>
          </StaggeredZoomIn>

          <StaggeredZoomIn delayIndex={2} reduceMotion={reduceMotion}>
            <View style={styles.formContainer}>
              {mode === 'email' ? (
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
                    returnKeyType="send"
                    onSubmitEditing={handleRequestCode}
                    editable={!loading}
                  />
                </View>
              ) : (
                <View style={styles.inputGroup}>
                  <View style={styles.codeLabelRow}>
                    <Text style={styles.label}>6-digit code</Text>
                    <TouchableOpacity activeOpacity={0.7} onPress={handleEditEmail} disabled={loading}>
                      <Text style={styles.editEmailLink}>Change email</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    ref={codeInputRef}
                    style={[styles.input, styles.codeInput, !codeValid && code.length > 0 && styles.inputError]}
                    placeholder="123456"
                    placeholderTextColor={colors.textMuted}
                    value={code}
                    onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, CODE_LENGTH))}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    maxLength={CODE_LENGTH}
                    returnKeyType="done"
                    onSubmitEditing={handleVerifyCode}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleResend}
                    disabled={resendIn > 0 || loading}
                    style={styles.resendRow}
                  >
                    <Text style={[styles.resendText, (resendIn > 0 || loading) && styles.resendTextDisabled]}>
                      {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                activeOpacity={1}
                style={[
                  styles.submitButton,
                  ((mode === 'email' && (!emailValid || loading)) ||
                    (mode === 'code' && (!codeValid || loading))) &&
                    styles.submitButtonDisabled,
                ]}
                onPress={mode === 'email' ? handleRequestCode : handleVerifyCode}
                disabled={
                  (mode === 'email' && (!emailValid || loading)) ||
                  (mode === 'code' && (!codeValid || loading))
                }
              >
                <View style={styles.submitButtonInner}>
                  {loading ? (
                    <>
                      <ActivityIndicator color={colors.background} />
                      <Text style={styles.submitButtonText}>
                        {mode === 'email' ? 'Sending code…' : 'Verifying…'}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {mode === 'email' ? 'Send code' : 'Sign in'}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>

              {error && (
                <View
                  style={[
                    styles.errorContainer,
                    errorType === 'no_account' && styles.errorContainerInfo,
                    errorType === 'rate_limit' && styles.errorContainerWarning,
                  ]}
                >
                  <View style={styles.errorHeader}>
                    <Ionicons
                      name="alert-circle"
                      size={20}
                      color={
                        errorType === 'no_account'
                          ? colors.info
                          : errorType === 'rate_limit'
                          ? colors.warning
                          : colors.danger
                      }
                    />
                    <Text
                      style={[
                        styles.errorTitle,
                        errorType === 'no_account' && styles.errorTitleInfo,
                        errorType === 'rate_limit' && styles.errorTitleWarning,
                      ]}
                    >
                      {errorType === 'no_account'
                        ? 'Account not found'
                        : errorType === 'rate_limit'
                        ? 'Too many requests'
                        : errorType === 'invalid_code'
                        ? 'Invalid code'
                        : errorType === 'network'
                        ? 'Network error'
                        : 'Error'}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.errorText,
                      errorType === 'no_account' && styles.errorTextInfo,
                      errorType === 'rate_limit' && styles.errorTextWarning,
                    ]}
                  >
                    {error}
                  </Text>
                  {errorType === 'no_account' && (
                    <View style={styles.errorAction}>
                      <Text style={styles.errorActionText}>New to Menolisa?</Text>
                      <TouchableOpacity activeOpacity={0.7} onPress={handleOpenWebRegister}>
                        <Text style={styles.errorActionLink}>Create your account at menolisa.com →</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
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
  loginImageWrap: {
    width: '100%',
    height: 180,
    marginBottom: spacing.md,
  },
  loginImage: {
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
  formContainer: {
    gap: spacing.lg,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  codeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editEmailLink: {
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
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  codeInput: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    fontFamily: typography.family.semibold,
  },
  inputError: {
    borderColor: colors.danger,
  },
  resendRow: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  resendText: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.primary,
  },
  resendTextDisabled: {
    color: colors.textMuted,
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
    backgroundColor: colors.borderStrong,
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
    fontFamily: typography.display.semibold,
    color: colors.background,
    letterSpacing: 0.5,
  },
  errorContainer: {
    backgroundColor: colors.dangerBg,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(200, 58, 84, 0.30)',
  },
  errorContainerInfo: {
    backgroundColor: colors.infoBg,
    borderColor: 'rgba(75, 141, 248, 0.30)',
  },
  errorContainerWarning: {
    backgroundColor: colors.warningBg,
    borderColor: 'rgba(217, 138, 31, 0.30)',
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
    color: colors.info,
  },
  errorTitleWarning: {
    color: colors.warning,
  },
  errorText: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.danger,
    lineHeight: 20,
  },
  errorTextInfo: {
    color: colors.info,
  },
  errorTextWarning: {
    color: colors.warning,
  },
  errorAction: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(75, 141, 248, 0.20)',
  },
  errorActionText: {
    fontSize: 12,
    color: colors.info,
    marginBottom: spacing.xs,
  },
  errorActionLink: {
    fontSize: 12,
    fontFamily: typography.family.semibold,
    color: colors.info,
    textDecorationLine: 'underline',
  },
});
