import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { ensureAudioMode } from './audioMode';
import { logger } from './logger';

/**
 * The countdown a guided movement session is run by.
 *
 * The whole design constraint is that she is not looking at the screen. She is
 * in a plank, or holding a wall sit with her phone face-down on the mat, and
 * the only way she knows the set is nearly over is what she hears and feels.
 * So the clock speaks: three ticks at three, two, one, and one bigger note when
 * it hits zero.
 *
 * Two sounds and no more. The temptation is to mark every state change — set
 * starting, rest starting, exercise changing — and that is exactly how a timer
 * becomes something she mutes, at which point it can tell her nothing at all.
 *
 * Assets are synthesised by `scripts/build-session-sounds.js` — re-run it to
 * retune them.
 */
export type SessionCue = 'tick' | 'end';

const SOURCES: Record<SessionCue, number> = {
  tick: require('../../assets/sounds/session-tick.m4a'),
  end: require('../../assets/sounds/session-end.m4a'),
};

/**
 * Per-cue playback level.
 *
 * The assets are each peak-normalised by the build script, so they arrive
 * equally loud and the hierarchy has to be imposed here. The ticks sit well
 * under the note that ends the set — that gap is what makes the last one read
 * as an ending rather than as a fourth tick.
 */
const VOLUMES: Record<SessionCue, number> = {
  tick: 0.45,
  end: 0.9,
};

const players: Partial<Record<SessionCue, AudioPlayer>> = {};

function playerFor(cue: SessionCue): AudioPlayer {
  let player = players[cue];
  if (!player) {
    player = createAudioPlayer(SOURCES[cue]);
    player.volume = VOLUMES[cue];
    players[cue] = player;
  }
  return player;
}

/**
 * Decode both cues ahead of time. Call this when the session screen mounts.
 *
 * Creating the player is what reads and decodes the file, and doing it lazily
 * costs a few hundred milliseconds on first play. On a reward chime that is a
 * delay; on a countdown it is a wrong answer — a tick that lands late is a tick
 * on the wrong second, and she is counting on it.
 */
export function prepareSessionSounds(): void {
  ensureAudioMode();
  (Object.keys(SOURCES) as SessionCue[]).forEach((cue) => {
    try {
      playerFor(cue);
    } catch (error) {
      logger.warn('sessionSound: preload failed', error);
    }
  });
}

/**
 * Fire one countdown cue.
 *
 * Never throws and never returns a rejected promise: a set whose clock cannot
 * make a sound still has to run, and the haptic beside every one of these calls
 * carries the moment on a muted phone anyway. Every failure is swallowed after
 * a log.
 */
export async function playSessionCue(cue: SessionCue): Promise<void> {
  try {
    await ensureAudioMode();
    const player = playerFor(cue);
    // Rewind first — the same player serves the next tick a second later, and a
    // player left at its end plays nothing at all when told to play again.
    await player.seekTo(0);
    player.play();
  } catch (error) {
    logger.warn('sessionSound: playback failed', error);
  }
}
