import React, { useCallback, useState } from 'react';
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
import { deleteAccount, getWebAppUrl, openAccountBillingEntry } from '../../lib/api';
import { useTrialStatus } from '../../hooks/useTrialStatus';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';
import { errorMessage } from '../../lib/errorCopy';

type SettingsStackParamList = {
  Settings: undefined;
  NotificationPrefs: undefined;
};
type NavProp = NativeStackNavigationProp<SettingsStackParamList, 'Settings'>;

/**
 * Where "contact support" actually goes.
 *
 * `disputed` and `past_due` both render a status line telling her to reach
 * support, and for a long time the app had no way to do it — no address, no
 * link, nothing. Someone locked out of her own account was told to do something
 * impossible. The mail app is the first choice because it carries her address
 * with it; the web form is the fallback for a device with no mail client
 * configured, which is common enough on Android to matter.
 */
const SUPPORT_EMAIL = 'menolisahelp@gmail.com';
const SUPPORT_SUBJECT = 'MenoLisa support request';

/**
 * The money sentence on the delete dialog.
 *
 * `POST /api/account/delete` cancels the Stripe subscription immediately and
 * asks for no proration — refunds are a manual support decision. So deleting on
 * day 4 of 56 burns seven and a half weeks she has already paid for, and the
 * dialog used to say only "your account and all your data". A charge she cannot
 * see coming is how a cancellation becomes a chargeback; she gets told first.
 *
 * Returns null when there is nothing left to forfeit — no live access means no
 * paid time to lose, and an invented warning is its own kind of dishonest.
 */
function billingForfeitWarning(expired: boolean, daysLeft: number | null): string | null {
  if (expired) return null;
  if (daysLeft === null || daysLeft <= 0) {
    return 'Your subscription is cancelled immediately. Unused time is not refunded automatically — contact us first if you want it reviewed.';
  }
  const days = daysLeft === 1 ? '1 day' : `${daysLeft} days`;
  return `Your subscription is cancelled immediately and the ${days} you have already paid for are not refunded automatically. If you want that reviewed, contact us before deleting.`;
}

export function SettingsScreen() {
  const navigation = useNavigation<NavProp>();
  const { signOut } = useAuth();
  const trialStatus = useTrialStatus();
  const reduceMotion = useReduceMotion();
  const [actionLoading, setActionLoading] = useState<'delete' | null>(null);

  useFocusEffect(
    useCallback(() => {
      trialStatus.refetch().catch(() => {});
    }, [trialStatus.refetch])
  );

  /**
   * Confirmed, because signing back in is not free.
   *
   * There is no password — getting back in means waiting on a 6-digit code in
   * her inbox. This row also sits directly above "Delete account" in the same
   * red treatment, so a mis-tap while scrolling used to lock her out of her own
   * symptom history until she could reach her email.
   */
  const handleLogout = useCallback(() => {
    const title = 'Log out?';
    const message =
      "You'll need a new 6-digit code sent to your email to sign back in. Your data stays exactly as it is.";

    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) void signOut();
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }, [signOut]);

  /** Mail first, web form when there is no mail client to answer the intent. */
  const handleContactSupport = useCallback(async () => {
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUPPORT_SUBJECT)}`;
    try {
      const canMail = await Linking.canOpenURL(mailto);
      if (canMail) {
        await Linking.openURL(mailto);
        return;
      }
      await Linking.openURL(getWebAppUrl('/contact'));
    } catch {
      // Last resort: tell her the address so she can reach us from any device.
      Alert.alert(
        'Contact support',
        `Email us at ${SUPPORT_EMAIL} and we'll get back to you.`
      );
    }
  }, []);

  const runDeleteAccount = useCallback(async () => {
    setActionLoading('delete');
    try {
      await deleteAccount();
      await signOut();
    } catch (e) {
      setActionLoading(null);
      const message = errorMessage(e, 'Could not delete your account. Please try again.');
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    }
  }, [signOut]);

  const handleDeleteAccount = useCallback(() => {
    const title = 'Delete account';
    const message = [
      'This permanently deletes your account and all your data — symptom logs, plan history and chats. You will need to sign up again to use MenoLisa.',
      billingForfeitWarning(trialStatus.expired, trialStatus.daysLeft),
    ]
      .filter(Boolean)
      .join('\n\n');

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
  }, [runDeleteAccount, trialStatus.expired, trialStatus.daysLeft]);

  // Same on every platform: IAP is gone, Stripe on the web is the only billing path.
  // This must never open the paywall — it is reached by subscribers with active access.
  const handleOpenAccountWeb = useCallback(async () => {
    try {
      await openAccountBillingEntry();
    } catch (e) {
      Alert.alert(
        'Open account',
        errorMessage(e, 'Could not open account options. Please try again.')
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
          {/* First in this group on purpose: the status card above can say
              "Access paused • Contact support", and the thing it names has to
              be the next thing she sees — not buried under the legal rows. */}
          <StaggeredZoomIn delayIndex={2} reduceMotion={reduceMotion}>
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.row, styles.supportRow]}
              onPress={handleContactSupport}
              accessibilityRole="button"
              accessibilityLabel="Contact support"
              accessibilityHint={`Opens an email to ${SUPPORT_EMAIL}`}
            >
              <Ionicons name="help-buoy-outline" size={22} color={colors.navy} />
              <View style={styles.rowTextWrap}>
                <Text style={styles.supportRowLabel}>Contact support</Text>
                <Text style={styles.rowSubtext}>{SUPPORT_EMAIL}</Text>
              </View>
              <Ionicons name="open-outline" size={18} color={colors.navy} />
            </TouchableOpacity>
          </StaggeredZoomIn>
          <StaggeredZoomIn delayIndex={3} reduceMotion={reduceMotion}>
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
          <StaggeredZoomIn delayIndex={4} reduceMotion={reduceMotion}>
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
          <StaggeredZoomIn delayIndex={5} reduceMotion={reduceMotion}>
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
          <StaggeredZoomIn delayIndex={6} reduceMotion={reduceMotion}>
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.row, styles.logoutRow]}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={22} color={colors.danger} />
              <Text style={styles.logoutLabel}>Log out</Text>
            </TouchableOpacity>
          </StaggeredZoomIn>
          <StaggeredZoomIn delayIndex={7} reduceMotion={reduceMotion}>
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

        <StaggeredZoomIn delayIndex={8} reduceMotion={reduceMotion}>
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
  supportRow: {
    backgroundColor: colors.rowNavyBg,
    borderColor: 'rgba(46, 42, 77, 0.35)',
  },
  supportRowLabel: {
    fontSize: 16,
    fontFamily: typography.family.medium,
    color: colors.navy,
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
