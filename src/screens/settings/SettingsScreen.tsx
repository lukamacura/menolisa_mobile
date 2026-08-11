import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { RefetchTrialContext } from '../../context/RefetchTrialContext';
import { deleteAccount, getWebAppUrl, openAccountBillingEntry } from '../../lib/api';
import { useTrialStatus } from '../../hooks/useTrialStatus';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';

type SettingsStackParamList = {
  Settings: undefined;
  NotificationPrefs: undefined;
};
type NavProp = NativeStackNavigationProp<SettingsStackParamList, 'Settings'>;

export function SettingsScreen() {
  const navigation = useNavigation<NavProp>();
  const { signOut } = useAuth();
  const refetchTrialRef = useContext(RefetchTrialContext);
  const trialStatus = useTrialStatus();
  const reduceMotion = useReduceMotion();
  const [actionLoading, setActionLoading] = useState<'delete' | null>(null);

  useEffect(() => {
    if (refetchTrialRef) refetchTrialRef.current = trialStatus.refetch;
    return () => {
      if (refetchTrialRef) refetchTrialRef.current = null;
    };
  }, [refetchTrialRef, trialStatus.refetch]);

  useFocusEffect(
    useCallback(() => {
      trialStatus.refetch().catch(() => {});
    }, [trialStatus.refetch])
  );

  const handleLogout = async () => {
    await signOut();
  };

  const runDeleteAccount = useCallback(async () => {
    setActionLoading('delete');
    try {
      await deleteAccount();
      await signOut();
    } catch (e) {
      setActionLoading(null);
      const message = e instanceof Error ? e.message : 'Could not delete account. Please try again.';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    }
  }, [signOut]);

  const handleDeleteAccount = useCallback(() => {
    const title = 'Delete account';
    const message =
      'Are you sure? This will permanently delete your account and all your data. You will need to sign up again to use MenoLisa.';

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) runDeleteAccount();
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete account',
        style: 'destructive',
        onPress: runDeleteAccount,
      },
    ]);
  }, [runDeleteAccount]);

  // Same on every platform: IAP is gone, Stripe on the web is the only billing path.
  // This must never open the paywall — it is reached by subscribers with active access.
  const handleOpenAccountWeb = useCallback(async () => {
    try {
      await openAccountBillingEntry();
    } catch (e) {
      Alert.alert(
        'Open account',
        e instanceof Error ? e.message : 'Could not open account options. Please try again.'
      );
    }
  }, []);

  const openPrivacyPolicy = () => {
    Linking.openURL(getWebAppUrl('/privacy'));
  };

  const openTermsOfUse = () => {
    Linking.openURL(getWebAppUrl('/terms'));
  };

  const getStatusLabel = () => {
    if (trialStatus.loading) return 'Loading…';

    const dateStr = trialStatus.end
      ? trialStatus.end.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null;

    switch (trialStatus.state) {
      case 'active':
        return dateStr ? `Subscriber • Renews ${dateStr}` : 'Subscriber • Active';
      case 'canceling':
        return dateStr ? `Subscriber • Access until ${dateStr}` : 'Subscriber • Canceling';
      case 'past_due':
        return 'Payment failed • Update your card on menolisa.com';
      case 'disputed':
        return 'Access paused • Contact support';
      case 'ended':
        return 'No active subscription';
      default:
        return 'No active subscription';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
            <View style={styles.statusCard}>
              <View style={styles.statusIconWrap}>
                <Ionicons name="card-outline" size={20} color={colors.textMuted} />
              </View>
              <View style={styles.statusLabelWrap}>
                <Text style={styles.statusLabel}>{getStatusLabel()}</Text>
              </View>
            </View>
          </StaggeredZoomIn>
          <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.row, styles.manageAccountRow]}
              onPress={handleOpenAccountWeb}
            >
              <Ionicons name="globe-outline" size={22} color={colors.success} />
              <View style={styles.rowTextWrap}>
                <Text style={styles.manageAccountRowLabel}>Manage subscription</Text>
                <Text style={styles.manageAccountRowSubtext}>
                  Plan and subscription options on the website
                </Text>
              </View>
              <Ionicons name="open-outline" size={18} color={colors.success} />
            </TouchableOpacity>
          </StaggeredZoomIn>
        </View>

        <View style={styles.section}>
          <StaggeredZoomIn delayIndex={2} reduceMotion={reduceMotion}>
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.row, styles.blueRow]}
              onPress={() => navigation.navigate('NotificationPrefs')}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.blue} />
              <Text style={styles.blueRowLabel}>Notification preferences</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.blue} />
            </TouchableOpacity>
          </StaggeredZoomIn>
          <StaggeredZoomIn delayIndex={3} reduceMotion={reduceMotion}>
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.row, styles.goldRow]}
              onPress={openPrivacyPolicy}
            >
              <Ionicons name="document-text-outline" size={22} color={colors.navy} />
              <Text style={styles.goldRowLabel}>Privacy Policy</Text>
              <Ionicons name="open-outline" size={18} color={colors.navy} />
            </TouchableOpacity>
          </StaggeredZoomIn>
          <StaggeredZoomIn delayIndex={4} reduceMotion={reduceMotion}>
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.row, styles.goldRow]}
              onPress={openTermsOfUse}
            >
              <Ionicons name="document-text-outline" size={22} color={colors.navy} />
              <Text style={styles.goldRowLabel}>Terms of Use</Text>
              <Ionicons name="open-outline" size={18} color={colors.navy} />
            </TouchableOpacity>
          </StaggeredZoomIn>
          <StaggeredZoomIn delayIndex={5} reduceMotion={reduceMotion}>
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.row, styles.logoutRow]}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={22} color={colors.danger} />
              <Text style={styles.logoutLabel}>Log out</Text>
            </TouchableOpacity>
          </StaggeredZoomIn>
          <StaggeredZoomIn delayIndex={6} reduceMotion={reduceMotion}>
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.row, styles.deleteAccountRow]}
              onPress={handleDeleteAccount}
              disabled={actionLoading === 'delete'}
            >
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
              <View style={styles.rowTextWrap}>
                <Text style={styles.deleteAccountLabel}>Delete account</Text>
                <Text style={styles.deleteAccountSubtext}>Permanently remove your account and data</Text>
              </View>
              {actionLoading === 'delete' ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <Ionicons name="warning-outline" size={20} color={colors.danger} />
              )}
            </TouchableOpacity>
          </StaggeredZoomIn>
        </View>

        <StaggeredZoomIn delayIndex={7} reduceMotion={reduceMotion}>
          <Text style={styles.disclaimer}>
            MenoLisa is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider.
          </Text>
        </StaggeredZoomIn>
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
    paddingBottom: spacing['2xl'],
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusIconWrap: {
    paddingTop: 1,
  },
  statusLabelWrap: {
    flex: 1,
    minWidth: 0,
  },
  statusLabel: {
    fontSize: 15,
    fontFamily: typography.family.medium,
    color: colors.text,
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  rowTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 16,
    fontFamily: typography.family.medium,
    color: colors.text,
  },
  rowSubtext: {
    fontSize: 12,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    marginTop: 2,
  },
  manageAccountRow: {
    backgroundColor: colors.successBg,
    borderColor: 'rgba(34, 160, 107, 0.45)',
  },
  manageAccountRowLabel: {
    fontSize: 16,
    fontFamily: typography.family.medium,
    color: colors.text,
  },
  manageAccountRowSubtext: {
    fontSize: 12,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    marginTop: 2,
  },
  blueRow: {
    backgroundColor: colors.rowBlueBg,
    borderColor: 'rgba(58, 191, 163, 0.60)',
  },
  blueRowLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: typography.family.medium,
    color: colors.text,
  },
  goldRow: {
    backgroundColor: colors.rowGoldBg,
    borderColor: 'rgba(255, 179, 138, 0.80)',
  },
  goldRowLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: typography.family.medium,
    color: colors.navy,
  },
  logoutRow: {
    marginTop: spacing.sm,
    backgroundColor: colors.rowRedBg,
    borderColor: 'rgba(200, 58, 84, 0.50)',
  },
  logoutLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: typography.family.medium,
    color: colors.danger,
  },
  deleteAccountRow: {
    marginTop: spacing.sm,
    backgroundColor: colors.rowRedBg,
    borderColor: 'rgba(200, 58, 84, 0.50)',
  },
  deleteAccountLabel: {
    fontSize: 16,
    fontFamily: typography.family.medium,
    color: colors.danger,
  },
  deleteAccountSubtext: {
    fontSize: 12,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    marginTop: 2,
  },
  disclaimer: {
    fontSize: 12,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    lineHeight: 18,
  },
});
