import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows, spacing, typography } from '../../theme/tokens';
import { toPercent, type DayProgress } from '../../lib/planHistoryTypes';
import { formatLongDate } from '../../lib/planHistoryFormat';
import { PillarRing } from './PillarRing';
import { PillarLegend } from './PillarLegend';

type DayDetailSheetProps = {
  day: DayProgress | null;
  onClose: () => void;
};

/**
 * What one day actually held.
 *
 * Opened from a cell in the grid, because a ring forty pixels wide can show a
 * shape but not a reason. The copy at the bottom is the whole point of letting
 * her open a bad day at all — an empty day here says the day is still hers to
 * fill, or that it has passed and nothing about it is owed.
 */
export function DayDetailSheet({ day, onClose }: DayDetailSheetProps) {
  if (!day) return null;

  const percent = toPercent(day.score);
  const today = day.state === 'today';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        {/* Stops a tap inside the sheet from closing it. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <PillarRing
              movement={day.movement?.ratio ?? null}
              nutrition={day.nutrition?.ratio ?? null}
              relaxation={day.relaxation?.ratio ?? null}
              size={72}
              strokeWidth={6}
              animate
            >
              <Text style={styles.ringPercent} allowFontScaling={false}>
                {percent}%
              </Text>
            </PillarRing>

            <View style={styles.headerText}>
              <Text style={styles.date}>{formatLongDate(day.date)}</Text>
              <Text style={styles.meta}>
                {today ? 'Today' : `Day ${day.dayOfPlan}`} · Week {day.week}
              </Text>
            </View>
          </View>

          <PillarLegend
            movement={day.movement}
            nutrition={day.nutrition}
            relaxation={day.relaxation}
            scope="day"
          />

          <Text style={styles.footer}>{footerCopy(percent, today)}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * Never a reprimand.
 *
 * A woman opens a past day because she wants to know what happened, not to be
 * told she failed it — perimenopause days go wrong for reasons no plan
 * accounts for. Today can still be nudged; yesterday is closed and gets
 * acknowledged instead.
 */
function footerCopy(percent: number, today: boolean): string {
  if (percent >= 100) return 'Every part of the day, closed. That is a full circle.';
  if (today) {
    return percent === 0
      ? 'Nothing yet today — the day is still open.'
      : 'Still open. Anything more you do lands here.';
  }
  return percent === 0
    ? 'A quiet day. It costs you nothing here.'
    : 'This is what that day held.';
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(31, 27, 45, 0.45)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing['2xl'],
    gap: spacing.md,
    ...shadows.card,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  ringPercent: {
    fontFamily: typography.display.bold,
    fontSize: 16,
    color: colors.text,
  },
  date: {
    ...typography.presets.heading3,
    color: colors.text,
  },
  meta: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },
  footer: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
  },
});
