import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget, shadows, landingGradient } from '../theme/tokens';
import { openAccountBillingEntry } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { logger } from '../lib/logger';
import type { AccountStatus } from '../lib/accountStatus';

type Copy = { heading: string; subheading: string; cta: string };

function getCopy(status: AccountStatus | null): Copy {
  if (status?.account_status === 'pending_payment') {
    return {
      heading: 'Finish setting up your subscription',
      subheading:
        "You're almost there. Continue on menolisa.com to add your card and unlock your dashboard.",
      cta: 'Continue on menolisa.com',
    };
  }
  return {
    heading: 'Your subscription has ended',
    subheading:
      'Manage your subscription on menolisa.com to keep using MenoLisa and your insights.',
    cta: 'Manage on menolisa.com',
  };
}

export function SubscriptionRequiredScreen() {
  const { accountStatus, refetchAccountStatus, signOut } = useAuth();
  const [opening, setOpening] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const copy = getCopy(accountStatus);

  const handleOpenWeb = useCallback(async () => {
    if (opening) return;
    setOpening(true);
    try {
      await openAccountBillingEntry();
    } catch (err) {
      logger.warn('Open billing entry failed', err);
      Alert.alert('Could not open menolisa.com', 'Please try again or open menolisa.com in your browser.');
    } finally {
      setOpening(false);
    }
  }, [opening]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refetchAccountStatus();
    } catch (err) {
      logger.warn('Refresh account status failed', err);
    } finally {
      setRefreshing(false);
    }
  }, [refetchAccountStatus, refreshing]);

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }, [signOut, signingOut]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient
        colors={landingGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          <Image
            source={require('../../assets/paywall.png')}
            style={styles.heroImage}
            resizeMode="contain"
            accessibilityLabel="Lisa"
          />
        </View>

        <Text style={styles.heading}>{copy.heading}</Text>
        <Text style={styles.subheading}>{copy.subheading}</Text>

        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.primaryButton, opening && styles.primaryButtonDisabled]}
          onPress={handleOpenWeb}
          disabled={opening}
          accessibilityRole="button"
          accessibilityLabel={copy.cta}
        >
          {opening ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>{copy.cta}</Text>
              <Ionicons name="open-outline" size={18} color={colors.background} />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.secondaryButton}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          <Text style={styles.secondaryButtonText}>
            {refreshing ? 'Checking…' : "I've completed checkout — refresh"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.signOutButton}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          <Text style={styles.signOutText}>{signingOut ? 'Signing out…' : 'Sign out'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['2xl'],
    alignItems: 'center',
  },
  heroWrap: {
    width: '100%',
    height: 220,
    marginBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heading: {
    ...typography.presets.heading1,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subheading: {
    ...typography.presets.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
    paddingHorizontal: spacing.sm,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    minHeight: minTouchTarget + 8,
    width: '100%',
    ...shadows.buttonPrimary,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    ...typography.presets.button,
    color: colors.background,
  },
  secondaryButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: minTouchTarget,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...typography.presets.buttonSmall,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  signOutButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: minTouchTarget,
    justifyContent: 'center',
  },
  signOutText: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
