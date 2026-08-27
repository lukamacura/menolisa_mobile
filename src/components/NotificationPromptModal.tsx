import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget } from '../theme/tokens';

type Props = {
  visible: boolean;
  onEnable: () => void;
  onNotNow: () => void;
};

export function NotificationPromptModal({ visible, onEnable, onNotNow }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onNotNow}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="notifications" size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Shall I remind you?</Text>
          {/* Shown after her first finished task, so it can talk about keeping
              something going rather than about a feature she has not used. The
              cap is named because it is the honest answer to the question she is
              actually asking, which is "how often will this thing buzz at me". */}
          <Text style={styles.message}>
            A nudge when your plan is ready, a word if your streak is about to break,
            and your weekly summary. Never more than two a day, and you can change
            the times in Settings.
            {Platform.OS === 'android'
              ? '\n\nAfter you tap Enable, Android will show its own confirmation — that step is required to turn notifications on.'
              : ''}
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.primaryButton}
            onPress={onEnable}
          >
            <Text style={styles.primaryButtonText}>Enable</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.secondaryButton}
            onPress={onNotNow}
          >
            <Text style={styles.secondaryButtonText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 340,
  },
  iconWrap: {
    alignSelf: 'center',
    marginBottom: spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.rowBlueBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontFamily: typography.display.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: 15,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    minHeight: minTouchTarget,
    borderRadius: radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: typography.display.semibold,
    color: colors.background,
  },
  secondaryButton: {
    minHeight: minTouchTarget,
    borderRadius: radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: typography.display.semibold,
    color: colors.textMuted,
  },
});
