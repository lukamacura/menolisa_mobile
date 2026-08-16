import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import type { PlanExercise } from '../../lib/planTypes';

/**
 * The demonstration surface for one exercise — the only place a clip is shown.
 *
 * ─── Where the clips come from ──────────────────────────────────────────────
 * Nothing about the path lives in this app. `GET /api/plan?media=1` fills
 * `exercise.video` / `exercise.poster`, and the web app builds both URLs in
 * `exerciseMedia()` (`../menolisa_web/lib/plan/catalog.ts`). To publish a clip:
 *
 *   1. Upload to the public Supabase bucket `exercise-clips`, named for the
 *      catalog id — `L01.mp4` (6-10s silent loop, H.264, ≤720p, ≤400KB) and
 *      `L01.webp` (poster frame, ≤40KB). The filename IS the mapping.
 *   2. Add that id to `MEDIA_READY` in `lib/plan/catalog.ts`. An id missing from
 *      that set returns no media, so a half-finished shoot never ships a broken
 *      player — it lands on the placeholder below instead.
 *
 * The set is empty today, which is why the placeholder is the state that has
 * been designed properly: it has to read as "not filmed yet", never as a
 * failure, and it has to hold the same space the clip will take so the layout
 * does not shift the day the clips land.
 */
export function ExerciseVideo({
  exercise,
  style,
  rounded = true,
}: {
  exercise: PlanExercise;
  style?: StyleProp<ViewStyle>;
  /** Off when the parent already clips the corners. */
  rounded?: boolean;
}) {
  const shell = [styles.shell, rounded && styles.rounded, style];

  if (exercise.video) {
    return <ExerciseClip uri={exercise.video} poster={exercise.poster} style={shell} />;
  }

  return (
    <View style={shell} accessibilityRole="image" accessibilityLabel={exercise.name}>
      {exercise.poster ? (
        <Image source={{ uri: exercise.poster }} style={styles.fill} contentFit="cover" />
      ) : (
        <View style={styles.placeholder}>
          <View style={styles.placeholderIcon}>
            <Ionicons name="body-outline" size={26} color={colors.primaryDark} />
          </View>
          <Text style={styles.placeholderText} numberOfLines={2}>
            {exercise.name}
          </Text>
          <Text style={styles.placeholderHint}>Demo video coming soon</Text>
        </View>
      )}
    </View>
  );
}

/**
 * Split out because `useVideoPlayer` cannot be called conditionally, and the
 * common case today is an exercise with no clip at all.
 */
function ExerciseClip({
  uri,
  poster,
  style,
}: {
  uri: string;
  poster?: string;
  style: StyleProp<ViewStyle>;
}) {
  const isFocused = useIsFocused();
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });

  return (
    <View style={style}>
      {/* The poster stays mounted underneath: it is already cached from the
          exercise list, so the first frame is never a grey rectangle. */}
      {poster && <Image source={{ uri: poster }} style={styles.fill} contentFit="cover" />}
      {isFocused && (
        <VideoView
          player={player}
          style={styles.fill}
          contentFit="cover"
          nativeControls={false}
          allowsFullscreen={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  rounded: {
    borderRadius: radii.lg,
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    backgroundColor: 'rgba(244, 124, 151, 0.06)',
  },
  placeholderIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(244, 124, 151, 0.12)',
  },
  placeholderText: {
    ...typography.presets.bodyMedium,
    color: colors.text,
    textAlign: 'center',
  },
  placeholderHint: {
    ...typography.presets.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
