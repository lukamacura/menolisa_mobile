import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import { exerciseDose, resolveDose } from '../../lib/planFormat';
import type { PlanExercise } from '../../lib/planTypes';
import { ExerciseVideo } from './ExerciseVideo';

type ExerciseCardProps = {
  exercise: PlanExercise;
};

/**
 * One exercise: what it is, what it needs, and how much of it.
 *
 * The clip is progressive enhancement. The server's ready-set is empty today, so
 * `video`/`poster` are absent for every exercise — the card has to read as
 * finished on name, props and dose alone, and it does.
 */
export function ExerciseCard({ exercise }: ExerciseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const dose = exerciseDose(exercise);
  const rest = resolveDose(exercise)?.restSeconds ?? 0;
  const hasClip = Boolean(exercise.video);

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.row}
        onPress={hasClip ? () => setExpanded((open) => !open) : undefined}
        disabled={!hasClip}
        accessibilityRole={hasClip ? 'button' : undefined}
        accessibilityLabel={
          hasClip ? `${exercise.name}, ${expanded ? 'hide' : 'show'} demonstration` : undefined
        }
      >
        {exercise.poster ? (
          <Image source={{ uri: exercise.poster }} style={styles.poster} contentFit="cover" />
        ) : (
          <View style={styles.posterFallback}>
            <Ionicons name="fitness" size={18} color={colors.primary} />
          </View>
        )}

        <View style={styles.text}>
          <Text style={styles.name} numberOfLines={2}>
            {exercise.name}
          </Text>
          {/* Rest rides on the props line rather than taking a column of its
              own — the dose chip already competes with the name for width, and
              a third element wraps the row on a small phone. It is worth showing
              at all because cutting rest short is the most common way strength
              work quietly stops working. */}
          <Text style={styles.props} numberOfLines={1}>
            {rest > 0 ? `${exercise.props} · ${rest} sec rest` : exercise.props}
          </Text>
        </View>

        {dose && (
          <View style={styles.doseChip}>
            <Text style={styles.doseText}>{dose}</Text>
          </View>
        )}

        {hasClip && (
          <Ionicons
            name={expanded ? 'chevron-up' : 'play-circle'}
            size={20}
            color={colors.textMuted}
          />
        )}
      </Pressable>

      {/* Mounted only while its card is open — a session of six exercises would
          otherwise hold six video surfaces at once. */}
      {hasClip && expanded && (
        <View style={styles.clipWrap}>
          <ExerciseVideo exercise={exercise} style={styles.clip} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  poster: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
  },
  posterFallback: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 124, 151, 0.12)',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...typography.presets.bodyMedium,
    color: colors.text,
  },
  props: {
    ...typography.presets.caption,
    color: colors.textMuted,
  },
  doseChip: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  doseText: {
    ...typography.presets.caption,
    fontFamily: typography.family.semibold,
    color: colors.text,
  },
  clipWrap: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  clip: {
    width: '100%',
    height: 180,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
  },
});
