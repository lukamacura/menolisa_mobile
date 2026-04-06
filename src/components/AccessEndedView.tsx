import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../theme/tokens';
import { openAccountBillingEntry } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getBillingDestinationLabel, resolveBillingRoute } from '../lib/billingCompliance';
import {
  buyIosSubscription,
  IOS_SUBSCRIPTION_PRODUCTS,
  type IosSubscriptionProductId,
  initIosIap,
  isIosIapEnabled,
  loadIosSubscriptions,
  restoreIosPurchases,
  closeIosIap,
} from '../lib/iap';
import type { ProductCommon } from 'react-native-iap';

const { width: WINDOW_WIDTH } = Dimensions.get('window');

const COPY_EXPIRED = {
  heading: 'Your access has ended',
  subheading:
    "Subscribe to keep using MenoLisa and continue saving your insights.",
};

const COPY_ENDING_SOON = {
  heading: 'Your free access ends soon',
  subheading:
    "Subscribe now so you can keep using the app without losing your progress.",
};

const URGENCY_EXPIRED = 'Access ended. Subscribe to continue using the app.';

function getUrgencyEndingSoon(daysLeft: number): string {
  if (daysLeft === 0) return 'Access ends tonight. Subscribe to continue.';
  if (daysLeft === 1) return 'Access ends in 1 day. Subscribe to continue.';
  return 'Access ends in 2 days. Subscribe to continue.';
}

const BUTTON_LABEL_CONTINUE = 'Subscribe';
const BUTTON_LABEL_MANAGE = 'Manage subscription';
const REMIND_LATER_LABEL = 'Remind me later';
const SKIP_LABEL = 'Skip';

type Variant = 'card' | 'fullScreen';
export type TrialPaywallState = 'expired' | 'ending_soon';

type AccessEndedViewProps = {
  variant: Variant;
  /** 'expired' = trial ended; 'ending_soon' = 0-2 days left. Default 'expired'. */
  trialState?: TrialPaywallState;
  /** For trialState 'ending_soon': 0, 1, or 2 days left (used for urgency line). */
  daysLeft?: number;
  onPress?: () => void;
  /** When provided (fullScreen only), shows "Remind me later"; on press dismisses paywall for this session. */
  onRemindLater?: () => void;
  /** When provided, shows a small "Skip" link under the CTA that calls this to close the paywall. */
  onSkip?: () => void;
  /** When true, skip entrance animation (accessibility / user preference). */
  reduceMotion?: boolean;
  /** Optional callback when subscription becomes active (purchase/restore). */
  onSubscriptionSuccess?: () => void;
};

