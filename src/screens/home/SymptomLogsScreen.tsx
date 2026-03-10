import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  ScrollView,
  RefreshControl,
  Modal,
  TouchableOpacity,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';
import { SymptomLogsSkeleton, ContentTransition } from '../../components/skeleton';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiFetchWithAuth, API_CONFIG, deleteSymptomLog } from '../../lib/api';
import { useTrialStatus } from '../../hooks/useTrialStatus';
import { AccessEndedView } from '../../components/AccessEndedView';
import { getSymptomIllustration } from '../../lib/symptomIllustration';
import { TRIGGER_OPTIONS, type TimeSelection } from '../../lib/symptomTrackerConstants';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../../theme/tokens';

const SEVERITY_OPTIONS = [
  { value: 1, label: 'Mild', emoji: '😊', description: 'Noticeable but manageable' },
  { value: 2, label: 'Moderate', emoji: '😐', description: 'Affecting my day' },
  { value: 3, label: 'Severe', emoji: '😣', description: 'Hard to function' },
];

type SymptomLog = {
  id: string;
  symptom_id: string;
  severity: number;
  logged_at: string;
  notes?: string | null;
  triggers?: string[] | null;
  symptoms?: { name: string; icon?: string } | null;
};

const SEVERITY_LABELS: Record<number, string> = {
  1: 'Mild',
  2: 'Moderate',
  3: 'Severe',
};

const SEVERITY_EMOJI: Record<number, string> = {
  1: '😊',
  2: '😐',
  3: '😣',
};

