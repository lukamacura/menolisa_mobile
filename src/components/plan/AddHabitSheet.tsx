import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../../theme/tokens';
import { AnimatedPressable } from '../AnimatedPressable';
import type { HabitKind } from '../../lib/planTypes';
import { errorMessage } from '../../lib/errorCopy';

/** The server rejects anything longer. */
const MAX_TITLE = 80;

type AddHabitSheetProps = {
  visible: boolean;
  onClose: () => void;
  onAdd: (title: string, kind: HabitKind) => Promise<void>;
};

export function AddHabitSheet({ visible, onClose, onAdd }: AddHabitSheetProps) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<HabitKind>('build');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setKind('build');
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      await onAdd(trimmed, kind);
      reset();
      onClose();
    } catch (err) {
      // The cap and the length limit both come back as 400s carrying a message
      // worth reading, so show the server's words rather than a generic line.
      setError(errorMessage(err, 'We could not add that habit.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.overlay} onPress={close} accessibilityLabel="Close">
          <Pressable
            style={[styles.sheet, { paddingBottom: Math.max(spacing.xl, insets.bottom) }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.grabber} />

            <View style={styles.header}>
              <Text style={styles.title}>Add a habit</Text>
              <Pressable
                onPress={close}
                hitSlop={10}
                style={styles.close}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Something you want to keep up"
              placeholderTextColor={colors.textMuted}
              maxLength={MAX_TITLE}
              style={styles.input}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submit}
              accessibilityLabel="Habit name"
            />

            <View style={styles.kinds}>
              <KindOption
                label="Build it"
                hint="Something to do"
                selected={kind === 'build'}
                onPress={() => setKind('build')}
              />
              <KindOption
                label="Resist it"
                hint="Something to hold off"
                selected={kind === 'resist'}
                onPress={() => setKind('resist')}
              />
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <AnimatedPressable
              containerStyle={styles.buttonWrap}
              style={[styles.button, !title.trim() && styles.buttonDisabled]}
              onPress={submit}
              disabled={!title.trim() || saving}
              accessibilityRole="button"
              accessibilityLabel="Add habit"
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <Text style={styles.buttonText}>Add habit</Text>
              )}
            </AnimatedPressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function KindOption({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.kind, selected && styles.kindSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}. ${hint}`}
    >
      <Text style={[styles.kindLabel, selected && styles.kindLabelSelected]}>{label}</Text>
      <Text style={styles.kindHint}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.presets.heading2,
    color: colors.text,
  },
  close: {
    width: minTouchTarget - 12,
    height: minTouchTarget - 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    ...typography.presets.body,
    color: colors.text,
    minHeight: minTouchTarget + 4,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kinds: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  kind: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
  },
  kindSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(244, 124, 151, 0.08)',
  },
  kindLabel: {
    ...typography.presets.bodyMedium,
    color: colors.text,
  },
  kindLabelSelected: {
    color: colors.primaryDark,
  },
  kindHint: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },
  error: {
    ...typography.presets.bodySmall,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  buttonWrap: {
    marginTop: spacing.lg,
  },
  button: {
    minHeight: minTouchTarget + 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
    ...shadows.buttonPrimary,
  },
  buttonDisabled: {
    backgroundColor: colors.borderStrong,
  },
  buttonText: {
    ...typography.presets.button,
    color: colors.textInverse,
  },
});
