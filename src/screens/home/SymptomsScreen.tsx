import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { apiFetchWithAuth, API_CONFIG } from '../../lib/api';
import { TRIGGER_OPTIONS, type TimeSelection } from '../../lib/symptomTrackerConstants';
import { getSymptomIconName } from '../../lib/symptomIconMapping';

type HomeStackParamList = {
  Dashboard: undefined;
  Symptoms: undefined;
  SymptomLogs: undefined;
};
type NavProp = NativeStackNavigationProp<HomeStackParamList, 'Symptoms'>;
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../../theme/tokens';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';
import { SymptomsSkeleton, ContentTransition } from '../../components/skeleton';

type Symptom = {
  id: string;
  name: string;
  icon: string;
  user_id?: string;
  is_default?: boolean;
  created_at?: string;
};

const SEVERITY_OPTIONS = [
  { value: 1, label: 'Mild', emoji: '😊', description: 'Noticeable but manageable' },
  { value: 2, label: 'Moderate', emoji: '😐', description: 'Affecting my day' },
  { value: 3, label: 'Severe', emoji: '😣', description: 'Hard to function' },
];

export function SymptomsScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSymptom, setSelectedSymptom] = useState<Symptom | null>(null);
  const [severity, setSeverity] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  const [timeSelection, setTimeSelection] = useState<TimeSelection>('now');
  const [customTime, setCustomTime] = useState('');
  const [modalStep, setModalStep] = useState<1 | 2 | 3 | 4>(1);
  const [customTrigger, setCustomTrigger] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [showLogSuccess, setShowLogSuccess] = useState(false);

  const successScale = useSharedValue(0);
  const successOpacity = useSharedValue(0);
  const successTextOpacity = useSharedValue(0);
  const successRingScale = useSharedValue(0.6);
  const successRingOpacity = useSharedValue(0.4);
  const hasRunSuccessAnimation = useRef(false);

  const loadSymptoms = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetchWithAuth(API_CONFIG.endpoints.symptoms);
      setSymptoms(Array.isArray(data) ? data : data?.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load symptoms');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTodayCount = useCallback(async () => {
    try {
      const res = await apiFetchWithAuth(
        `${API_CONFIG.endpoints.symptomLogs}?days=1`
      );
      const logs = res?.data ?? [];
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const count = logs.filter(
        (log: { logged_at?: string }) =>
          log.logged_at && new Date(log.logged_at) >= todayStart
      ).length;
      setTodayCount(count);
    } catch {
      setTodayCount(null);
    }
  }, []);

  useEffect(() => {
    loadSymptoms();
  }, [loadSymptoms]);

  useEffect(() => {
    loadTodayCount();
  }, [loadTodayCount]);

  const closeModalAndRefresh = useCallback(() => {
    setModalVisible(false);
    setSelectedSymptom(null);
    setShowLogSuccess(false);
    hasRunSuccessAnimation.current = false;
    loadSymptoms();
    loadTodayCount();
  }, [loadSymptoms, loadTodayCount]);

  useEffect(() => {
    if (!showLogSuccess || hasRunSuccessAnimation.current) return;
    hasRunSuccessAnimation.current = true;

    const springConfig = { damping: 14, stiffness: 120 };
    successOpacity.value = withTiming(1, { duration: 200 });
    successScale.value = withSpring(1, springConfig);
    successRingScale.value = withSequence(
      withTiming(1.4, { duration: 600 }),
      withTiming(1.5, { duration: 200 })
    );
    successRingOpacity.value = withSequence(
      withTiming(0.25, { duration: 400 }),
      withDelay(200, withTiming(0, { duration: 400 }))
    );
    successTextOpacity.value = withDelay(400, withTiming(1, { duration: 350 }));

    const timer = setTimeout(() => {
      closeModalAndRefresh();
    }, 1600);

    return () => clearTimeout(timer);
  }, [showLogSuccess, closeModalAndRefresh, successScale, successOpacity, successTextOpacity, successRingScale, successRingOpacity]);

  const successIconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
    opacity: successOpacity.value,
  }));
  const successRingAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successRingScale.value }],
    opacity: successRingOpacity.value,
  }));
  const successTextAnimatedStyle = useAnimatedStyle(() => ({
    opacity: successTextOpacity.value,
  }));

  const openLogModal = (symptom: Symptom) => {
    setSelectedSymptom(symptom);
    setSeverity(1);
    setNotes('');
    setSelectedTriggers([]);
    setTimeSelection('now');
    setCustomTime('');
    setCustomTrigger('');
    setModalStep(1);
    setModalVisible(true);
    setShowLogSuccess(false);
    hasRunSuccessAnimation.current = false;
    successScale.value = 0;
    successOpacity.value = 0;
    successTextOpacity.value = 0;
    successRingScale.value = 0.6;
    successRingOpacity.value = 0.4;
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedSymptom(null);
    setShowLogSuccess(false);
  };

  const toggleTrigger = (trigger: string) => {
    setSelectedTriggers((prev) =>
      prev.includes(trigger) ? prev.filter((t) => t !== trigger) : [...prev, trigger]
    );
  };

  const addCustomTrigger = () => {
    const t = customTrigger.trim();
    if (t && !selectedTriggers.includes(t)) {
      setSelectedTriggers((prev) => [...prev, t]);
      setCustomTrigger('');
    }
  };

  const getLoggedAtTimestamp = (): string | undefined => {
    if (timeSelection === 'now') return undefined;
    const now = new Date();
    if (timeSelection === 'earlier-today') {
      if (customTime) {
        const [hours, minutes] = customTime.split(':').map(Number);
        const logTime = new Date(now);
        logTime.setHours(hours, minutes, 0, 0);
        return logTime.toISOString();
      }
      const logTime = new Date(now);
      logTime.setHours(logTime.getHours() - 2);
      return logTime.toISOString();
    }
    if (timeSelection === 'yesterday') {
      const logTime = new Date(now);
      logTime.setDate(logTime.getDate() - 1);
      if (customTime) {
        const [hours, minutes] = customTime.split(':').map(Number);
        logTime.setHours(hours, minutes, 0, 0);
      } else {
        logTime.setHours(now.getHours(), now.getMinutes(), 0, 0);
      }
      return logTime.toISOString();
    }
    return undefined;
  };

  const submitLog = async () => {
    if (!selectedSymptom) return;
    setSubmitting(true);
    try {
      await apiFetchWithAuth(API_CONFIG.endpoints.symptomLogs, {
        method: 'POST',
        body: JSON.stringify({
          symptomId: selectedSymptom.id,
          severity,
          triggers: selectedTriggers,
          notes: notes.trim() || undefined,
          loggedAt: getLoggedAtTimestamp(),
        }),
      });
      setSubmitting(false);
      setShowLogSuccess(true);
    } catch (e) {
      Alert.alert(
        'Error',
        e instanceof Error ? e.message : 'Failed to log symptom'
      );
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.listContent}>
          <SymptomsSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ContentTransition>
      {error && (
        <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </StaggeredZoomIn>
      )}
      <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion} style={{ flex: 1 }}>
      <FlatList
        data={symptoms}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {todayCount !== null ? (
              <View style={styles.todayBanner}>
                <Text style={styles.todayBannerText}>
                  {todayCount === 0
                    ? "Log how you're feeling — tap any symptom below"
                    : todayCount === 1
                      ? "You've logged 1 symptom today"
                      : `You've logged ${todayCount} symptoms today`}
                </Text>
              </View>
            ) : null}
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.viewHistoryLink}
              onPress={() => navigation.navigate('SymptomLogs')}
            >
              <Ionicons name="time" size={20} color={colors.primary} />
              <Text style={styles.viewHistoryLinkText}>View symptom history</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No symptoms set up yet. You can add and manage symptoms in the web app, or ask your coach in Chat to log one for you.
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={1}
            style={styles.symptomRow}
            onPress={() => openLogModal(item)}
          >
            <Ionicons
              name={getSymptomIconName(item.name, item.icon) as any}
              size={22}
              color={colors.primary}
            />
            <Text style={styles.symptomName}>{item.name}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      />
      </StaggeredZoomIn>
      </ContentTransition>
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {showLogSuccess ? (
              <View style={styles.successOverlay}>
                <Animated.View style={[styles.successRing, successRingAnimatedStyle]} />
                <Animated.View style={[styles.successIconWrap, successIconAnimatedStyle]}>
                  <Ionicons name="checkmark-circle" size={80} color={colors.success} />
                </Animated.View>
                <Animated.Text style={[styles.successTitle, successTextAnimatedStyle]}>
                  Logged
                </Animated.Text>
                <Animated.Text style={[styles.successSubtitle, successTextAnimatedStyle]}>
                  You're tracking it | Lisa can spot patterns over time
                </Animated.Text>
              </View>
            ) : (
              <>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Rate your {selectedSymptom?.name}
              </Text>
              <TouchableOpacity activeOpacity={1} onPress={closeModal} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.stepIndicator}>
              {([1, 2, 3, 4] as const).map((step) => (
                <View key={step} style={styles.stepDotWrap}>
                  <View
                    style={[
                      styles.stepDot,
                      modalStep === step && styles.stepDotActive,
                      modalStep > step && styles.stepDotDone,
                    ]}
                  >
                    <Text
                      style={[
                        styles.stepDotText,
                        (modalStep === step || modalStep > step) && styles.stepDotTextActive,
                      ]}
                    >
                      {modalStep > step ? '✓' : step}
                    </Text>
                  </View>
                  {step < 4 && <View style={styles.stepLine} />}
                </View>
              ))}
            </View>
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
            >
              {modalStep === 1 && (
                <>
                  <Text style={styles.label}>How bad is it?</Text>
                  <View style={styles.severityRow}>
                    {SEVERITY_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        activeOpacity={1}
                        style={[
                          styles.severityBtn,
                          severity === opt.value && styles.severityBtnActive,
                        ]}
                        onPress={() => setSeverity(opt.value)}
                      >
                        <Text style={styles.severityEmoji}>{opt.emoji}</Text>
                        <Text
                          style={[
                            styles.severityLabel,
                            severity === opt.value && styles.severityLabelActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                        <Text
                          style={[
                            styles.severityDescription,
                            severity === opt.value && styles.severityDescriptionActive,
                          ]}
                          numberOfLines={2}
                        >
                          {opt.description}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              {modalStep === 2 && (
                <>
                  <Text style={styles.label}>Any idea what triggered it? (optional)</Text>
                  <View style={styles.triggerChips}>
                    {TRIGGER_OPTIONS.map((trigger) => (
                      <TouchableOpacity
                        key={trigger}
                        activeOpacity={1}
                        style={[
                          styles.triggerChip,
                          selectedTriggers.includes(trigger) && styles.triggerChipActive,
                        ]}
                        onPress={() => toggleTrigger(trigger)}
                      >
                        <Text
                          style={[
                            styles.triggerChipText,
                            selectedTriggers.includes(trigger) && styles.triggerChipTextActive,
                          ]}
                        >
                          {trigger}{selectedTriggers.includes(trigger) ? ' ✓' : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.customTriggerRow}>
                    <TextInput
                      style={styles.customTriggerInput}
                      value={customTrigger}
                      onChangeText={setCustomTrigger}
                      placeholder="Custom trigger"
                      placeholderTextColor={colors.textMuted}
                      onSubmitEditing={addCustomTrigger}
                    />
                    <TouchableOpacity
                      activeOpacity={1}
                      style={styles.addTriggerBtn}
                      onPress={addCustomTrigger}
                    >
                      <Text style={styles.addTriggerBtnText}>+ Add</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              {modalStep === 3 && (
                <>
                  <Text style={styles.label}>When did this happen?</Text>
                  <TouchableOpacity
                    activeOpacity={1}
                    style={[
                      styles.timingOption,
                      timeSelection === 'now' && styles.timingOptionActive,
                    ]}
                    onPress={() => { setTimeSelection('now'); setCustomTime(''); }}
                  >
                    <Text style={[styles.timingOptionText, timeSelection === 'now' && styles.timingOptionTextActive]}>
                      Just now{timeSelection === 'now' ? ' ✓' : ''}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={1}
                    style={[
                      styles.timingOption,
                      timeSelection === 'earlier-today' && styles.timingOptionActive,
                    ]}
                    onPress={() => setTimeSelection('earlier-today')}
                  >
                    <Text style={[styles.timingOptionText, timeSelection === 'earlier-today' && styles.timingOptionTextActive]}>
                      Earlier today{timeSelection === 'earlier-today' ? ' ✓' : ''}
                    </Text>
                  </TouchableOpacity>
                  {timeSelection === 'earlier-today' && (
                    <TextInput
                      style={styles.timePickerInput}
                      value={customTime}
                      onChangeText={setCustomTime}
                      placeholder="HH:MM"
                      placeholderTextColor={colors.textMuted}
                    />
                  )}
                  <TouchableOpacity
                    activeOpacity={1}
                    style={[
                      styles.timingOption,
                      timeSelection === 'yesterday' && styles.timingOptionActive,
                    ]}
                    onPress={() => setTimeSelection('yesterday')}
                  >
                    <Text style={[styles.timingOptionText, timeSelection === 'yesterday' && styles.timingOptionTextActive]}>
                      Yesterday{timeSelection === 'yesterday' ? ' ✓' : ''}
                    </Text>
                  </TouchableOpacity>
                  {timeSelection === 'yesterday' && (
                    <TextInput
                      style={styles.timePickerInput}
                      value={customTime}
                      onChangeText={setCustomTime}
                      placeholder="HH:MM"
                      placeholderTextColor={colors.textMuted}
                    />
                  )}
                </>
              )}
              {modalStep === 4 && (
                <>
                  <Text style={styles.label}>Quick note (optional)</Text>
                  <TextInput
                    style={styles.notesInput}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Was in a meeting when it hit..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={3}
                  />
                </>
              )}
            </ScrollView>
            <View style={[styles.modalFooter, { paddingBottom: Math.max(spacing.xl, insets.bottom) }]}>
              <TouchableOpacity
                activeOpacity={1}
                style={styles.footerBtnSecondary}
                onPress={() => (modalStep === 1 ? closeModal() : setModalStep((s) => (s - 1) as 1 | 2 | 3 | 4))}
              >
                <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
                <Text style={styles.footerBtnSecondaryText}>
                  {modalStep === 1 ? 'Cancel' : 'Back'}
                </Text>
              </TouchableOpacity>
              {modalStep < 4 ? (
                <TouchableOpacity
                  activeOpacity={1}
                  style={styles.footerBtnPrimary}
                  onPress={() => setModalStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
                >
                  <Text style={styles.footerBtnPrimaryText}>Next</Text>
                  <Ionicons name="chevron-forward" size={20} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  activeOpacity={1}
                  style={[styles.submitBtn, styles.submitBtnFlex, submitting && styles.submitBtnDisabled]}
                  onPress={submitLog}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  errorBanner: {
    backgroundColor: colors.dangerBg,
    padding: spacing.sm,
    marginHorizontal: spacing.lg,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
  },
  errorText: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.danger,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  todayBanner: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
  },
  todayBannerText: {
    fontSize: 15,
    fontFamily: typography.family.medium,
    color: colors.text,
  },
  viewHistoryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    minHeight: minTouchTarget,
  },
  viewHistoryLinkText: {
    flex: 1,
    fontSize: 15,
    fontFamily: typography.family.medium,
    color: colors.primary,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  symptomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    minHeight: minTouchTarget + spacing.sm,
  },
  symptomName: {
    flex: 1,
    fontSize: 16,
    fontFamily: typography.family.medium,
    color: colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    height: '85%',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: typography.family.semibold,
    color: colors.text,
  },
  modalBody: {
    flex: 1,
    padding: spacing.lg,
  },
  modalBodyContent: {
    paddingBottom: spacing['2xl'],
    flexGrow: 1,
  },
  label: {
    fontSize: 14,
    fontFamily: typography.family.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepDotWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepDotDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepDotText: {
    fontSize: 12,
    fontFamily: typography.family.semibold,
    color: colors.textMuted,
  },
  stepDotTextActive: {
    color: '#fff',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  severityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  severityBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 72,
  },
  severityBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  severityEmoji: {
    fontSize: 24,
    marginBottom: 2,
  },
  severityLabel: {
    fontSize: 12,
    fontFamily: typography.family.semibold,
    color: colors.text,
  },
  severityLabelActive: {
    color: '#fff',
  },
  severityDescription: {
    fontSize: 9,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  severityDescriptionActive: {
    color: 'rgba(255,255,255,0.9)',
  },
  triggerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  triggerChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  triggerChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  triggerChipText: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.text,
  },
  triggerChipTextActive: {
    color: '#fff',
  },
  customTriggerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  customTriggerInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 16,
    fontFamily: typography.family.regular,
    color: colors.text,
  },
  addTriggerBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  addTriggerBtnText: {
    fontSize: 14,
    fontFamily: typography.family.semibold,
    color: colors.background,
  },
  timingOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  timingOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timingOptionText: {
    fontSize: 16,
    fontFamily: typography.family.medium,
    color: colors.text,
  },
  timingOptionTextActive: {
    color: '#fff',
  },
  timePickerInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 16,
    marginBottom: spacing.sm,
    marginLeft: spacing.lg,
    color: colors.text,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
    alignItems: 'center',
    flexShrink: 0,
    backgroundColor: colors.background,
  },
  successOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  successRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: colors.success,
    backgroundColor: 'transparent',
  },
  successIconWrap: {
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontSize: 24,
    fontFamily: typography.family.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  successSubtitle: {
    fontSize: 15,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  footerBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footerBtnSecondaryText: {
    fontSize: 15,
    fontFamily: typography.family.medium,
    color: colors.textMuted,
  },
  footerBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    ...shadows.buttonPrimary,
  },
  footerBtnPrimaryText: {
    fontSize: 16,
    fontFamily: typography.family.semibold,
    color: colors.background,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 16,
    fontFamily: typography.family.regular,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    alignItems: 'center',
    minHeight: minTouchTarget,
    justifyContent: 'center',
    ...shadows.buttonPrimary,
  },
  submitBtnFlex: {
    flex: 1,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    fontSize: 17,
    fontFamily: typography.family.semibold,
    color: colors.background,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
