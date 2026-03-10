import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiFetchWithAuth, API_CONFIG } from '../../lib/api';
import { formatHealthSummaryReport } from '../../lib/formatHealthSummaryReport';
import { colors, spacing, radii, typography, minTouchTarget } from '../../theme/tokens';

const REPORT_ENDPOINT = `${API_CONFIG.endpoints.healthSummary}?days=30`;

function formatDateRangeSubtitle(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function HealthSummaryReportScreen() {
  const [reportText, setReportText] = useState<string | null>(null);
  const [dateRangeSubtitle, setDateRangeSubtitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetchWithAuth(REPORT_ENDPOINT);
      const report = data?.report;
      if (!report) {
        throw new Error('No report data');
      }
      const text = formatHealthSummaryReport(report);
      setReportText(text);
      if (report.dateRange?.start && report.dateRange?.end) {
        setDateRangeSubtitle(formatDateRangeSubtitle(report.dateRange.start, report.dateRange.end));
      } else {
        setDateRangeSubtitle(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
      setReportText(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const onShare = useCallback(() => {
    if (!reportText) return;
    Share.share({
      message: reportText,
      title: 'Menolisa symptom summary',
    }).catch(() => {});
  }, [reportText]);

  const onCopy = useCallback(() => {
    if (!reportText) return;
    Clipboard.setStringAsync(reportText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [reportText]);

  if (loading && !reportText) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Generating report…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !reportText) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={fetchReport}
            style={styles.retryButton}
            accessibilityLabel="Try again"
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {(dateRangeSubtitle != null) ? (
        <View style={styles.header}>
          <Text style={styles.subtitle}>{dateRangeSubtitle}</Text>
        </View>
      ) : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.reportBody} selectable>
          {reportText}
        </Text>
      </ScrollView>
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={onShare}
          style={styles.primaryButton}
          accessibilityLabel="Share report"
        >
          <Ionicons name="share-outline" size={22} color="#fff" />
          <Text style={styles.primaryButtonText}>Share report</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onCopy}
          style={styles.secondaryButton}
          accessibilityLabel="Copy report"
        >
          <Ionicons
            name="copy-outline"
            size={20}
            color={copied ? colors.success : colors.primary}
          />
          <Text
            style={[
              styles.secondaryButtonText,
              copied && styles.secondaryButtonTextCopied,
            ]}
          >
            {copied ? 'Copied' : 'Copy report'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontFamily: typography.family.regular,
    fontSize: 16,
    color: colors.textMuted,
  },
  errorText: {
    fontFamily: typography.family.regular,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
  },
  retryButtonText: {
    fontFamily: typography.display.semibold,
    fontSize: 16,
    color: '#fff',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subtitle: {
    fontFamily: typography.family.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  reportBody: {
    fontFamily: typography.family.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
  },
  primaryButtonText: {
    fontFamily: typography.display.semibold,
    fontSize: 16,
    color: '#fff',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    fontFamily: typography.display.semibold,
    fontSize: 14,
    color: colors.primary,
  },
  secondaryButtonTextCopied: {
    color: colors.success,
  },
});
