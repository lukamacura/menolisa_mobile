import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { colors, spacing, radii, typography, minTouchTarget, shadows } from '../../theme/tokens';
import { AnimatedPressable } from '../AnimatedPressable';
import { useReduceMotion } from '../StaggeredZoomIn';
import { formatDuration } from '../../lib/planFormat';
import { setAudioProfile } from '../../lib/audioMode';
import { cachedMeditationUri, ensureMeditationFile } from '../../lib/meditationAudio';
import { logger } from '../../lib/logger';
import type { PlanMeditation } from '../../lib/planTypes';
import { PRACTICE_CLOCK_SIZE, PRACTICE_RING_SIZE } from './practiceStage';
import { PracticeHalo } from './PracticeHalo';
import { ProgressRing } from './ProgressRing';

/**
 * Within this many seconds of the end, treat the track as finished.
 *
 * A player parked at its very end plays nothing at all when told to play again,
 * so "Start again" has to rewind first — and `currentTime` lands a fraction
 * short of `duration` often enough that an exact comparison would miss.
 */
const END_EPSILON = 0.75;

type MeditationPlayerProps = {
  meditation: PlanMeditation;
  /** Fired once, when the recording reaches its end. */
  onComplete: () => void;
};

type Stage =
  | { status: 'downloading' }
  | { status: 'ready'; uri: string }
  | { status: 'failed' };

/**
 * The guided meditation: the other way to complete a relaxation task.
 *
 * Built as two components because `useAudioPlayer` cannot be called
 * conditionally and takes its source at mount — the same split, for the same
 * reason, as `ExerciseVideo`. This half owns getting the file onto the device;
 * `MeditationStage` below owns playing it.
 *
 * The download only ever happens once (see `meditationAudio`), so on every play
 * after the first this mounts straight into `ready` and there is no spinner at
 * all.
 */
export function MeditationPlayer({ meditation, onComplete }: MeditationPlayerProps) {
  const [stage, setStage] = useState<Stage>(() => {
    const local = cachedMeditationUri(meditation.audio);
    return local ? { status: 'ready', uri: local } : { status: 'downloading' };
  });

  useEffect(() => {
    if (stage.status !== 'downloading') return;
    let active = true;
    ensureMeditationFile(meditation.audio)
      .then((uri) => {
        if (active) setStage({ status: 'ready', uri });
      })
      .catch((error) => {
        logger.warn('MeditationPlayer: download failed', error);
        if (active) setStage({ status: 'failed' });
      });
    return () => {
      active = false;
    };
  }, [stage.status, meditation.audio]);

  const retry = useCallback(() => setStage({ status: 'downloading' }), []);

  if (stage.status === 'ready') {
    return <MeditationStage uri={stage.uri} meditation={meditation} onComplete={onComplete} />;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        {stage.status === 'downloading' ? (
          <ActivityIndicator color={colors.lavender} size="large" />
        ) : null}
      </View>

      {stage.status === 'downloading' ? (
        // Said plainly, with the size, because it is a wait she will only ever
        // have once and a silent spinner on a 15MB file over a weak connection
        // looks like something has hung.
        <Text style={styles.note}>
          Downloading once — about 15 MB. After this it plays instantly, with or
          without signal.
        </Text>
      ) : (
        <>
          <Text style={styles.note}>
            We could not fetch the meditation. It usually means there is no connection
            right now.
          </Text>
          <AnimatedPressable
            containerStyle={styles.buttonWrap}
            style={styles.button}
            onPress={retry}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={styles.buttonText}>Try again</Text>
          </AnimatedPressable>
        </>
      )}
    </View>
  );
}

type MeditationStageProps = MeditationPlayerProps & { uri: string };

/**
 * The player proper, once the audio is on disk.
 *
 * Two things it deliberately does not do, both of which the practice timer
 * beside it does:
 *
 *  - **It does not pause when the app goes to the background.** That is the
 *    feature. She lies down, the screen locks a minute later, and the voice has
 *    to still be there — which is also why the audio session is switched on
 *    mount and handed back on unmount. See `audioMode`.
 *  - **It shows no cue lines.** The recording is already talking to her; a
 *    second voice in text underneath it is one thing too many to attend to.
 */
function MeditationStage({ uri, meditation, onComplete }: MeditationStageProps) {
  const reduceMotion = useReduceMotion();
  const player = useAudioPlayer({ uri }, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const notified = useRef(false);

  // Claimed for as long as this player is on screen, and handed straight back —
  // leaving the session in meditation mode would mute the mute switch for every
  // reward chime that follows.
  useEffect(() => {
    setAudioProfile('meditation');
    return () => {
      setAudioProfile('cues');
    };
  }, []);

  // Navigating away, or switching back to the breathing, has to stop the voice.
  // Background playback means nothing else will: that is the point of it.
  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch (error) {
        // Already released by the hook's own teardown. Nothing left to stop.
        logger.warn('MeditationPlayer: pause on unmount failed', error);
      }
    };
  }, [player]);

  useEffect(() => {
    if (!status.didJustFinish || notified.current) return;
    notified.current = true;
    onComplete();
  }, [status.didJustFinish, onComplete]);

  // The catalog's length until the file has been read, so the face shows the
  // real duration from the first frame rather than counting up from zero.
  const total = status.duration > 0 ? status.duration : meditation.seconds;
  const elapsed = Math.min(status.currentTime, total);
  const remaining = Math.max(0, Math.round(total - elapsed));
  const started = elapsed > 0;
  const finished = total - elapsed <= END_EPSILON && started;

  const toggle = useCallback(() => {
    if (player.playing) {
      player.pause();
      return;
    }
    // A player sitting at its end plays nothing when told to play, so rewind
    // first — the same trap the session countdown hits between ticks.
    if (player.duration > 0 && player.duration - player.currentTime <= END_EPSILON) {
      player.seekTo(0).catch(() => {});
    }
    player.play();
  }, [player]);

  const label = status.playing ? 'Pause' : started ? 'Continue' : 'Start';

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <PracticeHalo
          size={PRACTICE_RING_SIZE}
          active={status.playing}
          reduceMotion={reduceMotion}
        />
        <ProgressRing
          value={elapsed}
          total={total}
          size={PRACTICE_RING_SIZE}
          strokeWidth={8}
          color={colors.lavender}
          label={formatDuration(remaining)}
          labelSize={PRACTICE_CLOCK_SIZE}
        />
      </View>

      <AnimatedPressable
        containerStyle={styles.buttonWrap}
        style={styles.button}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={styles.buttonText}>{label}</Text>
      </AnimatedPressable>

      {!started && <Text style={styles.note}>{meditation.use}</Text>}

      {/* The one thing worth saying mid-session, and only while it can still be
          acted on: she can put the phone down, which on a screen she is meant to
          close her eyes for is the instruction that matters. */}
      {status.playing && !finished && (
        <Text style={styles.note}>You can lock your screen. It keeps playing.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  stage: {
    width: PRACTICE_RING_SIZE,
    height: PRACTICE_RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonWrap: {
    marginTop: spacing.lg,
    width: 'auto',
  },
  button: {
    minHeight: minTouchTarget,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
    ...shadows.buttonPrimary,
  },
  buttonText: {
    ...typography.presets.button,
    color: colors.textInverse,
  },
  note: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
