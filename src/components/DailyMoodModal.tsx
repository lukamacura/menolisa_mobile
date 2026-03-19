// AI image needed: assets/mood-checkin.png
// Prompt: "Soft watercolor illustration of a woman sitting cross-legged on a cozy window seat,
// seen from the side, holding a warm cup of tea, with morning light and botanical elements
// (lavender, chamomile). Palette: blush pink, sage green, warm cream. No face visible.
// Calm and introspective. Portrait 4:3."

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  colors,
  landingGradient,
  spacing,
  radii,
  typography,
  shadows,
  minTouchTarget,
} from '../theme/tokens';
import { GratitudeSuccessPanel } from './GratitudeSuccessPanel';
import { useReduceMotion } from './StaggeredZoomIn';
import { DAILY_MOOD_EMOJI, DAILY_MOOD_LABEL } from '../lib/dailyMoodShared';

const GRATITUDE_DISMISS_MS = 1800;

export type DailyMoodModalProps = {
  visible: boolean;
  /** Return true when save succeeded so the same gratitude moment as symptom logging can play. */
  onSubmit: (mood: 1 | 2 | 3 | 4) => boolean | Promise<boolean>;
  onDismiss: () => void;
  /** Called after the gratitude animation, before `onDismiss` (e.g. refresh streak). */
  onGratitudeComplete?: () => void;
};

type MoodOption = {
  value: 1 | 2 | 3 | 4;
  emoji: string;
  label: string;
};

const MOOD_OPTIONS: MoodOption[] = (
  [1, 2, 3, 4] as const
).map((value) => ({
  value,
  emoji: DAILY_MOOD_EMOJI[value],
  label: DAILY_MOOD_LABEL[value],
}));


export function DailyMoodModal({ visible, onSubmit, onDismiss, onGratitudeComplete }: DailyMoodModalProps) {
  const reduceMotion = useReduceMotion();
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const onGratitudeCompleteRef = useRef(onGratitudeComplete);
  onGratitudeCompleteRef.current = onGratitudeComplete;
  const [selected, setSelected] = useState<1 | 2 | 3 | 4 | null>(null);
  const [phase, setPhase] = useState<'form' | 'gratitude'>('form');
  const [gratitudeMood, setGratitudeMood] = useState<1 | 2 | 3 | 4 | null>(null);

  useEffect(() => {
    if (!visible) {
      setPhase('form');
      setGratitudeMood(null);
      setSelected(null);
    }
  }, [visible]);

  useEffect(() => {
    if (phase !== 'gratitude') return;
    const t = setTimeout(() => {
      setPhase('form');
      setGratitudeMood(null);
      setSelected(null);
      onGratitudeCompleteRef.current?.();
      onDismissRef.current();
    }, GRATITUDE_DISMISS_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const handleSubmit = useCallback(async () => {
    if (selected == null) return;
    const mood = selected;
    const ok = await Promise.resolve(onSubmit(mood));
    setSelected(null);
    if (ok) {
      setGratitudeMood(mood);
      setPhase('gratitude');
    }
  }, [selected, onSubmit]);

  const handleDismiss = () => {
    setSelected(null);
    setPhase('form');
    setGratitudeMood(null);
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <LinearGradient
        colors={landingGradient}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          {phase === 'gratitude' && gratitudeMood != null ? (
            <GratitudeSuccessPanel
              title="Beautiful check-in"
              subtitle={`You logged feeling ${(MOOD_OPTIONS.find((o) => o.value === gratitudeMood)?.label ?? 'today').toLowerCase()} today.\nYour mood helps Lisa understand your patterns.`}
              metaChips={[
                {
                  icon: 'heart-outline',
                  label: MOOD_OPTIONS.find((o) => o.value === gratitudeMood)?.label ?? 'Logged',
                },
                { icon: 'calendar-outline', label: 'Today' },
              ]}
              encouragement="Every check-in helps you and Lisa spot what supports you."
              reduceMotion={reduceMotion}
            />
          ) : (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={styles.container}
          >
            {/* Illustration */}
            <View style={styles.illustrationContainer}>
              <Image
                source={require('../../assets/mood-checkin.png')}
                style={styles.illustration}
                resizeMode="contain"
                accessibilityLabel="Illustration of a woman relaxing with a cup of tea"
              />
            </View>

            {/* Heading */}
            <Text style={styles.heading}>How are you feeling today?</Text>

            {/* Subtext */}
            <Text style={styles.subtext} numberOfLines={2}>
              Your mood helps Lisa understand your patterns.
            </Text>

            {/* Mood grid */}
            <View style={styles.moodRow} accessibilityRole="radiogroup" accessibilityLabel="Mood options">
              {MOOD_OPTIONS.map((option) => {
                const isSelected = selected === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setSelected(option.value)}
                    style={[
                      styles.moodBtn,
                      isSelected ? styles.moodBtnSelected : styles.moodBtnUnselected,
                    ]}
                    accessibilityRole="radio"
                    accessibilityLabel={option.label}
                    accessibilityState={{ checked: isSelected }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.moodEmoji}>{option.emoji}</Text>
                    <Text
                      style={[
                        styles.moodLabel,
                        { color: isSelected ? colors.background : colors.text },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Primary CTA */}
            <TouchableOpacity
              onPress={() => void handleSubmit()}
              disabled={selected == null}
              style={[
                styles.submitBtn,
                selected == null && styles.submitBtnDisabled,
              ]}
              accessibilityLabel="Save how I feel"
              accessibilityRole="button"
              accessibilityState={{ disabled: selected == null }}
              activeOpacity={0.82}
            >
              <Text
                style={[
                  styles.submitBtnText,
                  selected == null && styles.submitBtnTextDisabled,
                ]}
              >
                Save how I feel
              </Text>
            </TouchableOpacity>

            {/* Skip link */}
            <TouchableOpacity
              onPress={handleDismiss}
              style={styles.skipLink}
              accessibilityLabel="Skip for now"
              accessibilityRole="button"
              activeOpacity={0.6}
            >
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </Animated.View>
          )}
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['2xl'],
  },

  // Illustration
  illustrationContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  illustration: {
    width: 280,
    height: 240,
  },

  // Heading & subtext
  heading: {
    ...typography.presets.heading2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtext: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },

  // Mood options row
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
    width: '100%',
  },
  moodBtn: {
    flex: 1,
    maxWidth: 90,
    aspectRatio: 1,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...shadows.card,
    // Ensure padding so content never clips
    paddingVertical: spacing.xs,
    paddingHorizontal: 4,
  },
  moodBtnSelected: {
    backgroundColor: colors.primary,
  },
  moodBtnUnselected: {
    backgroundColor: 'rgba(255,141,161,0.10)',
  },
  moodEmoji: {
    fontSize: 28,
    lineHeight: Platform.OS === 'android' ? 36 : 32,
  },
  moodLabel: {
    ...typography.presets.caption,
    // color set dynamically inline
  },

  // Submit button
  submitBtn: {
    width: '100%',
    minHeight: minTouchTarget + 8,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.glowPrimary,
  },
  submitBtnDisabled: {
    backgroundColor: colors.primaryLight,
    ...shadows.card,
  },
  submitBtnText: {
    ...typography.presets.button,
    color: colors.background,
  },
  submitBtnTextDisabled: {
    color: 'rgba(255,255,255,0.60)',
  },

  // Skip link
  skipLink: {
    minHeight: minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  skipText: {
    ...typography.presets.caption,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
