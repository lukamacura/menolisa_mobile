import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget } from '../theme/tokens';

const PRIVACY_POLICY_URL = 'https://www.menolisa.com/privacy';
const OPENAI_PRIVACY_URL = 'https://openai.com/policies/privacy-policy';

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
            <Ionicons name="shield-checkmark" size={28} color={colors.primary} />
          </View>
          <Text style={styles.title}>Before you begin</Text>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Medical disclaimer */}
            <View style={styles.section}>
              <Ionicons name="medkit-outline" size={18} color={colors.textMuted} style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Medical disclaimer</Text>
              <Text style={styles.sectionBody}>
                MenoLisa provides wellness information only. It is not a substitute for professional
                medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider
                before making any health decisions.
              </Text>
            </View>

            {/* AI data sharing */}
            <View style={styles.section}>
              <Ionicons name="sparkles-outline" size={18} color={colors.textMuted} style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>AI & data sharing</Text>
              <Text style={styles.sectionBody}>
                To power your personalised conversations and health insights, MenoLisa sends the
                following information to <Text style={styles.bold}>OpenAI</Text> (an AI service
                provider):
              </Text>
              <View style={styles.bulletList}>
                <Text style={styles.bullet}>• Your chat messages</Text>
                <Text style={styles.bullet}>• Your symptom logs</Text>
                <Text style={styles.bullet}>• Basic health profile (age range, menopause stage, goals)</Text>
              </View>
              <Text style={styles.sectionBody}>
                This data is used solely to generate AI responses and health summaries. It is not
                sold to third parties.{' '}
                <Text
                  style={styles.link}
                  onPress={() => Linking.openURL(OPENAI_PRIVACY_URL)}
                  accessibilityRole="link"
                >
                  OpenAI Privacy Policy
                </Text>
                .
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
              accessibilityRole="link"
              style={styles.privacyLink}
            >
              <Text style={styles.link}>View MenoLisa Privacy Policy</Text>
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.primaryButton}
            onPress={onAccept}
            accessibilityRole="button"
            accessibilityLabel="I agree and continue"
          >
            <Text style={styles.primaryButtonText}>I agree and continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 360,
    maxHeight: '85%',
  },
  iconWrap: {
    alignSelf: 'center',
    marginBottom: spacing.sm,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.rowBlueBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.presets.heading2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  scroll: {
    flexGrow: 0,
    maxHeight: 340,
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  sectionIcon: {
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.presets.bodyMedium,
    color: colors.text,
  },
  sectionBody: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    lineHeight: 20,
  },
  bulletList: {
    gap: 2,
    paddingLeft: spacing.xs,
  },
  bullet: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    lineHeight: 20,
  },
  bold: {
    fontFamily: typography.family.semibold,
    color: colors.text,
  },
  link: {
    color: colors.primary,
    fontFamily: typography.family.semibold,
    fontSize: 13,
  },
  privacyLink: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    minHeight: minTouchTarget,
    borderRadius: radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryButtonText: {
    ...typography.presets.button,
    color: colors.background,
  },
});
