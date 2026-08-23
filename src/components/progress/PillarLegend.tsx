import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import {
  HISTORY_PILLARS,
  toPercent,
  type HistoryPillar,
  type PillarProgress,
} from '../../lib/planHistoryTypes';
import {
  PILLAR_ICONS,
  PILLAR_LABELS,
  dayPillarSummary,
  spanPillarSummary,
} from '../../lib/planHistoryFormat';
import { PILLAR_TINTS } from './PillarRing';

type PillarLegendProps = {
  movement: PillarProgress | null;
  nutrition: PillarProgress | null;
  relaxation: PillarProgress | null;
  /** `day` says "Rest day" where `span` says "0 of 2 sessions". */
  scope: 'day' | 'span';
};

/**
 * The three arcs, unrolled into bars she can read.
 *
 * The ring answers "how did that go"; this answers "which part". Same colours
 * and same order in both, so the legend is never a separate thing to learn.
 */
export function PillarLegend({ movement, nutrition, relaxation, scope }: PillarLegendProps) {
  const byPillar: Record<HistoryPillar, PillarProgress | null> = {
    movement,
    nutrition,
    relaxation,
  };

  return (
    <View style={styles.list}>
      {HISTORY_PILLARS.map((pillar) => (
        <Row key={pillar} pillar={pillar} progress={byPillar[pillar]} scope={scope} />
      ))}
    </View>
  );
}

function Row({
  pillar,
  progress,
  scope,
}: {
  pillar: HistoryPillar;
  progress: PillarProgress | null;
  scope: 'day' | 'span';
}) {
  const tint = PILLAR_TINTS[pillar];
  const summary =
    scope === 'day' ? dayPillarSummary(pillar, progress) : spanPillarSummary(pillar, progress);

  return (
    <View style={styles.row}>
      <Ionicons name={PILLAR_ICONS[pillar]} size={16} color={progress ? tint : colors.borderStrong} />

      <View style={styles.body}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{PILLAR_LABELS[pillar]}</Text>
          <Text style={styles.summary} numberOfLines={1}>
            {summary}
          </Text>
        </View>

        <View style={styles.track}>
          {progress && progress.ratio > 0 ? (
            <View
              style={[
                styles.fill,
                { width: `${Math.max(toPercent(progress.ratio), 3)}%`, backgroundColor: tint },
              ]}
            />
          ) : null}
        </View>
      </View>

      <Text style={[styles.percent, !progress && styles.percentMuted]}>
        {progress ? `${toPercent(progress.ratio)}%` : '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  label: {
    ...typography.presets.caption,
    fontFamily: typography.family.medium,
    color: colors.text,
  },
  summary: {
    ...typography.presets.caption,
    fontSize: 11,
    color: colors.textMuted,
    flexShrink: 1,
  },
  track: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.plumSoft,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  percent: {
    ...typography.presets.caption,
    fontFamily: typography.family.semibold,
    color: colors.text,
    minWidth: 38,
    textAlign: 'right',
  },
  percentMuted: {
    color: colors.borderStrong,
  },
});