export function AccessEndedView({
  variant,
  trialState = 'expired',
  daysLeft = 0,
  onPress,
  onRemindLater,
  onSkip,
  reduceMotion = false,
  onSubscriptionSuccess,
}: AccessEndedViewProps) {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = React.useState<ProductCommon[]>([]);
  const monthlyId = IOS_SUBSCRIPTION_PRODUCTS[0];
  const annualId = IOS_SUBSCRIPTION_PRODUCTS[1];
  const [selectedPlan, setSelectedPlan] = React.useState<IosSubscriptionProductId>(annualId);
  const [loadingPlans, setLoadingPlans] = React.useState(false);
  const [purchaseBusy, setPurchaseBusy] = React.useState(false);
  const [restoreBusy, setRestoreBusy] = React.useState(false);
  const copy = trialState === 'ending_soon' ? COPY_ENDING_SOON : COPY_EXPIRED;
  const urgencyLine =
    trialState === 'expired' ? URGENCY_EXPIRED : getUrgencyEndingSoon(daysLeft);
  const billingRoute = resolveBillingRoute();
  const destinationLabel = getBillingDestinationLabel();
  const isIosIap = isIosIapEnabled();

  React.useEffect(() => {
    if (!isIosIap) return;
    let active = true;
    (async () => {
      try {
        setLoadingPlans(true);
        await initIosIap();
        const loaded = await loadIosSubscriptions();
        if (active) setSubscriptions(loaded);
      } catch {
        if (active) setSubscriptions([]);
      } finally {
        if (active) setLoadingPlans(false);
      }
    })();
    return () => {
      active = false;
      closeIosIap().catch(() => {});
    };
  }, [isIosIap]);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      openAccountBillingEntry().catch(() => {});
    }
  };

  const getPlanPrice = (productId: IosSubscriptionProductId): string => {
    const item = subscriptions.find((p) => p.id === productId);
    return item?.displayPrice ?? (productId === monthlyId ? '$12.99' : '$79.99');
  };

  const handleSubscribe = async () => {
    if (!isIosIap) {
      handlePress();
      return;
    }
    if (subscriptions.length === 0) {
      Alert.alert('Purchase unavailable', 'Could not load subscription options from the App Store. Please check your connection and try again.');
      return;
    }
    try {
      setPurchaseBusy(true);
      const result = await buyIosSubscription(selectedPlan, user?.id);
      if (result?.active) onSubscriptionSuccess?.();
    } catch (err: unknown) {
      const errObj = err as { message?: string; code?: string; productId?: string; error?: string; provider?: string };
      // Server returns 409 { error: 'already_subscribed', provider: 'stripe' } when the
      // user already has an active web (Stripe) subscription. Show a clear message.
      if (errObj?.error === 'already_subscribed' && errObj?.provider === 'stripe') {
        Alert.alert(
          'You already have a subscription',
          'You have an active subscription managed on our website. Manage it at menolisa.com.'
        );
      } else {
        const parts = [errObj?.message || 'Unable to start purchase.'];
        if (errObj?.code) parts.push(`Code: ${errObj.code}`);
        if (errObj?.productId) parts.push(`Product: ${errObj.productId}`);
        Alert.alert('Purchase unavailable', parts.join('\n'));
      }
    } finally {
      setPurchaseBusy(false);
    }
  };

  const handleRestore = async () => {
    if (!isIosIap) return;
    try {
      setRestoreBusy(true);
      const result = await restoreIosPurchases();
      if (result?.active) onSubscriptionSuccess?.();
    } finally {
      setRestoreBusy(false);
    }
  };

  const isFullScreen = variant === 'fullScreen';

  const content = (
    <>
      <View style={isFullScreen ? styles.heroImageWrap : styles.heroImageWrapCard}>
        <Image
          source={require('../../assets/paywall.png')}
          style={isFullScreen ? styles.heroImage : styles.heroImageCard}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="Lisa"
        />
      </View>
      <View style={isFullScreen ? styles.copyWrap : styles.copyWrapCard}>
        <View style={styles.headingWrap}>
          <Text style={isFullScreen ? styles.headline : styles.cardHeadline}>
            {copy.heading}
          </Text>
        </View>
        <View style={styles.subheadingWrap}>
          <Text style={isFullScreen ? styles.valueLine : styles.cardValueLine}>
            {copy.subheading}
          </Text>
        </View>
        {isIosIap && (
          <View style={styles.pricingWrap}>
            <Text style={styles.pricingSub}>Choose your plan:</Text>
            {IOS_SUBSCRIPTION_PRODUCTS.map((productId) => {
              const selected = selectedPlan === productId;
              const isMonthly = productId === monthlyId;
              const label = isMonthly ? 'Monthly' : 'Annual';
              const hint = isMonthly ? 'Billed every month' : 'Best value - billed yearly';
              return (
                <TouchableOpacity
                  key={productId}
                  activeOpacity={0.85}
                  style={[styles.pricingBox, selected && styles.pricingBoxSelected]}
                  onPress={() => setSelectedPlan(productId)}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${label} plan`}
                >
                  <View style={styles.pricingLeft}>
                    <Text style={styles.pricingLabel}>{label}</Text>
                    <Text style={styles.pricingHint}>{hint}</Text>
                  </View>
                  <Text style={styles.pricingAmount}>{getPlanPrice(productId)}</Text>
                </TouchableOpacity>
              );
            })}
            {loadingPlans && <Text style={styles.pricingSub}>Loading App Store pricing...</Text>}
          </View>
        )}
        <TouchableOpacity
          activeOpacity={0.8}
          style={isFullScreen ? styles.primaryButton : styles.cardButton}
          onPress={isIosIap ? handleSubscribe : handlePress}
          accessibilityRole="button"
          accessibilityLabel={isIosIap ? 'Subscribe' : isFullScreen ? BUTTON_LABEL_CONTINUE : BUTTON_LABEL_MANAGE}
        >
          {purchaseBusy ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text
              style={isFullScreen ? styles.primaryButtonText : styles.cardButtonText}
              numberOfLines={1}
            >
              {isIosIap ? `Subscribe to ${selectedPlan === monthlyId ? 'Monthly' : 'Annual'}` : isFullScreen ? BUTTON_LABEL_CONTINUE : BUTTON_LABEL_MANAGE}
            </Text>
          )}
          {isFullScreen && !purchaseBusy && (
            <Ionicons name="open-outline" size={18} color={colors.background} />
          )}
        </TouchableOpacity>
        {isFullScreen && onSkip != null && (
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.skipLinkWrap}
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel={SKIP_LABEL}
          >
            <Text style={styles.skipLinkText}>{SKIP_LABEL}</Text>
          </TouchableOpacity>
        )}
        <Text
          style={isFullScreen ? styles.urgencyFull : styles.urgencyCard}
          numberOfLines={2}
        >
          {urgencyLine}
        </Text>
        {!isIosIap && (
          <View style={styles.pricingWrap}>
            <View style={styles.upgradeExternalCard}>
              <View style={styles.upgradeRequiredLabel}>
                <Text style={styles.upgradeRequiredLabelText}>Upgrade required</Text>
              </View>
              <Text style={styles.upgradeExternalBody}>
                {billingRoute === 'external_purchase'
                  ? 'Complete your subscription on our secure website checkout.'
                  : `Subscriptions are managed through ${destinationLabel}.`}
              </Text>
            </View>
          </View>
        )}
        {isIosIap && (
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.secondaryButton}
            onPress={handleRestore}
            accessibilityRole="button"
            accessibilityLabel="Restore Purchases"
            disabled={restoreBusy}
          >
            <Text style={styles.secondaryButtonText}>
              {restoreBusy ? 'Restoring...' : 'Restore Purchases'}
            </Text>
          </TouchableOpacity>
        )}
        {isFullScreen && onSkip == null && onRemindLater != null && (
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.secondaryButton}
            onPress={onRemindLater}
            accessibilityRole="button"
            accessibilityLabel={REMIND_LATER_LABEL}
          >
            <Text style={styles.secondaryButtonText}>{REMIND_LATER_LABEL}</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );

  if (isFullScreen) {
    return (
      <View style={styles.fullScreen}>
        <ScrollView
          contentContainerStyle={styles.fullScreenScrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(280)}
            style={styles.fullScreenCard}
          >
            {content}
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  return <View style={styles.card}>{content}</View>;
}

const styles = StyleSheet.create({
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
  },
  fullScreenScrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing['2xl'],
  },
  fullScreenCard: {
    alignItems: 'center',
    width: '100%',
  },
  heroImageWrap: {
    width: WINDOW_WIDTH,
    marginHorizontal: -spacing.xl,
    height: 280,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImageWrapCard: {
    width: '100%',
    height: 200,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroImageCard: {
    width: '100%',
    height: '100%',
  },
  copyWrap: {
    width: '100%',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  copyWrapCard: {
    padding: spacing.lg,
    paddingTop: spacing.lg,
  },
  headingWrap: {
    width: '100%',
    marginBottom: spacing.sm,
  },
  headline: {
    ...typography.presets.heading1,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 32,
  },
  cardHeadline: {
    ...typography.presets.heading3,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subheadingWrap: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  valueLine: {
    ...typography.presets.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
  cardValueLine: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: Math.max(spacing.md, (minTouchTarget - 24) / 2),
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    gap: spacing.sm,
    minHeight: minTouchTarget + 8,
    width: '100%',
    ...shadows.buttonPrimary,
  },
  primaryButtonText: {
    ...typography.presets.button,
    color: colors.background,
  },
  secondaryButton: {
    marginTop: spacing.md,
    minHeight: minTouchTarget,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    ...typography.presets.buttonSmall,
    color: colors.textMuted,
  },
  skipLinkWrap: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipLinkText: {
    ...typography.presets.caption,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  urgencyFull: {
    ...typography.presets.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  urgencyCard: {
    ...typography.presets.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  pricingWrap: {
    width: '100%',
    marginTop: spacing.lg,
  },
  upgradeExternalCard: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'stretch',
    backgroundColor: colors.rowNavyBg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  upgradeRequiredLabel: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  upgradeRequiredLabelText: {
    ...typography.presets.label,
    color: colors.danger,
    fontWeight: '700',
  },
  upgradeExternalBody: {
    ...typography.presets.bodyMedium,
    color: colors.text,
    width: '100%',
  },
  pricingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.rowNavyBg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  pricingBoxSelected: {
    borderColor: colors.primary,
  },
  pricingBoxLast: {
    marginBottom: 0,
  },
  pricingLabel: {
    ...typography.presets.label,
    color: colors.text,
  },
  pricingLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  pricingHint: {
    ...typography.presets.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  pricingAmount: {
    ...typography.presets.bodyMedium,
    color: colors.text,
    fontWeight: '700',
  },
  pricingRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  pricingSub: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.rowNavyBg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  cardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.sm,
    minHeight: minTouchTarget,
    ...shadows.buttonPrimary,
  },
  cardButtonText: {
    ...typography.presets.buttonSmall,
    color: colors.background,
  },
});
