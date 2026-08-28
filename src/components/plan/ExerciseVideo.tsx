import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { colors, radii } from '../../theme/tokens';
import { clipSource } from '../../lib/clipCache';
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
 *      player.
 *
 * **`exercise.video` is the only source of a clip URL — never build one from
 * `exercise.id`.** Nothing in this app may know the bucket, the extension or
 * how the filename is spelled. Server-side, `hydrateList()` spreads
 * `exerciseMedia(id)`, which returns `undefined` for a row with no clip, so the
 * key is *missing* rather than `null` or `""`: `Boolean(exercise.video)` is the
 * whole test, and it is the only one.
 *
 * ─── A missing clip is not a gap waiting to be filled ───────────────────────
 * Some exercises will never have one. K01 Zone 2 cardio and K02 Sprint
 * intervals are doses, not movements — there is nothing to demonstrate and no
 * shoot will ever add them, and more rows like them will follow. So the no-clip
 * state must not be dressed as a pending one: no player, no poster, no spinner,
 * and above all no "coming soon" card, which turns a deliberate row into a
 * broken one on the single screen she is reading from the floor. It renders as
 * ground, and the name, props and dose beside it carry the exercise on their
 * own — they were written to.
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
   * Which way round the surface is lit. It picks the ground colour, which is
   * what a clipless exercise shows and what covers a clip while it loads.
   * `dark` is the session stage, whose ground is the deep navy the chrome was
   * drawn against.
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

  // Ground and whatever the caller floats on it, and nothing else. Both callers
  // already say what the exercise is — `ExerciseCard` never mounts this without
  // a clip, and the session runner carries the name and the dose in its own
  // chrome — so any type drawn here would be a second copy of both under a
  // caption apologising for a clip that was never coming.
  return <View style={shell}>{overlay}</View>;
}

/**
 * Split out because `useVideoPlayer` cannot be called conditionally, and the
 * common case today is an exercise with no clip at all.
 *
 * ─── One player, re-pointed ─────────────────────────────────────────────────
 * `useVideoPlayer` tears down the native player and builds a new one every time
 * its source changes, which on the session stage is every exercise: a fresh
 * AVPlayer / ExoPlayer, a fresh surface, and a black frame in between. The
 * source it is given here is deliberately frozen at the first clip, and every
 * clip after that arrives through `replaceAsync` on the player we already have.
 *
 * `replaceAsync`, not `replace` — the synchronous one loads the asset on the
 * main thread, which is a stutter on the one screen she is watching while she
 * moves.
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
  const firstUri = useRef(uri).current;
  const player = useVideoPlayer(clipSource(firstUri), (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });

  const loaded = useRef(firstUri);
  useEffect(() => {
    if (loaded.current === uri) return;
    loaded.current = uri;
    let cancelled = false;
    player
      .replaceAsync(clipSource(uri))
      .then(() => {
        // The swap does not carry playback with it, and `loop` has been seen to
        // survive it — set both rather than rely on either.
        if (cancelled) return;
        player.loop = true;
        player.muted = true;
        player.play();
      })
      // A clip that fails to load leaves the previous one looping rather than
      // blacking out the stage. She loses the demonstration, never the session.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [uri, player]);

  // The surface is unmounted when the screen is not the one on top, so the
  // player is told to stop too. Left alone it goes on decoding a clip nobody can
  // see — on a session she backgrounds mid-set, for as long as she leaves it.
  useEffect(() => {
    if (isFocused) player.play();
    else player.pause();
  }, [isFocused, player]);

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
});
