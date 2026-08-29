import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radii, shadows, typography } from '../../theme/tokens';
import type { TodayStackParamList } from '../../navigation/types';
import { useTrialStatus } from '../../hooks/useTrialStatus';
import { usePlanHistory } from '../../hooks/usePlanHistory';
import { usePlanRenewalPrompt } from '../../hooks/usePlanRenewalPrompt';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { toPercent } from '../../lib/planHistoryTypes';
import { formatLongDate } from '../../lib/planHistoryFormat';
import { localDateString } from '../../lib/planApi';
import { openAccountBillingEntry } from '../../lib/api';
import { logger } from '../../lib/logger';
import { PillarRing } from '../../components/progress/PillarRing';
import { PillarLegend } from '../../components/progress/PillarLegend';
import { AnimatedPressable } from '../../components/AnimatedPressable';

type Navigation = NativeStackNavigationProp<TodayStackParamList, 'PlanContinue'>;

/**
 * The three days before her card is charged again.
 *
 * This is the one point in eight weeks where continuing is a decision rather
 * than a default, and it is the point she is most likely to quit — the work is
 * done, and the next eight weeks look like more of it. So the screen does one
 * job: put what she actually did in front of her before she decides.
 *
 * Three rules it is built to, and each has a tempting wrong version:
 *
 * 1. **It names the renewal date and offers the way out.** A screen that says
 *    "don't stop" while quietly saying nothing about the charge three days away
 *    is a dark pattern, not a nudge. The date is stated and the account link is
 *    right there. If she wants to cancel, this screen helps her do it.
 * 2. **The outcome is her own raw counts, not a grade.** Sessions done, tasks
 *    ticked, practices finished. No target, no shortfall, no failure colour —
 *    the same rule the whole progress feature follows.
 * 3. **Nothing here is a medical claim.** It talks about habits coming apart,
 *    which is a fact about behaviour, not about her body. No promises about
 *    symptoms, hormones or outcomes.
 *
 * It shows once per renewal — see `usePlanRenewalPrompt`, which keys the marker
 * off the renewal date itself so the next period re-arms it automatically.
 */
export function PlanContinueScreen() {
  const navigation = useNavigation<Navigation>();
  const { firstName } = useTrialStatus();
  const { renewsOn, markSeen } = usePlanRenewalPrompt();
  const { status, history } = usePlanHistory();

  // Marked seen on the way out rather than on mount, so a screen she never
  // actually read — a crash, a force-quit while it loaded — is still owed to
  // her the next time she opens the app.
  const onContinue = useCallback(() => {
    markSeen();
    navigation.goBack();
  }, [markSeen, navigation]);

  // Same as PlanRecap: without this, Android's back button leaves the screen
  // unmarked and the daily loop re-opens it on the very next frame.
  useAndroidBack(onContinue);

  const onOpenAccount = useCallback(() => {
    // Deliberately does NOT mark the screen seen. She is stepping out to look
    // at billing, not dismissing what she came here to read.
    openAccountBillingEntry().catch((e) => logger.warn('Open account page failed', e));
  }, []);

  const overall = history?.overall;

  /** What she actually did, in her own counts. Empty entries simply drop out. */
  const done = [
    overall?.movement?.done
      ? `${overall.movement.done} movement ${overall.movement.done === 1 ? 'session' : 'sessions'}`
      : null,
    overall?.relaxation?.done
      ? `${overall.relaxation.done} relaxation ${overall.relaxation.done === 1 ? 'practice' : 'practices'}`
      : null,
    overall?.nutrition?.done ? `${overall.nutrition.done} nutrition tasks finished` : null,
  ].filter(Boolean) as string[];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>Your 8 weeks are nearly up</Text>
        <Text style={styles.title}>
          {firstName ? `${firstName}, don't stop here.` : "Don't stop here."}
        </Text>

        {status === 'loading' && !history ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {history && overall ? (
          <>
            <View style={styles.hero}>
              <PillarRing
                movement={overall.movement?.ratio ?? null}
                nutrition={overall.nutrition?.ratio ?? null}
                relaxation={overall.relaxation?.ratio ?? null}
                size={132}
                strokeWidth={11}
                animate
                accessibilityLabel={`${toPercent(overall.score)} percent across ${history.daysElapsed} days.`}
              >
                <Text style={styles.heroPercent} allowFontScaling={false}>
                  {toPercent(overall.score)}
                  <Text style={styles.heroPercentSign}>%</Text>
                </Text>
              </PillarRing>
              <Text style={styles.heroCaption}>
                {history.daysElapsed} days in
                {done.length ? ` · ${done.join(' · ')}` : ''}
              </Text>
            </View>

            <View style={styles.card}>
              <PillarLegend
                movement={overall.movement}
                nutrition={overall.nutrition}
                relaxation={overall.relaxation}
                scope="span"
              />
            </View>
          </>
        ) : null}

        <View style={styles.body}>
          <Text style={styles.bodyText}>
            Eight weeks is the part most women never finish. You did.
          </Text>
          <Text style={styles.bodyText}>
            What you have built is still new, though. Habits this young come apart a lot
            faster than they came together — and the next eight weeks are where they stop
            being something you do and start being something you are.
          </Text>
          <Text style={styles.bodyText}>
            Your next plan is already shaped around what actually worked for you in these
            weeks. Not a fresh start. A continuation.
          </Text>
        </View>

        {renewsOn ? (
          <View style={styles.billing}>
            <Text style={styles.billingText}>
              Your plan renews on {formatLongDate(localDateString(renewsOn))} and
              carries straight on.
            </Text>
            <Text style={styles.billingLink} onPress={onOpenAccount} accessibilityRole="link">
              Manage your subscription
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <AnimatedPressable
          style={styles.button}
          onPress={onContinue}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={styles.buttonLabel}>Continue</Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  eyebrow: {
    ...typography.presets.label,
    color: colors.primary,
    textAlign: 'center',
  },
  title: {
    ...typography.presets.heading1,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  loading: {
    paddingVertical: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  heroPercent: {
    ...typography.presets.heading1,
    color: colors.text,
  },
  heroPercentSign: {
    ...typography.presets.body,
    color: colors.textMuted,
  },
  heroCaption: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  card: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  body: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  bodyText: {
    ...typography.presets.body,
    color: colors.text,
  },
  billing: {
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  billingText: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
  },
  billingLink: {
    ...typography.presets.bodySmall,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonLabel: {
    ...typography.presets.button,
    color: colors.textInverse,
  },
});
