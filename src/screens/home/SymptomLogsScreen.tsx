import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';
import { SymptomLogsSkeleton, ContentTransition } from '../../components/skeleton';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiFetchWithAuth, API_CONFIG } from '../../lib/api';
import { getSymptomIconName } from '../../lib/symptomIconMapping';
import { colors, spacing, radii, typography, minTouchTarget } from '../../theme/tokens';

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

type GroupedLog = { dateKey: string; dateLabel: string; logs: SymptomLog[] };

export function SymptomLogsScreen() {
  const reduceMotion = useReduceMotion();
  const [logs, setLogs] = useState<SymptomLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
              const iconName = getSymptomIconName(symptomName, log.symptoms?.icon);
              return (
                <View key={log.id} style={styles.logRow}>
                  <View style={styles.logIconWrap}>
                    <Ionicons
                      name={iconName as any}
                      size={24}
                      color={colors.primary}
                    />
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
                </View>
              );
            })}
          </View>
        )}
      />
      </StaggeredZoomIn>
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
    fontFamily: typography.family.semibold,
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
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  logIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.primaryLight + '40',
    alignItems: 'center',
    justifyContent: 'center',
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
});
