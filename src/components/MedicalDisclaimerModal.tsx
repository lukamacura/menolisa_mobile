import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget } from '../theme/tokens';

type Props = {
  visible: boolean;
  onAccept: () => void;
};

export function MedicalDisclaimerModal({ visible, onAccept }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="information-circle" size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Medical Disclaimer</Text>
          <Text style={styles.message}>
            MenoLisa is for informational purposes only and is not a substitute for professional
            medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider.
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.primaryButton}
            onPress={onAccept}
            accessibilityRole="button"
            accessibilityLabel="I understand and accept the medical disclaimer"
          >
            <Text style={styles.primaryButtonText}>I understand</Text>
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
    ...typography.presets.heading2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.presets.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    minHeight: minTouchTarget,
    borderRadius: radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    ...typography.presets.button,
    color: colors.background,
  },
});