function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatSectionTitle(dateKey: string): string {
  const today = getDateKey(new Date());
  const yesterday = getDateKey(new Date(Date.now() - 86400000));
  if (dateKey === today) return 'Today';
  if (dateKey === yesterday) return 'Yesterday';
  const [y, m, d] = dateKey.split('-');
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function getTimeSelectionFromLoggedAt(loggedAt: string): { timeSelection: TimeSelection; customTime: string } {
  const d = new Date(loggedAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const logDay = new Date(d);
  logDay.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const h = d.getHours();
  const m = d.getMinutes();
  const customTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  if (logDay.getTime() === yesterday.getTime()) return { timeSelection: 'yesterday', customTime };
  if (logDay.getTime() === today.getTime()) {
    const now = new Date();
    const diffMins = Math.abs(now.getTime() - d.getTime()) / 60000;
    return diffMins <= 5 ? { timeSelection: 'now', customTime: '' } : { timeSelection: 'earlier-today', customTime };
  }
  return { timeSelection: 'earlier-today', customTime };
}

type GroupedLog = { dateKey: string; dateLabel: string; logs: SymptomLog[] };

export function SymptomLogsScreen() {
  const reduceMotion = useReduceMotion();
  const trialStatus = useTrialStatus();
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<SymptomLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [logToEdit, setLogToEdit] = useState<SymptomLog | null>(null);
  const [editStep, setEditStep] = useState<1 | 2 | 3 | 4>(1);
  const [editSeverity, setEditSeverity] = useState(1);
  const [editTriggers, setEditTriggers] = useState<string[]>([]);
  const [editTimeSelection, setEditTimeSelection] = useState<TimeSelection>('now');
  const [editCustomTime, setEditCustomTime] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCustomTrigger, setEditCustomTrigger] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const loadLogs = useCallback(async () => {
    try {
      setError(null);
      const res = await apiFetchWithAuth(`${API_CONFIG.endpoints.symptomLogs}?days=30`);
      setLogs(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load logs');
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadLogs();
  }, [loadLogs]);

  const openEditModal = useCallback((log: SymptomLog) => {
    const { timeSelection, customTime } = getTimeSelectionFromLoggedAt(log.logged_at);
    setLogToEdit(log);
    setEditSeverity(log.severity);
    setEditTriggers(log.triggers ?? []);
    setEditTimeSelection(timeSelection);
    setEditCustomTime(customTime);
    setEditNotes(log.notes?.trim() ?? '');
    setEditCustomTrigger('');
    setEditStep(1);
    setEditModalVisible(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditModalVisible(false);
    setLogToEdit(null);
  }, []);

  const getEditLoggedAtTimestamp = useCallback((): string => {
    const now = new Date();
    if (editTimeSelection === 'now') return now.toISOString();
    if (editTimeSelection === 'earlier-today') {
      if (editCustomTime) {
        const [hours, minutes] = editCustomTime.split(':').map(Number);
        const logTime = new Date(now);
        logTime.setHours(hours, minutes, 0, 0);
        return logTime.toISOString();
      }
      const logTime = new Date(now);
      logTime.setHours(logTime.getHours() - 2);
      return logTime.toISOString();
    }
    const logTime = new Date(now);
    logTime.setDate(logTime.getDate() - 1);
    if (editCustomTime) {
      const [hours, minutes] = editCustomTime.split(':').map(Number);
      logTime.setHours(hours, minutes, 0, 0);
    } else {
      logTime.setHours(now.getHours(), now.getMinutes(), 0, 0);
    }
    return logTime.toISOString();
  }, [editTimeSelection, editCustomTime]);

  const submitEdit = useCallback(async () => {
    if (!logToEdit) return;
    setEditSubmitting(true);
    try {
      await apiFetchWithAuth(API_CONFIG.endpoints.symptomLogs, {
        method: 'PUT',
        body: JSON.stringify({
          id: logToEdit.id,
          severity: editSeverity,
          triggers: editTriggers,
          notes: editNotes.trim() || undefined,
          loggedAt: getEditLoggedAtTimestamp(),
        }),
      });
      closeEditModal();
      loadLogs();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update log');
    } finally {
      setEditSubmitting(false);
    }
  }, [logToEdit, editSeverity, editTriggers, editNotes, getEditLoggedAtTimestamp, closeEditModal, loadLogs]);

  const [deleteConfirmLog, setDeleteConfirmLog] = useState<SymptomLog | null>(null);

  const handleDeleteLog = useCallback((log: SymptomLog) => {
    const symptomName = log.symptoms?.name ?? 'this log';
    const logId = log.id;

    if (Platform.OS === 'web') {
      setDeleteConfirmLog(log);
      return;
    }
    Alert.alert(
      'Delete log?',
      `Remove "${symptomName}" from your history? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const runDelete = async () => {
              setLogs((prev) => prev.filter((l) => l.id !== logId));
              try {
                await deleteSymptomLog(logId);
              } catch (e) {
                loadLogs();
                const message = e instanceof Error ? e.message : 'Failed to delete log';
                Alert.alert('Error', message);
              }
            };
            runDelete();
          },
        },
      ]
    );
  }, [loadLogs]);

  const runDeleteAfterConfirm = useCallback(async () => {
    const log = deleteConfirmLog;
    setDeleteConfirmLog(null);
    if (!log) return;
    const logId = log.id;
    setLogs((prev) => prev.filter((l) => l.id !== logId));
    try {
      await deleteSymptomLog(logId);
    } catch (e) {
      loadLogs();
      const message = e instanceof Error ? e.message : 'Failed to delete log';
      if (Platform.OS === 'web') {
        setDeleteConfirmLog(null);
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    }
  }, [deleteConfirmLog, loadLogs]);

  const toggleEditTrigger = useCallback((trigger: string) => {
    setEditTriggers((prev) =>
      prev.includes(trigger) ? prev.filter((t) => t !== trigger) : [...prev, trigger]
    );
  }, []);

  const addEditCustomTrigger = useCallback(() => {
    const t = editCustomTrigger.trim();
    if (t && !editTriggers.includes(t)) {
      setEditTriggers((prev) => [...prev, t]);
      setEditCustomTrigger('');
    }
  }, [editCustomTrigger, editTriggers]);

  const grouped = useMemo((): GroupedLog[] => {
    const byDate: Record<string, SymptomLog[]> = {};
    logs.forEach((log) => {
      const key = getDateKey(new Date(log.logged_at));
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(log);
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, dayLogs]) => ({
        dateKey,
        dateLabel: formatSectionTitle(dateKey),
        logs: dayLogs.sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()),
      }));
  }, [logs]);

  if (trialStatus.expired) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <AccessEndedView variant="fullScreen" reduceMotion={reduceMotion} />
      </SafeAreaView>
    );
  }

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.listContent}>
          <SymptomLogsSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Modal
        visible={deleteConfirmLog != null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmLog(null)}
      >
        <Pressable style={styles.deleteModalOverlay} onPress={() => setDeleteConfirmLog(null)}>
          <Pressable style={styles.deleteModalBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.deleteModalTitle}>Delete log?</Text>
            <Text style={styles.deleteModalMessage}>
              Remove "{deleteConfirmLog?.symptoms?.name ?? 'this log'}" from your history? This cannot be undone.
            </Text>
            <View style={styles.deleteModalActions}>
              <Pressable style={styles.deleteModalCancelBtn} onPress={() => setDeleteConfirmLog(null)}>
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.deleteModalConfirmBtn} onPress={runDeleteAfterConfirm}>
                <Text style={styles.deleteModalConfirmText}>Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <ContentTransition>
      {error && (
        <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </StaggeredZoomIn>
      )}
      <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion} style={styles.listWrap}>
      <FlatList
        data={grouped}
        keyExtractor={(item) => item.dateKey}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No symptom logs yet</Text>
            <Text style={styles.emptySubtitle}>
              Log from the Track symptoms screen to see your history here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{item.dateLabel}</Text>
            {item.logs.map((log) => {
              const symptomName = log.symptoms?.name ?? 'Symptom';
              const illustration = getSymptomIllustration(symptomName, log.symptoms?.icon);
              return (
                <View key={log.id} style={styles.logRow}>
                  <TouchableOpacity
                    style={styles.logRowTouchable}
                    onPress={() => openEditModal(log)}
                    activeOpacity={0.7}
                    accessibilityLabel={`Edit ${symptomName} log`}
                    accessibilityHint="Double tap to edit"
                  >
                    <View style={styles.logIconWrap} accessibilityLabel={symptomName}>
                      {illustration.type === 'image' ? (
                        <Image
                          source={illustration.source}
                          resizeMode="cover"
                          style={styles.logIconImage}
                          accessibilityLabel={symptomName}
                        />
                      ) : (
                        <Ionicons
                          name={illustration.iconName as any}
                          size={24}
                          color={colors.primary}
                        />
                      )}
                    </View>
                    <View style={styles.logMain}>
                      <Text style={styles.logName}>{symptomName}</Text>
                      <View style={styles.logMetaRow}>
                        <Text style={styles.logSeverity}>
                          {SEVERITY_EMOJI[log.severity] ?? ''} {SEVERITY_LABELS[log.severity] ?? '—'}
                        </Text>
                        <Text style={styles.logTime}>{formatTime(log.logged_at)}</Text>
                      </View>
                      {log.triggers && log.triggers.length > 0 ? (
                        <View style={styles.logTriggersWrap}>
                          <Text style={styles.logTriggersLabel}>Triggers: </Text>
                          <Text style={styles.logTriggers} numberOfLines={1}>
                            {log.triggers.join(', ')}
                          </Text>
                        </View>
                      ) : null}
                      {log.notes && log.notes.trim() ? (
                        <Text style={styles.logNotes} numberOfLines={2}>{log.notes.trim()}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                  <Pressable
                    style={({ pressed }) => [styles.deleteLogBtnWrap, pressed && styles.deleteLogBtnPressed]}
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      handleDeleteLog(log);
                    }}
                    hitSlop={16}
                    accessibilityLabel="Delete log"
                    accessibilityRole="button"
                  >
                    <View style={styles.deleteLogBtn} pointerEvents="none">
                      <Ionicons name="trash-outline" size={24} color={colors.textMuted} />
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      />
      </StaggeredZoomIn>
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Edit {logToEdit?.symptoms?.name ?? 'symptom'} log
              </Text>
              <TouchableOpacity onPress={closeEditModal} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.stepIndicator}>
              {([1, 2, 3, 4] as const).map((step) => (
                <View key={step} style={styles.stepDotWrap}>
                  <View
                    style={[
                      styles.stepDot,
                      editStep === step && styles.stepDotActive,
                      editStep > step && styles.stepDotDone,
                    ]}
                  >
                    <Text style={[styles.stepDotText, (editStep === step || editStep > step) && styles.stepDotTextActive]}>
                      {editStep > step ? '✓' : step}
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
              {editStep === 1 && (
                <>
                  <Text style={styles.label}>How bad is it?</Text>
                  <View style={styles.severityRow}>
                    {SEVERITY_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        activeOpacity={1}
                        style={[styles.severityBtn, editSeverity === opt.value && styles.severityBtnActive]}
                        onPress={() => setEditSeverity(opt.value)}
                      >
                        <Text style={styles.severityEmoji}>{opt.emoji}</Text>
                        <Text style={[styles.severityLabel, editSeverity === opt.value && styles.severityLabelActive]}>{opt.label}</Text>
                        <Text style={[styles.severityDescription, editSeverity === opt.value && styles.severityDescriptionActive]} numberOfLines={2}>{opt.description}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              {editStep === 2 && (
                <>
                  <Text style={styles.label}>Any idea what triggered it? (optional)</Text>
                  <View style={styles.triggerChips}>
                    {TRIGGER_OPTIONS.map((trigger) => (
                      <TouchableOpacity
                        key={trigger}
                        activeOpacity={1}
                        style={[styles.triggerChip, editTriggers.includes(trigger) && styles.triggerChipActive]}
                        onPress={() => toggleEditTrigger(trigger)}
                      >
                        <Text style={[styles.triggerChipText, editTriggers.includes(trigger) && styles.triggerChipTextActive]}>
                          {trigger}{editTriggers.includes(trigger) ? ' ✓' : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.customTriggerRow}>
                    <TextInput
                      style={styles.customTriggerInput}
                      value={editCustomTrigger}
                      onChangeText={setEditCustomTrigger}
                      placeholder="Custom trigger"
                      placeholderTextColor={colors.textMuted}
                      onSubmitEditing={addEditCustomTrigger}
                    />
                    <TouchableOpacity activeOpacity={1} style={styles.addTriggerBtn} onPress={addEditCustomTrigger}>
                      <Text style={styles.addTriggerBtnText}>+ Add</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              {editStep === 3 && (
                <>
                  <Text style={styles.label}>When did this happen?</Text>
                  <TouchableOpacity
                    activeOpacity={1}
                    style={[styles.timingOption, editTimeSelection === 'now' && styles.timingOptionActive]}
                    onPress={() => { setEditTimeSelection('now'); setEditCustomTime(''); }}
                  >
                    <Text style={[styles.timingOptionText, editTimeSelection === 'now' && styles.timingOptionTextActive]}>Just now{editTimeSelection === 'now' ? ' ✓' : ''}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={1}
                    style={[styles.timingOption, editTimeSelection === 'earlier-today' && styles.timingOptionActive]}
                    onPress={() => setEditTimeSelection('earlier-today')}
                  >
                    <Text style={[styles.timingOptionText, editTimeSelection === 'earlier-today' && styles.timingOptionTextActive]}>Earlier today{editTimeSelection === 'earlier-today' ? ' ✓' : ''}</Text>
                  </TouchableOpacity>
                  {editTimeSelection === 'earlier-today' && (
                    <TextInput style={styles.timePickerInput} value={editCustomTime} onChangeText={setEditCustomTime} placeholder="HH:MM" placeholderTextColor={colors.textMuted} />
                  )}
                  <TouchableOpacity
                    activeOpacity={1}
                    style={[styles.timingOption, editTimeSelection === 'yesterday' && styles.timingOptionActive]}
                    onPress={() => setEditTimeSelection('yesterday')}
                  >
                    <Text style={[styles.timingOptionText, editTimeSelection === 'yesterday' && styles.timingOptionTextActive]}>Yesterday{editTimeSelection === 'yesterday' ? ' ✓' : ''}</Text>
                  </TouchableOpacity>
                  {editTimeSelection === 'yesterday' && (
                    <TextInput style={styles.timePickerInput} value={editCustomTime} onChangeText={setEditCustomTime} placeholder="HH:MM" placeholderTextColor={colors.textMuted} />
                  )}
                </>
              )}
              {editStep === 4 && (
                <>
                  <Text style={styles.label}>Quick note (optional)</Text>
                  <TextInput
                    style={styles.notesInput}
                    value={editNotes}
                    onChangeText={setEditNotes}
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
                onPress={() => (editStep === 1 ? closeEditModal() : setEditStep((s) => (s - 1) as 1 | 2 | 3 | 4))}
              >
                <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
                <Text style={styles.footerBtnSecondaryText}>{editStep === 1 ? 'Cancel' : 'Back'}</Text>
              </TouchableOpacity>
              {editStep < 4 ? (
                <TouchableOpacity activeOpacity={1} style={styles.footerBtnPrimary} onPress={() => setEditStep((s) => (s + 1) as 1 | 2 | 3 | 4)}>
                  <Text style={styles.footerBtnPrimaryText}>Next</Text>
                  <Ionicons name="chevron-forward" size={20} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  activeOpacity={1}
                  style={[styles.submitBtn, styles.submitBtnFlex, editSubmitting && styles.submitBtnDisabled]}
                  onPress={submitEdit}
                  disabled={editSubmitting}
                >
                  {editSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>Update</Text>}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
      </ContentTransition>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  listWrap: { flex: 1 },
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
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: typography.display.semibold,
    color: colors.text,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: typography.family.semibold,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  logRowTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minHeight: minTouchTarget,
  },
  deleteLogBtnWrap: {
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
  },
  deleteLogBtnPressed: {
    opacity: 0.6,
  },
  deleteLogBtn: {
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  deleteModalBox: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 340,
  },
  deleteModalTitle: {
    fontFamily: typography.display.semibold,
    fontSize: 18,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  deleteModalMessage: {
    fontFamily: typography.family.regular,
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'flex-end',
  },
  deleteModalCancelBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    minHeight: minTouchTarget,
    justifyContent: 'center',
  },
  deleteModalCancelText: {
    fontFamily: typography.family.semibold,
    fontSize: 16,
    color: colors.textMuted,
  },
  deleteModalConfirmBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    minHeight: minTouchTarget,
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
  deleteModalConfirmText: {
    fontFamily: typography.family.semibold,
    fontSize: 16,
    color: colors.background,
  },
  logIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.primaryLight + '40',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logIconImage: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
  },
  logMain: {
    flex: 1,
    minWidth: 0,
  },
  logName: {
    fontSize: 16,
    fontFamily: typography.family.semibold,
    color: colors.text,
  },
  logMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 2,
  },
  logSeverity: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.textMuted,
  },
  logTime: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
  },
  logTriggersWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  logTriggersLabel: {
    fontSize: 12,
    fontFamily: typography.family.semibold,
    color: colors.textMuted,
  },
  logTriggers: {
    flex: 1,
    fontSize: 12,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
  },
  logNotes: {
    fontSize: 13,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontStyle: 'italic',
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
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepDotWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
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
  stepDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepDotDone: { backgroundColor: colors.success, borderColor: colors.success },
  stepDotText: { fontSize: 12, fontFamily: typography.family.semibold, color: colors.textMuted },
  stepDotTextActive: { color: '#fff' },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: 4 },
  modalBody: { flex: 1, padding: spacing.lg },
  modalBodyContent: { paddingBottom: spacing['2xl'], flexGrow: 1 },
  label: { fontSize: 14, fontFamily: typography.family.semibold, color: colors.text, marginBottom: spacing.sm },
  severityRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
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
  severityBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  severityEmoji: { fontSize: 24, marginBottom: 2 },
  severityLabel: { fontSize: 12, fontFamily: typography.family.semibold, color: colors.text },
  severityLabelActive: { color: '#fff' },
  severityDescription: { fontSize: 9, fontFamily: typography.family.regular, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  severityDescriptionActive: { color: 'rgba(255,255,255,0.9)' },
  triggerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  triggerChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  triggerChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  triggerChipText: { fontSize: 14, fontFamily: typography.family.medium, color: colors.text },
  triggerChipTextActive: { color: '#fff' },
  customTriggerRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
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
  addTriggerBtn: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radii.md, backgroundColor: colors.primary },
  addTriggerBtnText: { fontSize: 14, fontFamily: typography.family.semibold, color: colors.background },
  timingOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  timingOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  timingOptionText: { fontSize: 16, fontFamily: typography.family.medium, color: colors.text },
  timingOptionTextActive: { color: '#fff' },
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
  footerBtnSecondaryText: { fontSize: 15, fontFamily: typography.family.medium, color: colors.textMuted },
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
  footerBtnPrimaryText: { fontSize: 16, fontFamily: typography.family.semibold, color: colors.background },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    alignItems: 'center',
    minHeight: minTouchTarget,
    justifyContent: 'center',
    ...shadows.buttonPrimary,
  },
  submitBtnFlex: { flex: 1 },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { fontSize: 17, fontFamily: typography.family.semibold, color: colors.background, letterSpacing: 0.5 },
});
