import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../theme/tokens';

/**
 * The hard gate. Shown instead of the whole app when this build is below the
 * `minimum` the server named, and there is deliberately no way past it — that
 * is the entire difference between this screen and the nudge card.
 *
 * It sits outside the navigator, above the auth branch and the paywall alike:
 * a build too old to talk to the API correctly is too old to sign in with, and
 * routing her to a login screen that will fail is worse than saying so plainly.
 *
 * "Check again" is not a bypass — it re-asks the server. It exists because the
 * one failure this screen can cause is being wrong, and a stuck subscriber
 * needs something to press that is not the update button she already pressed.
 */

const COPY = {
  heading: 'Time to update MenoLisa',
  body:
    'This version is out of date and some things have stopped working properly. Update to the latest one to carry on — everything you have logged is safe and waiting for you.',
  update: 'Update MenoLisa',
  recheck: 'Already updated? Check again',
};

type UpdateRequiredScreenProps = {
  onUpdate: () => void;
  onRecheck: () => void;
};

export function UpdateRequiredScreen({ onUpdate, onRecheck }: UpdateRequiredScreenProps) {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="arrow-up-circle-outline" size={36} color={colors.primary} />
        </View>

        <Text style={styles.heading}>{COPY.heading}</Text>
        <Text style={styles.body}>{COPY.body}</Text>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.primaryButton}
          onPress={onUpdate}
          accessibilityRole="button"
          accessibilityLabel={COPY.update}
        >
          <Text style={styles.primaryButtonText} numberOfLines={1}>
            {COPY.update}
          </Text>
          <Ionicons name="open-outline" size={18} color={colors.textInverse} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.recheckWrap}
          onPress={onRecheck}
          accessibilityRole="button"
          accessibilityLabel={COPY.recheck}
        >
          <Text style={styles.recheckText}>{COPY.recheck}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing['2xl'],
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  heading: {
    ...typography.presets.heading1,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.presets.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
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
    color: colors.textInverse,
  },
  recheckWrap: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recheckText: {
    ...typography.presets.caption,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
