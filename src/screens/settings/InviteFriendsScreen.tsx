import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ScrollView,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiFetchWithAuth, getWebAppUrl, API_CONFIG } from '../../lib/api';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';
import { InviteFriendsSkeleton, ContentTransition } from '../../components/skeleton';

type InviteCopyState = 'eligible' | 'already_used' | 'already_subscribed' | 'no_referrals';

const INVITE_COPY: Record<InviteCopyState, { title: string; subtitle: string; shareMessage: string }> = {
  eligible: {
    title: 'Give 3 days free. Get 50% off.',
    subtitle:
      'Invite friends to try MenoLisa. They get 3 days free; you get 50% off your first subscription when you upgrade.',
    shareMessage: 'Give 3 days free. Get 50% off. Invite friends to try MenoLisa.',
  },
  already_used: {
    title: 'Invite friends - they get 3 days free.',
    subtitle: 'Your friends get 3 days free when they sign up with your link.',
    shareMessage: 'Invite friends to try MenoLisa. They get 3 days free.',
  },
  already_subscribed: {
    title: 'Invite friends - they get 3 days free.',
    subtitle: 'Your friends get 3 days free when they sign up with your link.',
    shareMessage: 'Invite friends to try MenoLisa. They get 3 days free.',
  },
  no_referrals: {
    title: 'Invite friends - they get 3 days free.',
    subtitle: 'Your friends get 3 days free when they sign up with your link.',
    shareMessage: 'Invite friends to try MenoLisa. They get 3 days free.',
  },
};

export function InviteFriendsScreen() {
  const reduceMotion = useReduceMotion();
  const [code, setCode] = useState<string | null>(null);
  const [inviteCopyState, setInviteCopyState] = useState<InviteCopyState>('no_referrals');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setCode(null);
    try {
      const [codeData, eligibleData] = await Promise.all([
        apiFetchWithAuth(API_CONFIG.endpoints.referralCode).catch(() => null),
        apiFetchWithAuth(API_CONFIG.endpoints.referralDiscountEligible).catch(() => ({ inviteCopyState: 'no_referrals' as InviteCopyState })),
      ]);
      const resolvedCode = codeData?.code ?? (codeData as { data?: { code?: string } })?.data?.code ?? null;
      setCode(resolvedCode || null);
      if (eligibleData?.inviteCopyState) setInviteCopyState(eligibleData.inviteCopyState);
    } catch {
      setCode(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const registerBase = getWebAppUrl('').replace(/\/$/, '');
  const link = code ? `${registerBase}/register?ref=${encodeURIComponent(code)}` : '';

  const copyLink = useCallback(() => {
    if (!link) return;
    Clipboard.setStringAsync(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [link]);

  const share = useCallback(() => {
    if (!link) return;
    const copy = INVITE_COPY[inviteCopyState];
    Share.share({
      message: `${copy.shareMessage}\n${link}`,
      title: 'Try MenoLisa',
      url: link,
    }).catch((err) => {
      if (err?.message?.includes('cancel')) return;
      copyLink();
    });
  }, [link, copyLink, inviteCopyState]);

  const copy = INVITE_COPY[inviteCopyState];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <InviteFriendsSkeleton />
        ) : (
          <ContentTransition style={styles.skeletonTransition}>
            <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
            <View style={styles.card}>
              <View style={styles.iconWrap}>
                <Ionicons name="gift" size={32} color={colors.orange} />
              </View>
              <Text style={styles.title}>{copy.title}</Text>
              <Text style={styles.subtext}>{copy.subtitle}</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => Linking.openURL(getWebAppUrl('/terms'))}
                style={styles.termsLinkWrap}
              >
                <Text style={styles.termsLinkText}>Terms and conditions apply</Text>
              </TouchableOpacity>
              {link ? (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={copyLink}
                activeOpacity={0.8}
              >
                <Ionicons name="copy-outline" size={20} color={colors.orange} />
                <Text style={styles.buttonSecondaryText}>
                  {copied ? 'Copied!' : 'Copy link'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={share}
                activeOpacity={0.8}
              >
                <Ionicons name="share-outline" size={20} color={colors.background} />
                <Text style={styles.buttonPrimaryText}>Share</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>Could not load your referral link.</Text>
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={loadData}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={20} color={colors.background} />
                <Text style={styles.buttonPrimaryText}>Try again</Text>
              </TouchableOpacity>
            </View>
              )}
            </View>
            </StaggeredZoomIn>
          </ContentTransition>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  skeletonTransition: { flex: 0 },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.orange + '90',
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.orangeLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontFamily: typography.family.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtext: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  termsLinkWrap: {
    marginBottom: spacing.xl,
  },
  termsLinkText: {
    fontSize: 12,
    fontFamily: typography.family.medium,
    color: colors.orange,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  buttonSecondary: {
    backgroundColor: colors.orangeLight,
    borderWidth: 1.5,
    borderColor: colors.orange + '99',
  },
  buttonSecondaryText: {
    fontSize: 15,
    fontFamily: typography.family.medium,
    color: colors.orange,
  },
  buttonPrimary: {
    backgroundColor: colors.orange,
  },
  buttonPrimaryText: {
    fontSize: 15,
    fontFamily: typography.family.semibold,
    color: colors.background,
  },
  errorWrap: {
    alignItems: 'center',
    gap: spacing.md,
  },
  errorText: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
