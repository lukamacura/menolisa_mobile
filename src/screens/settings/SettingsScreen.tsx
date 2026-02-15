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
import { deleteAccount, getWebAppUrl, openWebDashboard } from '../../lib/api';
import { useTrialStatus } from '../../hooks/useTrialStatus';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';

type SettingsStackParamList = {
  Settings: undefined;
  InviteFriends: undefined;
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

  const handleOpenDashboard = useCallback(async () => {
    try {
      await openWebDashboard();
    } catch (e) {
      Alert.alert(
        'Open dashboard',
        e instanceof Error ? e.message : 'Could not open the web dashboard. Please try again.'
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
    if (trialStatus.accountStatus === 'paid') {
      if (trialStatus.end) {
        const dateStr = trialStatus.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        return trialStatus.subscriptionCanceled
          ? `Subscriber • Access until ${dateStr}`
          : `Subscriber • Renews ${dateStr}`;
      }
      return 'Subscriber • Active';
    }
    if (trialStatus.expired) return 'Trial ended';
    if (trialStatus.daysLeft >= 0)
      return `Trial • ${trialStatus.daysLeft === 0 ? 'Ends today' : `${trialStatus.daysLeft} day${trialStatus.daysLeft === 1 ? '' : 's'} left`}`;
    return 'Trial';
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
              <Ionicons name="card-outline" size={20} color={colors.textMuted} />
              <Text style={styles.statusLabel}>{getStatusLabel()}</Text>
            </View>
          </StaggeredZoomIn>
          <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.row, styles.navyRow]}
              onPress={handleOpenDashboard}
            >
              <Ionicons name="globe-outline" size={22} color={colors.navy} />
              <View style={styles.rowTextWrap}>
                <Text style={styles.navyRowLabel}>Manage subscription</Text>
                <Text style={styles.navyRowSubtext}>Manage your plan and billing at menolisa.com</Text>
              </View>
              <Ionicons name="open-outline" size={18} color={colors.navy} />
            </TouchableOpacity>
          </StaggeredZoomIn>
        </View>

        <View style={styles.section}>
          <StaggeredZoomIn delayIndex={2} reduceMotion={reduceMotion}>
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.row, styles.referralRow]}
              onPress={() => navigation.navigate('InviteFriends')}
            >
              <Ionicons name="gift-outline" size={22} color={colors.orange} />
              <Text style={styles.referralRowLabel}>Invite friends</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.orange} />
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
            MenoLisa is for tracking and information only. It is not medical advice. Always consult a
            healthcare provider for medical decisions.
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
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusLabel: {
    fontSize: 15,
    fontFamily: typography.family.medium,
    color: colors.text,
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
  navyRow: {
    backgroundColor: colors.rowNavyBg,
    borderColor: colors.navy + '99',
  },
  navyRowLabel: {
    fontSize: 16,
    fontFamily: typography.family.medium,
    color: colors.navy,
  },
  navyRowSubtext: {
    fontSize: 12,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    marginTop: 2,
  },
  referralRow: {
    borderColor: colors.orange + '80',
    backgroundColor: colors.orangeLight,
  },
  referralRowLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: typography.family.medium,
    color: colors.text,
  },
  blueRow: {
    backgroundColor: colors.rowBlueBg,
    borderColor: colors.blue + '99',
  },
  blueRowLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: typography.family.medium,
    color: colors.text,
  },
  goldRow: {
    backgroundColor: colors.rowGoldBg,
    borderColor: colors.gold + 'cc',
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
    borderColor: colors.danger + '80',
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
    borderColor: colors.danger + '80',
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
