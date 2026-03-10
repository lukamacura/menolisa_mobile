import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../theme/tokens';
import { openWebDashboard } from '../lib/api';

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

// Expired: three copy variants (no em dashes)
const COPY_VARIANTS: Array<{ heading: string; subheading: string }> = [
  {
    heading: "Your patterns are ready. Don't leave them behind.",
    subheading:
      'By week two Lisa usually finds 3 to 5 patterns most women miss. Unlock your report and keep the insights.',
  },
  {
    heading: 'Lisa is just getting to know you. Stay and keep connecting.',
    subheading:
      "She's learning your body's signals. Subscribe to keep your conversation and patterns with you.",
  },
  {
    heading: 'Take back control of your symptoms.',
    subheading:
      'Unlock your full report and keep tracking patterns with Lisa. Your data stays safe.',
  },
];

// Ending soon (0-2 days left): three copy variants
const COPY_VARIANTS_ENDING_SOON: Array<{ heading: string; subheading: string }> = [
  {
    heading: "Your patterns are taking shape. Don't miss what Lisa finds next.",
    subheading:
      'By week two she usually spots 3 to 5 patterns most women miss. Choose a plan and keep your insights.',
  },
  {
    heading: 'Lisa is just getting to know you. Keep the connection going.',
    subheading:
      "She's learning your body's signals. Subscribe before your trial ends and keep everything you've built.",
  },
  {
    heading: 'Stay in control of your symptoms.',
    subheading:
      'Your trial is ending soon. Unlock your full report and keep tracking patterns with Lisa.',
  },
];

const URGENCY_EXPIRED = 'Your trial has ended. Your data is saved for 30 days.';

function getUrgencyEndingSoon(daysLeft: number): string {
  if (daysLeft === 0) return 'Your free access ends tonight.';
  if (daysLeft === 1) return 'Your free access ends in 1 day.';
  return 'Your free access ends in 2 days.';
}
const BUTTON_LABEL_CONTINUE = 'Continue with Lisa';
const BUTTON_LABEL_MANAGE = 'Manage subscription';
const REMIND_LATER_LABEL = 'Remind me later';

const PRICE_MONTHLY = 12;
const PRICE_ANNUAL = 79;
const PRICE_ANNUAL_PER_MONTH = 6.58;

const TEXT_FADE_MS = 200;
const COPY_ROTATE_INTERVAL_MS = 2000;

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
  /** Optional: reduce motion disables word stagger animation. */
  reduceMotion?: boolean;
};

const SKIP_LABEL = 'Skip';

export function AccessEndedView({
  variant,
  trialState = 'expired',
  daysLeft = 0,
  onPress,
  onRemindLater,
  onSkip,
  reduceMotion = false,
}: AccessEndedViewProps) {
  const variants = trialState === 'ending_soon' ? COPY_VARIANTS_ENDING_SOON : COPY_VARIANTS;
  const [copyIndex, setCopyIndex] = useState(0);
  const copy = variants[copyIndex];
  const urgencyLine =
    trialState === 'expired' ? URGENCY_EXPIRED : getUrgencyEndingSoon(daysLeft);

  useEffect(() => {
    const len = trialState === 'ending_soon' ? COPY_VARIANTS_ENDING_SOON.length : COPY_VARIANTS.length;
    const id = setInterval(() => {
      setCopyIndex((prev) => (prev + 1) % len);
    }, COPY_ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [trialState]);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      openWebDashboard().catch(() => {});
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
          {reduceMotion ? (
            <Text style={isFullScreen ? styles.headline : styles.cardHeadline}>
              {copy.heading}
            </Text>
          ) : (
            <Animated.View
              key={copyIndex}
              entering={FadeIn.duration(TEXT_FADE_MS)}
              style={styles.revealBlock}
            >
              <Text style={isFullScreen ? styles.headline : styles.cardHeadline}>
                {copy.heading}
              </Text>
            </Animated.View>
          )}
        </View>
        <View style={styles.subheadingWrap}>
          {reduceMotion ? (
            <Text style={isFullScreen ? styles.valueLine : styles.cardValueLine}>
              {copy.subheading}
            </Text>
          ) : (
            <Animated.View
              key={copyIndex}
              entering={FadeIn.delay(40).duration(TEXT_FADE_MS)}
              style={styles.revealBlock}
            >
              <Text style={isFullScreen ? styles.valueLine : styles.cardValueLine}>
                {copy.subheading}
              </Text>
            </Animated.View>
          )}
        </View>
        <TouchableOpacity
          activeOpacity={0.8}
          style={isFullScreen ? styles.primaryButton : styles.cardButton}
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={isFullScreen ? BUTTON_LABEL_CONTINUE : BUTTON_LABEL_MANAGE}
        >
          <Text
            style={isFullScreen ? styles.primaryButtonText : styles.cardButtonText}
            numberOfLines={1}
          >
            {isFullScreen ? BUTTON_LABEL_CONTINUE : BUTTON_LABEL_MANAGE}
          </Text>
          {isFullScreen && (
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
        <View style={styles.pricingWrap}>
          <View style={styles.pricingBox}>
            <Text style={styles.pricingLabel}>Monthly</Text>
            <Text style={styles.pricingAmount}>${PRICE_MONTHLY}/mo</Text>
          </View>
          <View style={[styles.pricingBox, styles.pricingBoxLast]}>
            <Text style={styles.pricingLabel}>Annual</Text>
            <View style={styles.pricingRight}>
              <Text style={styles.pricingAmount}>${PRICE_ANNUAL}/year</Text>
              <Text style={styles.pricingSub}>${PRICE_ANNUAL_PER_MONTH}/mo</Text>
            </View>
          </View>
        </View>
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
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    backgroundColor: colors.background,
  },
  fullScreenScrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['2xl'],
    minHeight: WINDOW_HEIGHT,
  },
  fullScreenCard: {
    alignItems: 'center',
    width: '100%',
    minHeight: WINDOW_HEIGHT,
  },
  heroImageWrap: {
    width: WINDOW_WIDTH,
    height: Math.min(WINDOW_HEIGHT * 0.42, 320),
    marginHorizontal: -spacing.xl,
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
  pricingBoxLast: {
    marginBottom: 0,
  },
  pricingLabel: {
    ...typography.presets.label,
    color: colors.text,
  },
  pricingAmount: {
    ...typography.presets.bodyMedium,
    color: colors.text,
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
  revealBlock: {
    width: '100%',
  },
});
