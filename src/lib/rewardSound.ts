import { Platform } from 'react-native';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { ensureAudioMode } from './audioMode';
import { logger } from './logger';

/**
 * The sound and feel of a reward landing.
 *
 * Sound and haptics are one call rather than two because they are one event:
 * a chime with no buzz feels thin, and a buzz with no chime (phone on silent)
 * still has to carry the moment on its own. Every caller wants both.
 *
 * Assets are synthesised by `scripts/build-reward-sounds.js` — re-run it to
 * retune them.
 */

/**
 * The three weights a reward comes in, matched to how much screen it takes.
 *
 * `completion` is the toast that passes touches through, `achievement` the
 * panel or modal that owns the screen, `level` the rarest of all. Anything that
 * celebrates should pick the one matching its visual weight — a cue heavier
 * than the thing it announces is what makes an app feel like it is shouting.
 */
type RewardCue = 'completion' | 'achievement' | 'level';

const SOURCES: Record<RewardCue, number> = {
  completion: require('../../assets/sounds/reward-completion.m4a'),
  achievement: require('../../assets/sounds/reward-badge.m4a'),
  level: require('../../assets/sounds/reward-level.m4a'),
};

/**
 * Per-cue playback level.
 *
 * The assets are each peak-normalised by the build script, so they arrive
 * equally loud and the hierarchy has to be imposed here. `completion` fires
 * more than all the others combined on a good day — it sits well under them
 * deliberately, closer to a keyboard tick than a fanfare.
 */
const VOLUMES: Record<RewardCue, number> = {
  completion: 0.4,
  achievement: 0.7,
  level: 0.7,
};

/** Heavier cues win a collision. Same order as the tiers above. */
const WEIGHTS: Record<RewardCue, number> = {
  completion: 1,
  achievement: 2,
  level: 3,
};

/**
 * How close two cues have to be before they are treated as one moment.
 *
 * Rewards genuinely do land together: finishing a breathing practice ticks the
 * task *and* shows the gratitude panel, so two cues fire on one tap. Long
 * enough to catch that and a fast run of taps down a stepper; short enough that
 * two things she did deliberately still sound like two things.
 */
const COALESCE_MS = 400;

const players: Partial<Record<RewardCue, AudioPlayer>> = {};
let lastCueAt = 0;
let lastCue: RewardCue | null = null;

function playerFor(cue: RewardCue): AudioPlayer {
  let player = players[cue];
  if (!player) {
    player = createAudioPlayer(SOURCES[cue]);
    player.volume = VOLUMES[cue];
    players[cue] = player;
  }
  return player;
}

/**
 * Decode every cue ahead of time.
 *
 * Call this when the rewards tree mounts. Creating the player is what reads and
 * decodes the file, and doing it lazily costs a few hundred milliseconds on
 * first play — enough that the chime arrives after the confetti instead of with
 * it, which reads as a bug rather than a delay.
 */
export function prepareRewardSounds(): void {
  ensureAudioMode();
  (Object.keys(SOURCES) as RewardCue[]).forEach((cue) => {
    try {
      playerFor(cue);
    } catch (error) {
      logger.warn('rewardSound: preload failed', error);
    }
  });
}

/**
 * Fire the cue for a celebration that just appeared.
 *
 * Cues arriving inside `COALESCE_MS` of each other are collapsed to the heavier
 * one, so one tap makes one sound however many components decided to celebrate
 * it. The lighter cue is dropped outright rather than delayed — a chime that
 * arrives after its animation has gone reads as a different, unexplained event.
 *
 * Never throws and never returns a rejected promise: a celebration that cannot
 * make a sound must still show its badge, so every failure here is swallowed
 * after a log.
 */
export async function playRewardCue(cue: RewardCue): Promise<void> {
  const now = Date.now();
  const colliding = lastCue !== null && now - lastCueAt < COALESCE_MS ? lastCue : null;

  if (colliding && WEIGHTS[cue] <= WEIGHTS[colliding]) return;
  // Outranked something already ringing: silence it, or the two overlap into a
  // muddle instead of the bigger moment we decided this was.
  if (colliding) players[colliding]?.pause();

  lastCueAt = now;
  lastCue = cue;

  haptics(cue);

  try {
    await ensureAudioMode();
    const player = playerFor(cue);
    // Rewind first — the same player serves the next badge in the queue, and a
    // player left at its end plays nothing at all when told to play again.
    await player.seekTo(0);
    player.play();
  } catch (error) {
    logger.warn('rewardSound: playback failed', error);
  }
}

/**
 * The physical half of the cue.
 *
 * A completion gets a single light impact — a tap back, nothing more, because
 * it happens every time she ticks a row and a success buzz that often stops
 * meaning anything. A badge gets the system success notification — short, and
 * already the sound of "that worked" on her phone. A level gets a two-beat
 * pattern instead, so it is distinguishable through a pocket: the tiers and the
 * level-up both fire on the same tick, and they should not feel identical.
 *
 * Android's notification haptics are vaguer than iOS's, so levels there get two
 * plain impacts, which the platform renders reliably.
 */
function haptics(cue: RewardCue): void {
  try {
    if (cue === 'completion') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    if (cue === 'achievement') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }, 180);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 180);
  } catch (error) {
    logger.warn('rewardSound: haptics failed', error);
  }
}
