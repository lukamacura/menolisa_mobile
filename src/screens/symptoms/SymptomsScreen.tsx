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
  Image,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { apiFetchWithAuth, API_CONFIG } from '../../lib/api';
import { errorMessage } from '../../lib/errorCopy';
import { getTriggersForSymptom, type TimeSelection } from '../../lib/symptomTrackerConstants';
import {
  TIME_INPUT_MAX_LENGTH,
  TIME_INPUT_PLACEHOLDER,
  formatTimeInput,
  resolveLoggedAt,
} from '../../lib/symptomTime';
import { getSymptomIllustration } from '../../lib/symptomIllustration';
import { useSymptomsToday } from '../../hooks/useSymptomsToday';

import type { TodayStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<TodayStackParamList, 'Symptoms'>;
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../../theme/tokens';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';
import {
  GratitudeSuccessPanel,
  GRATITUDE_DISMISS_MS,
} from '../../components/GratitudeSuccessPanel';
import { SymptomsSkeleton, ContentTransition } from '../../components/skeleton';

type Symptom = {
  id: string;
  name: string;
  icon: string;
  user_id?: string;
  is_default?: boolean;
  created_at?: string;
};

type SuccessSnapshot = {
  symptomName: string;
  severityLabel: string;
  totalToday: number | null;
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addVisible, setAddVisible] = useState(false);
  const [newSymptomName, setNewSymptomName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSymptom, setSelectedSymptom] = useState<Symptom | null>(null);
  const [severity, setSeverity] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  const [timeSelection, setTimeSelection] = useState<TimeSelection>('now');
  const [customTime, setCustomTime] = useState('');
  const [modalStep, setModalStep] = useState(1);
  const [customTrigger, setCustomTrigger] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Same count the hub shows, from the same hook — this screen used to keep its
  // own copy of the fetch and the local-midnight cut, so the two could disagree.
  const { count: todayCount, refresh: loadTodayCount } = useSymptomsToday();
  const [showLogSuccess, setShowLogSuccess] = useState(false);
  const [successSnapshot, setSuccessSnapshot] = useState<SuccessSnapshot | null>(null);

  const hasRunSuccessAnimation = useRef(false);

  const loadSymptoms = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetchWithAuth(API_CONFIG.endpoints.symptoms);
      setSymptoms(Array.isArray(data) ? data : data?.data ?? []);
    } catch (e) {
      setError(errorMessage(e, 'We could not load your symptoms.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSymptoms();
  }, [loadSymptoms]);

  /**
   * Pull-to-refresh, which this screen was the only list in the app to lack.
   *
   * It also only ever fetched on mount, so a failed load left her stuck with no
   * way to retry short of backing out to the hub and coming in again — and
   * nothing on screen suggested that would help.
   */
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([loadSymptoms(), loadTodayCount()])
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [loadSymptoms, loadTodayCount]);

  const closeModalAndRefresh = useCallback(() => {
    setModalVisible(false);
    setSelectedSymptom(null);
    setShowLogSuccess(false);
    setSuccessSnapshot(null);
    hasRunSuccessAnimation.current = false;
    loadSymptoms();
    loadTodayCount();
  }, [loadSymptoms, loadTodayCount]);

  useEffect(() => {
    if (!showLogSuccess || hasRunSuccessAnimation.current) return;
    hasRunSuccessAnimation.current = true;

    const timer = setTimeout(() => {
      closeModalAndRefresh();
    }, GRATITUDE_DISMISS_MS);

    return () => clearTimeout(timer);
  }, [showLogSuccess, closeModalAndRefresh]);

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
    setSuccessSnapshot(null);
    hasRunSuccessAnimation.current = false;
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedSymptom(null);
    setShowLogSuccess(false);
    setSuccessSnapshot(null);
  };

  /**
   * Adding one of her own — the missing half of long-press-to-delete.
   *
   * `POST /api/symptoms` has existed all along; the app just never called it,
   * so the tracker was a one-way ratchet. She could destroy a symptom she had
   * created (an accidental long-press on a tile she meant to tap, confirmed out
   * of muscle memory) and then had no way to bring it back without finding a
   * laptop. Deleting something you cannot recreate is the part that stings.
   *
   * The server defaults `icon` and matches nothing in the illustration set for
   * a custom name, so the grid falls back to an Ionicon — see
   * `getSymptomIllustration`. No icon picker here on purpose: naming the thing
   * is the whole job.
   */
  const openAddModal = useCallback(() => {
    setNewSymptomName('');
    setAddError(null);
    setAddVisible(true);
  }, []);

  const closeAddModal = useCallback(() => {
    if (addSubmitting) return;
    setAddVisible(false);
    setNewSymptomName('');
    setAddError(null);
  }, [addSubmitting]);

  const trimmedNewName = newSymptomName.trim();
  const duplicateName = symptoms.some(
    (s) => s.name.trim().toLowerCase() === trimmedNewName.toLowerCase()
  );
  const canSubmitNewSymptom = trimmedNewName.length > 0 && !duplicateName && !addSubmitting;

  const submitNewSymptom = useCallback(async () => {
    const name = newSymptomName.trim();
    if (!name || addSubmitting) return;
    setAddSubmitting(true);
    setAddError(null);
    try {
      await apiFetchWithAuth(API_CONFIG.endpoints.symptoms, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setAddVisible(false);
      setNewSymptomName('');
      await loadSymptoms();
    } catch (e) {
      setAddError(errorMessage(e, 'We could not add that symptom.'));
    } finally {
      setAddSubmitting(false);
    }
  }, [newSymptomName, addSubmitting, loadSymptoms]);

  const handleDeleteSymptom = useCallback((symptom: Symptom) => {
    if (symptom.is_default) {
      Alert.alert('Cannot delete', 'Default symptoms cannot be removed.');
      return;
    }
    const symptomId = symptom.id;
    Alert.alert(
      'Delete symptom?',
      `Remove "${symptom.name}" from your list? All logs for this symptom will remain, and you can add it back any time with "Add your own".`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const runDelete = async () => {
              await apiFetchWithAuth(API_CONFIG.endpoints.symptoms, {
                method: 'DELETE',
                body: JSON.stringify({ id: symptomId }),
              });
              setSymptoms((prev) => prev.filter((s) => s.id !== symptomId));
              loadSymptoms();
            };
            runDelete().catch((e) => {
              Alert.alert('Could not delete', errorMessage(e, 'We could not remove that symptom.'));
            });
          },
        },
      ]
    );
  }, [loadSymptoms]);

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

  // Recomputed on every keystroke so the footer button and the inline hint
  // agree with each other and with what submit will actually send.
  const loggedAtResult = resolveLoggedAt(timeSelection, customTime);
  const timeError = loggedAtResult.valid ? null : loggedAtResult.message;

  const submitLog = async () => {
    if (!selectedSymptom) return;
    // Re-checked here as well as on the button: a malformed time must never
    // reach `.toISOString()`, which throws and loses the log she just described.
    if (!loggedAtResult.valid) return;
    setSubmitting(true);
    try {
      await apiFetchWithAuth(API_CONFIG.endpoints.symptomLogs, {
        method: 'POST',
        body: JSON.stringify({
          symptomId: selectedSymptom.id,
          severity,
          triggers: selectedTriggers,
          notes: notes.trim() || undefined,
          loggedAt: loggedAtResult.loggedAt,
        }),
      });
      const severityLabel =
        SEVERITY_OPTIONS.find((option) => option.value === severity)?.label ?? 'Logged';
      setSuccessSnapshot({
        symptomName: selectedSymptom.name,
        severityLabel,
        totalToday: todayCount != null ? todayCount + 1 : null,
      });
      setSubmitting(false);
      setShowLogSuccess(true);
    } catch (e) {
      // Her description is still in the form behind this alert, so the copy
      // says the log was not saved — not that it was lost.
      Alert.alert(
        'Could not save',
        errorMessage(e, 'We could not save that log. Your entry is still here — try again.')
      );
      setSubmitting(false);
    }
  };

  const symptomTriggers = getTriggersForSymptom(selectedSymptom?.name ?? '');
  const hasTriggers = symptomTriggers.length > 0;
  const totalSteps = hasTriggers ? 4 : 3;
  /** The timing step — the only one that can hold input we refuse to send. */
  const timingStep = hasTriggers ? 3 : 2;
  const canLeaveStep = modalStep !== timingStep || loggedAtResult.valid;

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
      {/* Only when there is still a grid to sit above. With an empty list the
          empty state carries the same message and a retry, and showing both
          reads as two separate things having gone wrong. */}
      {error && symptoms.length > 0 && (
        <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </StaggeredZoomIn>
      )}
      <FlatList
        data={symptoms}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {todayCount !== null ? (
              <View style={styles.todayBanner}>
                <Text style={styles.todayBannerText}>
                  {todayCount === 0
                    ? "Log how you're feeling - tap any symptom below"
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
          /* An empty list after a failed request is not an empty list — it is a
             request we never got an answer to. Saying "no symptoms set up yet"
             there told her something false about her own account and offered no
             way to find out otherwise. */
          error ? (
            <View style={styles.emptyStateWrap}>
              <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>We could not load your symptoms</Text>
              <Text style={styles.emptyText}>{error}</Text>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.emptyActionButton}
                onPress={() => {
                  setLoading(true);
                  loadSymptoms();
                }}
                accessibilityRole="button"
                accessibilityLabel="Try loading your symptoms again"
              >
                <Ionicons name="refresh" size={18} color={colors.background} />
                <Text style={styles.emptyActionText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyStateWrap}>
              <Ionicons name="add-circle-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No symptoms set up yet</Text>
              <Text style={styles.emptyText}>
                Add the ones you want to keep an eye on, or ask Lisa in Chat to log one for you.
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.emptyActionButton}
                onPress={openAddModal}
                accessibilityRole="button"
                accessibilityLabel="Add your own symptom"
              >
                <Ionicons name="add" size={18} color={colors.background} />
                <Text style={styles.emptyActionText}>Add your own</Text>
              </TouchableOpacity>
            </View>
          )
        }
        ListFooterComponent={
          <>
            {/* The visible half of the pair. Long-press-to-delete has no
                affordance at all, so without this the only discoverable
                operation on her own symptoms was destroying them. */}
            {symptoms.length > 0 ? (
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.addSymptomButton}
                onPress={openAddModal}
                accessibilityRole="button"
                accessibilityLabel="Add your own symptom"
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.addSymptomButtonText}>Add your own</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.symptomsDisclaimer}>
              Symptom logs are for personal tracking only and are not a medical record. Share with your healthcare provider.
            </Text>
          </>
        }
        renderItem={({ item, index }) => {
          const illustration = getSymptomIllustration(item.name, item.icon);
          return (
            <StaggeredZoomIn delayIndex={index + 2} reduceMotion={reduceMotion} style={styles.gridItem}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.symptomCard}
                onPress={() => openLogModal(item)}
                onLongPress={() => handleDeleteSymptom(item)}
                accessibilityRole="button"
                accessibilityLabel={item.name}
              >
                <View style={styles.symptomCardImageWrap}>
                  {illustration.type === 'image' ? (
                    <Image
                      source={illustration.source}
                      style={styles.symptomCardImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.symptomCardIconFallback}>
                      <Ionicons
                        name={illustration.iconName as any}
                        size={32}
                        color={colors.primary}
                      />
                    </View>
                  )}
                </View>
                <Text style={styles.symptomCardLabel} numberOfLines={2}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            </StaggeredZoomIn>
          );
        }}
      />
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
              <GratitudeSuccessPanel
                title="Beautiful check-in"
                subtitle={`You logged ${successSnapshot?.symptomName ?? 'your symptom'} as ${(successSnapshot?.severityLabel ?? 'tracked').toLowerCase()}.\nThis gives Lisa better data to support you.`}
                metaChips={[
                  { icon: 'medal-outline', label: successSnapshot?.severityLabel ?? 'Logged' },
                  ...(successSnapshot?.totalToday != null
                    ? [{ icon: 'calendar-outline' as const, label: `Today: ${successSnapshot.totalToday}` }]
                    : []),
                ]}
                encouragement="Every log is a step toward feeling more understood."
                reduceMotion={reduceMotion}
              />
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
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
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
                  {step < totalSteps && <View style={styles.stepLine} />}
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
              {modalStep === 2 && hasTriggers && (
                <>
                  <Text style={styles.label}>Any idea what triggered it? (optional)</Text>
                  <View style={styles.triggerChips}>
                    {symptomTriggers.map((trigger) => (
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
              {((modalStep === 3 && hasTriggers) || (modalStep === 2 && !hasTriggers)) && (
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
                      style={[styles.timePickerInput, timeError && styles.timePickerInputError]}
                      value={customTime}
                      onChangeText={(text) => setCustomTime(formatTimeInput(text))}
                      placeholder={TIME_INPUT_PLACEHOLDER}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      maxLength={TIME_INPUT_MAX_LENGTH}
                      accessibilityLabel="Time this happened, 24-hour clock"
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
                      style={[styles.timePickerInput, timeError && styles.timePickerInputError]}
                      value={customTime}
                      onChangeText={(text) => setCustomTime(formatTimeInput(text))}
                      placeholder={TIME_INPUT_PLACEHOLDER}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      maxLength={TIME_INPUT_MAX_LENGTH}
                      accessibilityLabel="Time this happened, 24-hour clock"
                    />
                  )}
                  {timeError && <Text style={styles.timeErrorText}>{timeError}</Text>}
                </>
              )}
              {((modalStep === 4 && hasTriggers) || (modalStep === 3 && !hasTriggers)) && (
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
                onPress={() => (modalStep === 1 ? closeModal() : setModalStep((s) => s - 1))}
              >
                <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
                <Text style={styles.footerBtnSecondaryText}>
                  {modalStep === 1 ? 'Cancel' : 'Back'}
                </Text>
              </TouchableOpacity>
              {modalStep < totalSteps ? (
                <TouchableOpacity
                  activeOpacity={1}
                  style={[styles.footerBtnPrimary, !canLeaveStep && styles.submitBtnDisabled]}
                  onPress={() => setModalStep((s) => s + 1)}
                  disabled={!canLeaveStep}
                >
                  <Text style={styles.footerBtnPrimaryText}>Next</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.textInverse} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  activeOpacity={1}
                  style={[
                    styles.submitBtn,
                    styles.submitBtnFlex,
                    (submitting || !loggedAtResult.valid) && styles.submitBtnDisabled,
                  ]}
                  onPress={submitLog}
                  disabled={submitting || !loggedAtResult.valid}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={colors.textInverse} />
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

      <Modal
        visible={addVisible}
        animationType="slide"
        transparent
        onRequestClose={closeAddModal}
      >
        {/* Bottom-anchored sheet with a text field in it: without this the
            keyboard rises straight over the input and the submit button. */}
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.addModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add your own</Text>
              <TouchableOpacity
                activeOpacity={1}
                onPress={closeAddModal}
                disabled={addSubmitting}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.addModalHint}>
              What would you like to keep an eye on? It will appear alongside the others.
            </Text>

            <TextInput
              style={styles.addInput}
              placeholder="Headaches"
              placeholderTextColor={colors.textMuted}
              value={newSymptomName}
              onChangeText={(text) => {
                setNewSymptomName(text);
                if (addError) setAddError(null);
              }}
              autoFocus
              autoCapitalize="sentences"
              autoCorrect
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (canSubmitNewSymptom) submitNewSymptom();
              }}
              editable={!addSubmitting}
              accessibilityLabel="Symptom name"
            />

            {duplicateName ? (
              <Text style={styles.addInlineHint}>You are already tracking that one.</Text>
            ) : null}
            {addError ? <Text style={styles.addErrorText}>{addError}</Text> : null}

            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.addSubmitButton, !canSubmitNewSymptom && styles.addSubmitButtonDisabled]}
              onPress={submitNewSymptom}
              disabled={!canSubmitNewSymptom}
              accessibilityRole="button"
              accessibilityLabel="Add symptom"
            >
              {addSubmitting ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.addSubmitText}>Add symptom</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  symptomsDisclaimer: {
    ...typography.presets.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
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
  listHeader: {
    marginBottom: spacing.sm,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  gridItem: {
    flex: 1,
  },
  symptomCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    minHeight: minTouchTarget + 80,
    ...shadows.card,
  },
  symptomCardImageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  symptomCardImage: {
    width: '100%',
    height: '100%',
  },
  symptomCardIconFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  symptomCardLabel: {
    ...typography.presets.label,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: minTouchTarget,
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
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptyStateWrap: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  emptyTitle: {
    ...typography.presets.heading3,
    color: colors.text,
    textAlign: 'center',
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    ...shadows.buttonPrimary,
  },
  emptyActionText: {
    ...typography.presets.button,
    color: colors.background,
  },
  addSymptomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  addSymptomButtonText: {
    ...typography.presets.button,
    color: colors.primary,
  },
  addModalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingBottom: spacing['2xl'],
  },
  addModalHint: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  addInput: {
    ...typography.presets.body,
    color: colors.text,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addInlineHint: {
    ...typography.presets.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  addErrorText: {
    ...typography.presets.caption,
    color: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  addSubmitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    minHeight: minTouchTarget,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    ...shadows.buttonPrimary,
  },
  addSubmitButtonDisabled: {
    opacity: 0.6,
    backgroundColor: colors.borderStrong,
  },
  addSubmitText: {
    ...typography.presets.button,
    color: colors.background,
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
    fontFamily: typography.display.semibold,
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
    color: colors.textInverse,
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
    color: colors.textInverse,
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
    color: colors.textInverse,
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
    color: colors.textInverse,
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
  timePickerInputError: {
    borderColor: colors.danger,
  },
  timeErrorText: {
    ...typography.presets.caption,
    color: colors.danger,
    marginLeft: spacing.lg,
    marginBottom: spacing.sm,
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
  },
});
