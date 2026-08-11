import React from 'react';
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
import { openAccountBillingEntry } from '../lib/api';

const { width: WINDOW_WIDTH } = Dimensions.get('window');

const COPY_EXPIRED = {
  heading: 'Your access has ended',
  subheading:
    'Manage your subscription on menolisa.com to continue using MenoLisa and keep your insights.',
};

const COPY_ENDING_SOON = {
  heading: 'Your subscription ends soon',
  subheading:
    "Your plan won't renew. Reactivate on menolisa.com to keep using the app without losing your progress.",
};

const URGENCY_EXPIRED = 'Access ended. Continue on menolisa.com.';

function getUrgencyEndingSoon(daysLeft: number): string {
  if (daysLeft === 0) return 'Access ends tonight. Continue on menolisa.com.';
  if (daysLeft === 1) return 'Access ends in 1 day. Continue on menolisa.com.';
  return 'Access ends in 2 days. Continue on menolisa.com.';
}

const BUTTON_LABEL_FULL = 'Continue on menolisa.com';
const BUTTON_LABEL_CARD = 'Manage on menolisa.com';
const REMIND_LATER_LABEL = 'Remind me later';
const SKIP_LABEL = 'Skip';

type Variant = 'card' | 'fullScreen';
export type AccessPaywallState = 'expired' | 'ending_soon';

type AccessEndedViewProps = {
  variant: Variant;
  accessState?: AccessPaywallState;
  daysLeft?: number;
  onPress?: () => void;
  onRemindLater?: () => void;
  onSkip?: () => void;
  reduceMotion?: boolean;
  onSubscriptionSuccess?: () => void;
};

export function AccessEndedView({
  variant,
  accessState = 'expired',
  daysLeft = 0,
  onPress,
  onRemindLater,
  onSkip,
  reduceMotion = false,
}: AccessEndedViewProps) {
  const copy = accessState === 'ending_soon' ? COPY_ENDING_SOON : COPY_EXPIRED;
  const urgencyLine =
    accessState === 'expired' ? URGENCY_EXPIRED : getUrgencyEndingSoon(daysLeft);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      openAccountBillingEntry().catch(() => {});
    }
  };

  const isFullScreen = variant === 'fullScreen';
  const buttonLabel = isFullScreen ? BUTTON_LABEL_FULL : BUTTON_LABEL_CARD;

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
        <TouchableOpacity
          activeOpacity={0.8}
          style={isFullScreen ? styles.primaryButton : styles.cardButton}
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={buttonLabel}
        >
          <Text
            style={isFullScreen ? styles.primaryButtonText : styles.cardButtonText}
            numberOfLines={1}
          >
            {buttonLabel}
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
