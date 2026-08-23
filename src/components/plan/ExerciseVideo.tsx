import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import type { PlanExercise } from '../../lib/planTypes';

/**
 * The shape every clip is shot and exported in: **9:16 portrait**.
 *
 * It was 4:5 while the session runner drew the clip inside a bordered box. The
 * runner is now a full-bleed stage — the clip *is* the screen — and a 4:5 source
 * covering a 19.5:9 phone throws away 42% of the frame's width, which on a
 * lateral raise is both arms and on a banded row is the anchor point. 9:16 is
 * the shape of the device, so covering it costs a slice instead of a half.
 *
 * Export it anywhere a clip is boxed rather than staged, so the browse card and
 * the stage never disagree about what a clip looks like.
 */
export const CLIP_ASPECT = 9 / 16;

/**
 * The demonstration surface for one exercise — the only place a clip is shown.
 *
 * ─── Where the clips come from ──────────────────────────────────────────────
 * Nothing about the path lives in this app. `GET /api/plan?media=1` fills
 * `exercise.video`, and the web app builds the URL in `exerciseMedia()`
 * (`../menolisa_web/lib/plan/catalog.ts`). To publish a clip:
 *
 *   1. Upload to the public Supabase bucket `exercise-clips`, named for the
 *      catalog id — `L01.mp4` (6-10s silent loop, H.264, **9:16 1080×1920**,
 *      ≤800KB). The filename IS the mapping.
 *   2. Add that id to `MEDIA_READY` in `lib/plan/catalog.ts`. An id missing from
 *      that set returns no media, so a half-finished shoot never ships a broken
 *      player — it lands on the placeholder below instead.
 *
 * The set holds exactly one id today (`L01`, and that one still cut to the old
 * 4:5 spec), which is why the placeholder is the state that has been designed
 * properly: it has to read as "not filmed yet", never as a
 * failure, and it has to hold the same space the clip will take so the layout
 * does not shift the day the clips land.
 *
 * ─── Frame the movement inside the safe area ────────────────────────────────
 * A phone is not 16:9 any more. `cover` on a 19.5:9 display scales a 1080×1920
 * clip until it fills the height, and about **18% of the width falls off the
 * sides** — call it the outer 100px on each edge. Nothing that matters may live
 * there:
 *
 *   - Keep the body inside the central **76% of width** (≈820 of 1080px) at the
 *     widest point of the movement — arms overhead, legs at full lunge stride.
 *   - Keep 5% clear top and bottom. On a 16:9 device (an SE, most Androids)
 *     there is no side crop at all and the full width shows, so the framing has
 *     to survive both.
 *   - Shoot every clip on the same backdrop at the same distance. The stage
 *     lets the picture run to the screen edge; a backdrop that shifts between
 *     exercises reads as the app glitching between sets.
 *
 * ─── No poster frames ───────────────────────────────────────────────────────
 * There used to be a `.webp` still per clip, held under the video so the first
 * frame was never a grey rectangle. It is gone. Under `contain` the still and
 * the video letterbox to boxes that are almost never pixel-identical, so the
 * part of the still that fell outside the video showed as a second, frozen
 * picture framing the moving one. The clips are small and loop from cache; the
 * ground colour covers the load instead.
 */
export function ExerciseVideo({
  exercise,
  style,
  rounded = true,
  overlay,
  contentFit = 'contain',
  ground = 'light',
}: {
  exercise: PlanExercise;
  style?: StyleProp<ViewStyle>;
  /** Off when the parent already clips the corners. */
  rounded?: boolean;
  /**
   * Drawn on top of the clip, inside its box. The session runner puts the
   * countdown here so the timer costs the layout no height of its own.
   */
  overlay?: React.ReactNode;
  /**
   * `cover` on the session runner's full-bleed stage, where the box is the
   * screen and a letterbox bar would be a black band across her phone.
   * `contain` in a card, where the box is already the clip's own shape and
   * nothing is gained by cropping.
   */
  contentFit?: 'contain' | 'cover';
  /**
   * Which way round the surface is lit. `dark` is the session stage: the
   * placeholder has to read on deep navy, and reading it as an unloaded image
   * is exactly the failure it is there to avoid.
   */
  ground?: 'light' | 'dark';
}) {
  const dark = ground === 'dark';
  const shell = [styles.shell, dark && styles.shellDark, rounded && styles.rounded, style];

  if (exercise.video) {
    return (
      <ExerciseClip uri={exercise.video} style={shell} overlay={overlay} contentFit={contentFit} />
    );
  }

  return (
    <View style={shell} accessibilityRole="image" accessibilityLabel={exercise.name}>
      {/* Type only. This used to lead with a 52pt circled body glyph, which is
          the visual vocabulary of a broken image — a grey shape in a box where a
          picture should be. Two lines of centred text read as "not filmed yet",
          which is the truth, and they sit quietly enough that the surface around
          them still looks finished. */}
      <View style={[styles.placeholder, dark && styles.placeholderDark]}>
        <Text
          style={[styles.placeholderText, dark && styles.placeholderTextDark]}
          numberOfLines={2}
        >
          {exercise.name}
        </Text>
        <Text style={[styles.placeholderHint, dark && styles.placeholderHintDark]}>
          Demo video coming soon
        </Text>
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
  contentFit,
}: {
  uri: string;
  style: StyleProp<ViewStyle>;
  overlay?: React.ReactNode;
  contentFit: 'contain' | 'cover';
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
          contentFit={contentFit}
          nativeControls={false}
          fullscreenOptions={{ enable: false }}
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
  shellDark: {
    backgroundColor: colors.stage,
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
  /**
   * Opaque, not a translucent wash over the stage. Android composites
   * translucent rgba View backgrounds as flat grey often enough that a
   * near-invisible tint is not worth the risk on the one surface that fills
   * the whole screen.
   */
  placeholderDark: {
    backgroundColor: colors.stage,
  },
  placeholderText: {
    ...typography.presets.bodyMedium,
    color: colors.text,
    textAlign: 'center',
  },
  placeholderTextDark: {
    color: colors.onStage,
  },
  placeholderHint: {
    ...typography.presets.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  placeholderHintDark: {
    color: colors.onStageMuted,
  },
});
