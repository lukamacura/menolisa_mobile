import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { DAILY_MOOD_EMOJI, DAILY_MOOD_LABEL } from '../lib/dailyMoodShared';
import { colors, spacing, radii, typography } from '../theme/tokens';

const DAYS = 7;

type MoodValue = 1 | 2 | 3 | 4;

type DaySlot = { date: string; mood: MoodValue | null; label: string };

function buildDateSlots(): Omit<DaySlot, 'mood'>[] {
  const out: Omit<DaySlot, 'mood'>[] = [];
  const end = new Date();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString(undefined, { weekday: 'narrow' });
    out.push({ date, label });
  }
  return out;
}

export function DailyMoodHistoryCard() {
  const { user } = useAuth();
  const [slots, setSlots] = useState<DaySlot[]>(() =>
    buildDateSlots().map((s) => ({ ...s, mood: null }))
  );
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setSlots(buildDateSlots().map((s) => ({ ...s, mood: null })));
      setLoading(false);
      return;
    }

    setLoading(true);
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (DAYS - 1));
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    try {
      const { data } = await supabase
        .from('daily_mood')
        .select('date,mood')
        .eq('user_id', user.id)
        .gte('date', startStr)
        .lte('date', endStr)
        .order('date', { ascending: true });

      const byDate = new Map<string, MoodValue>(
        (data ?? []).map((row: { date: string; mood: number }) => [
          row.date,
          row.mood as MoodValue,
        ])
      );

      setSlots(
        buildDateSlots().map((s) => ({
          ...s,
          mood: byDate.get(s.date) ?? null,
        }))
      );
    } catch {
      setSlots(buildDateSlots().map((s) => ({ ...s, mood: null })));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const hasAny = slots.some((s) => s.mood != null);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Mood · last 7 days</Text>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <>
          <View style={styles.row}>
            {slots.map((s) => (
              <View
                key={s.date}
                style={styles.cell}
                accessibilityLabel={
                  s.mood
                    ? `${s.label}, ${DAILY_MOOD_LABEL[s.mood]}`
                    : `${s.label}, no mood logged`
                }
              >
                <Text style={styles.emoji}>{s.mood ? DAILY_MOOD_EMOJI[s.mood] : '·'}</Text>
                <Text style={styles.dayLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
          {!hasAny ? (
            <Text style={styles.hint}>Daily check-ins will show up here.</Text>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card + 'E6',
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...typography.presets.heading3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  loadingRow: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    width: '100%',
  },
  cell: {
    alignItems: 'center',
    flex: 1,
  },
  emoji: {
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 2,
    color: colors.textMuted,
  },
  dayLabel: {
    ...typography.presets.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  hint: {
    ...typography.presets.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
