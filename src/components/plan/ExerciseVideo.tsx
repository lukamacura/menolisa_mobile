import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import type { PlanExercise } from '../../lib/planTypes';

/**
 * The demonstration surface for one exercise — the only place a clip is shown.
 *
 * ─── Where the clips come from ──────────────────────────────────────────────
 * Nothing about the path lives in this app. `GET /api/plan?media=1` fills
 * `exercise.video`, and the web app builds the URL in `exerciseMedia()`
 * (`../menolisa_web/lib/plan/catalog.ts`). To publish a clip:
 *
 *   1. Upload to the public Supabase bucket `exercise-clips`, named for the
 *      catalog id — `L01.mp4` (6-10s silent loop, H.264, **4:5 1080×1350**,
 *      ≤800KB). The filename IS the mapping.
 *   2. Add that id to `MEDIA_READY` in `lib/plan/catalog.ts`. An id missing from
 *      that set returns no media, so a half-finished shoot never ships a broken
 *      player — it lands on the placeholder below instead.
 *
 * The set is empty today, which is why the placeholder is the state that has
 * been designed properly: it has to read as "not filmed yet", never as a
 * failure, and it has to hold the same space the clip will take so the layout
 * does not shift the day the clips land.
 *
 * ─── No poster frames ───────────────────────────────────────────────────────
 * There used to be a `.webp` still per clip, held under the video so the first
 * frame was never a grey rectangle. It is gone. Under `contain` the still and
 * the video letterbox to boxes that are almost never pixel-identical, so the
 * part of the still that fell outside the video showed as a second, frozen
 * picture framing the moving one. The clips are small and loop from cache; the
 * shell colour covers the load instead.
 *
 * ─── Why `contain` and not `cover` ──────────────────────────────────────────
 * The box this renders into is not 4:5 on every phone — the session runner
 * hands it whatever height is left, so it ranges from about 1.24 (small phone)
 * to exactly 0.80 (large). `cover` would fill that by cropping the overflow,
 * and on a portrait clip the overflow is the head and the feet — the two things
 * a squat is judged on. `contain` letterboxes against `shell` instead, so the
 * whole movement is always visible. Shoot every clip on the same backdrop and
 * the bars stop reading as bars.
 */
export function ExerciseVideo({
  exercise,
  style,
  rounded = true,
  overlay,
}: {
  exercise: PlanExercise;
  style?: StyleProp<ViewStyle>;
  /** Off when the parent already clips the corners. */
  rounded?: boolean;
  /**
   * Drawn on top of the clip, inside its rounded box. The session runner puts
   * the countdown here so the timer costs the layout no height of its own.
   */
  overlay?: React.ReactNode;
}) {
  const shell = [styles.shell, rounded && styles.rounded, style];

  if (exercise.video) {
    return <ExerciseClip uri={exercise.video} style={shell} overlay={overlay} />;
  }

  return (
    <View style={shell} accessibilityRole="image" accessibilityLabel={exercise.name}>
      {/* Type only. This used to lead with a 52pt circled body glyph, which is
          the visual vocabulary of a broken image — a grey shape in a box where a
          picture should be. Two lines of centred text read as "not filmed yet",
          which is the truth, and they sit quietly enough that the card around
          them still looks finished. */}
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText} numberOfLines={2}>
          {exercise.name}
        </Text>
        <Text style={styles.placeholderHint}>Demo video coming soon</Text>
      </View>
      {overlay}
    </View>
  );
}

/**
 * Split out because `useVideoPlayer` cannot be called conditionally, and the
 * common case today is an exercise with no clip at all.
 */
function ExerciseClip({
  uri,
  style,
  overlay,
}: {
  uri: string;
  style: StyleProp<ViewStyle>;
  overlay?: React.ReactNode;
}) {
  const isFocused = useIsFocused();
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });

  return (
    <View style={style}>
      {isFocused && (
        <VideoView
          player={player}
          style={styles.fill}
          contentFit="contain"
          nativeControls={false}
          allowsFullscreen={false}
        />
      )}
      {overlay}
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
