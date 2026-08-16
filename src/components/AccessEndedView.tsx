import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../theme/tokens';

/**
 * The one paywall surface inside MainTabs.
 *
 * It only ever shows "ends soon" — a `canceling` subscriber whose paid period runs
 * out within two days. She still has access, so `AppNavigator` cannot gate her out;
 * the warning has to render over the tab content, and she can skip it.
 *
 * Access that has actually ended is not handled here. `AppNavigator` unmounts
 * MainTabs the moment `has_access` goes false and shows `SubscriptionRequiredScreen`
 * instead, so an "expired" branch on this component could never render.
 */

const COPY = {
  heading: 'Your subscription ends soon',
  subheading:
    "Your plan won't renew. Reactivate on menolisa.com to keep using the app without losing your progress.",
};

function getUrgency(daysLeft: number): string {
  if (daysLeft === 0) return 'Access ends tonight. Continue on menolisa.com.';
  if (daysLeft === 1) return 'Access ends in 1 day. Continue on menolisa.com.';
  return 'Access ends in 2 days. Continue on menolisa.com.';
}

const BUTTON_LABEL = 'Continue on menolisa.com';
const SKIP_LABEL = 'Skip';

type AccessEndedViewProps = {
  daysLeft: number;
  onPress: () => void;
  onSkip: () => void;
  reduceMotion?: boolean;
};

export function AccessEndedView({
  daysLeft,
  onPress,
  onSkip,
  reduceMotion = false,
}: AccessEndedViewProps) {
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
          <View style={styles.copyWrap}>
            <View style={styles.headingWrap}>
              <Text style={styles.headline}>{COPY.heading}</Text>
            </View>
            <View style={styles.subheadingWrap}>
              <Text style={styles.valueLine}>{COPY.subheading}</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.primaryButton}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={BUTTON_LABEL}
            >
              <Text style={styles.primaryButtonText} numberOfLines={1}>
                {BUTTON_LABEL}
              </Text>
              <Ionicons name="open-outline" size={18} color={colors.background} />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.skipLinkWrap}
              onPress={onSkip}
              accessibilityRole="button"
              accessibilityLabel={SKIP_LABEL}
            >
              <Text style={styles.skipLinkText}>{SKIP_LABEL}</Text>
            </TouchableOpacity>
            <Text style={styles.urgency} numberOfLines={2}>
              {getUrgency(daysLeft)}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
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
  copyWrap: {
    width: '100%',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
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
  urgency: {
    ...typography.presets.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
});
