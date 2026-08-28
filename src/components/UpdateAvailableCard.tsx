import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget } from '../theme/tokens';

/**
 * The soft half of the update prompt: a newer build exists, nothing is broken.
 *
 * It reads as information rather than warning on purpose. The daily loop is
 * where she comes to find out what to do today, and an app-maintenance chore
 * dressed in the app's alarm colour would sit above her plan looking like
 * something had gone wrong with her health.
 *
 * Dismissal is per version — see `useUpdateNudge`. Waving this away silences
 * this release and no other.
 */

const COPY = {
  heading: 'A new MenoLisa is ready',
  /** Named per store, because "update" means a different destination on each. */
  body: (version: string) =>
    Platform.OS === 'ios'
      ? `Version ${version} is waiting in the App Store.`
      : `Version ${version} is waiting on Google Play.`,
  update: 'Update',
  dismiss: 'Dismiss',
};

type UpdateAvailableCardProps = {
  latest: string;
  onUpdate: () => void;
  onDismiss: () => void;
};

export function UpdateAvailableCard({
  latest,
  onUpdate,
  onDismiss,
}: UpdateAvailableCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="arrow-up-circle-outline" size={20} color={colors.info} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.heading}>{COPY.heading}</Text>
          <Text style={styles.body}>{COPY.body(latest)}</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.dismiss}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={COPY.dismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.button}
        onPress={onUpdate}
        accessibilityRole="button"
        accessibilityLabel={COPY.update}
      >
        <Text style={styles.buttonText}>{COPY.update}</Text>
        <Ionicons name="open-outline" size={15} color={colors.info} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.infoBg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconWrap: {
    paddingTop: 1,
  },
  copy: {
    flex: 1,
  },
  heading: {
    ...typography.presets.label,
    color: colors.text,
  },
  body: {
    ...typography.presets.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  dismiss: {
    minWidth: minTouchTarget - 20,
    alignItems: 'flex-end',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.sm,
    // Indented to the copy above rather than the icon, so the button reads as
    // part of the sentence it follows.
    marginLeft: 20 + spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    minHeight: minTouchTarget - 8,
    backgroundColor: colors.card,
  },
  buttonText: {
    ...typography.presets.buttonSmall,
    color: colors.info,
  },
});
