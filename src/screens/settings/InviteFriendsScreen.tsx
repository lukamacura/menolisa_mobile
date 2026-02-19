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

type InviteCopyState = 'eligible' | 'already_used' | 'already_subscribed' | 'no_referrals' | 'subscribed';

interface CopyData {
  referrerBenefit: { youGet: string; badge: string; condition: string } | null;
  friendTitle: string;
  friendSubtitle: string;
  shareMessage: string;
}

const INVITE_COPY: Record<InviteCopyState, CopyData> = {
  // Trial user, no referrals yet — motivate to invite
  no_referrals: {
    referrerBenefit: {
      youGet: 'You get',
      badge: '50% OFF',
      condition: 'off your first subscription\nwhen a friend joins with your link',
    },
    friendTitle: 'They get 3 days free',
    friendSubtitle: 'A free trial when they sign up',
    shareMessage: 'Try MenoLisa free for 3 days — use my invite link.',
  },
  // Trial user, friend signed up — discount waiting at checkout
  eligible: {
    referrerBenefit: {
      youGet: 'You get',
      badge: '50% OFF',
      condition: 'off your first subscription\nwhen a friend joins with your link',
    },
    friendTitle: 'They get 3 days free',
    friendSubtitle: 'A free trial when they sign up',
    shareMessage: 'Try MenoLisa free for 3 days — use my invite link.',
  },
  // Already subscribed, friend signed up — discount pending for next billing cycle
  already_subscribed: {
    referrerBenefit: {
      youGet: 'You get',
      badge: '50% OFF',
      condition: 'off your next payment\n— your referral reward is pending',
    },
    friendTitle: 'They get 3 days free',
    friendSubtitle: 'A free trial when they sign up',
    shareMessage: 'Try MenoLisa free for 3 days — use my invite link.',
  },
  // Referral coupon was applied at checkout — one-time discount consumed
  already_used: {
    referrerBenefit: null,
    friendTitle: 'Give friends 3 days free',
    friendSubtitle: 'Share your link — they get a free trial when they sign up.',
    shareMessage: 'Try MenoLisa free for 3 days — use my invite link.',
  },
  // Paid subscriber, no referrals — no discount to offer
  subscribed: {
    referrerBenefit: null,
    friendTitle: 'Give friends 3 days free',
    friendSubtitle: 'Share your link — they get a free trial when they sign up.',
    shareMessage: 'Try MenoLisa free for 3 days — use my invite link.',
  },
};

export function InviteFriendsScreen() {
  const reduceMotion = useReduceMotion();
  const [code, setCode] = useState<string | null>(null);
  const [inviteCopyState, setInviteCopyState] = useState<InviteCopyState>('eligible');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setCode(null);
    try {
      const [codeData, eligibleData] = await Promise.all([
        apiFetchWithAuth(API_CONFIG.endpoints.referralCode).catch(() => null),
        apiFetchWithAuth(API_CONFIG.endpoints.referralDiscountEligible).catch(() => ({ inviteCopyState: 'eligible' as InviteCopyState })),
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
    const c = INVITE_COPY[inviteCopyState];
    Share.share({
      message: `${c.shareMessage}\n${link}`,
      title: 'Try MenoLisa',
      url: link,
    }).catch((err) => {
      if (err?.message?.includes('cancel')) return;
      copyLink();
    });
  }, [link, copyLink, inviteCopyState]);

  const c = INVITE_COPY[inviteCopyState];

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

                {c.referrerBenefit ? (
                  <View style={styles.referrerHero}>
                    <Text style={styles.yourRewardLabel}>YOUR REWARD</Text>
                    <Text style={styles.youGetText}>{c.referrerBenefit.youGet}</Text>
                    <Text style={styles.bigDiscountText}>{c.referrerBenefit.badge}</Text>
                    <Text style={styles.discountCondition}>{c.referrerBenefit.condition}</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.title}>{c.friendTitle}</Text>
                    <Text style={styles.subtext}>{c.friendSubtitle}</Text>
                  </>
                )}

                {c.referrerBenefit && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.friendRow}>
                      <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                      <View style={styles.friendTextWrap}>
                        <Text style={styles.friendTitle}>{c.friendTitle}</Text>
                        <Text style={styles.friendSubtext}>{c.friendSubtitle}</Text>
                      </View>
                    </View>
                  </>
                )}

                <View style={styles.divider} />

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

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => Linking.openURL(getWebAppUrl('/terms'))}
                  style={styles.termsLinkWrap}
                >
                  <Text style={styles.termsLinkText}>Terms and conditions apply</Text>
                </TouchableOpacity>
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
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.orangeLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  // Eligible / referrer-first layout
  referrerHero: {
    alignItems: 'center',
    width: '100%',
    paddingBottom: 6,
  },
  yourRewardLabel: {
    fontSize: 11,
    fontFamily: typography.family.semibold,
    color: colors.orange,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  youGetText: {
    fontSize: 18,
    fontFamily: typography.family.medium,
    color: colors.text,
    marginBottom: -4,
  },
  bigDiscountText: {
    fontSize: 60,
    fontFamily: typography.family.bold,
    color: colors.orange,
    lineHeight: 66,
    marginBottom: 4,
  },
  discountCondition: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    width: '100%',
  },
  friendTextWrap: {
    flex: 1,
  },
  friendTitle: {
    fontSize: 16,
    fontFamily: typography.family.medium,
    color: colors.text,
  },
  friendSubtext: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    marginTop: 2,
  },
  // Non-eligible layout (centered)
  title: {
    fontSize: 22,
    fontFamily: typography.family.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtext: {
    fontSize: 15,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: spacing.xs,
  },
  // Actions
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
    width: '100%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
  },
  buttonSecondary: {
    backgroundColor: colors.orangeLight,
    borderWidth: 1.5,
    borderColor: colors.orange + '99',
  },
  buttonSecondaryText: {
    fontSize: 16,
    fontFamily: typography.family.medium,
    color: colors.orange,
  },
  buttonPrimary: {
    backgroundColor: colors.orange,
  },
  buttonPrimaryText: {
    fontSize: 16,
    fontFamily: typography.family.semibold,
    color: colors.background,
  },
  errorWrap: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    textAlign: 'center',
  },
  termsLinkWrap: {
    marginTop: spacing.sm,
  },
  termsLinkText: {
    fontSize: 12,
    fontFamily: typography.family.medium,
    color: colors.orange,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
