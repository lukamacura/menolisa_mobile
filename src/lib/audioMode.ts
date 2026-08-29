import { setAudioModeAsync, type AudioMode } from 'expo-audio';
import { logger } from './logger';

/**
 * The audio session, and the two things this app uses sound for.
 *
 * There is one audio session per app, so "configure it once at startup" only
 * works while everything the app plays wants the same session. That stopped
 * being true the day a guided meditation was added: the settings that make a
 * reward chime polite are the same settings that make an eleven-minute
 * meditation useless.
 *
 *   cues        A one-second chime or countdown tick. Muted by the mute switch,
 *               mixed under whatever she is already listening to, and stopped
 *               dead when the app goes to the background.
 *   meditation  Eleven minutes she has deliberately started, with her eyes shut
 *               and the phone face down. Plays through the mute switch, keeps
 *               playing when the screen locks, and takes the foreground from
 *               anything else that was making noise.
 *
 * So this file switches rather than sets, and it tracks the profile that is
 * *currently applied* rather than whether setup has ever run. That distinction
 * is the whole bug it was rewritten to avoid: the previous version memoised a
 * single promise, so once the meditation had claimed the session, every later
 * `ensureAudioMode()` was a no-op and the next reward chime played out loud on
 * a muted phone, over her music.
 */
export type AudioProfile = 'cues' | 'meditation';

const PROFILES: Record<AudioProfile, Partial<AudioMode>> = {
  /**
   * `playsInSilentMode: false` is the important line. She may well be logging a
   * hot flash in a meeting, and a celebration chirping out loud is the kind of
   * thing that gets an app deleted. The switch is her control and we do not
   * override it — which is also why every cue this app makes is paired with a
   * haptic, so a muted phone still carries the moment.
   *
   * `mixWithOthers` keeps whatever she is listening to playing underneath: a
   * one-second chime is not worth interrupting a podcast for, and a guided
   * session she is running to her own music must not silence it.
   */
  cues: {
    playsInSilentMode: false,
    shouldPlayInBackground: false,
    interruptionMode: 'mixWithOthers',
    interruptionModeAndroid: 'duckOthers',
    shouldRouteThroughEarpiece: false,
  },

  /**
   * Every line is the opposite of the one above it, and each for its own reason.
   *
   * `playsInSilentMode: true` is not a violation of the rule the cues follow. The
   * mute switch means "do not make noise at me"; she has just opened a
   * meditation and pressed play, which is as explicit as intent gets. An app
   * that answers that with silence looks broken, and the phone lives on silent.
   *
   * `shouldPlayInBackground: true` is what makes the feature work at all. She
   * lies down and the screen locks a minute later — without this the voice stops
   * there, which is the moment the practice was starting. On iOS it needs
   * `UIBackgroundModes: ['audio']` in app.config.js to have any effect; the flag
   * alone is silent about its own failure.
   *
   * `doNotMix` because a meditation playing over her podcast is not a mix, it is
   * two people talking at her.
   */
  meditation: {
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
    interruptionModeAndroid: 'doNotMix',
    shouldRouteThroughEarpiece: false,
  },
};

/** The profile the session is actually in, as far as we know. */
let applied: AudioProfile | null = null;

/**
 * Serialises the switches. A screen unmounting as another mounts fires two of
 * these in the same tick, and the session must end up in the profile of the
 * call that was made last, not the one that happened to resolve last.
 */
let queue: Promise<void> = Promise.resolve();

/**
 * Put the audio session in `profile`. Idempotent, never throws.
 *
 * A failure is logged and swallowed: the wrong session is a quieter or louder
 * sound than intended, and no screen in this app should refuse to work over it.
 * `applied` is left alone on failure so the next call tries again.
 */
export function setAudioProfile(profile: AudioProfile): Promise<void> {
  queue = queue.then(async () => {
    if (applied === profile) return;
    try {
      await setAudioModeAsync(PROFILES[profile]);
      applied = profile;
    } catch (error) {
      logger.warn(`audioMode: could not switch to ${profile}`, error);
    }
  });
  return queue;
}

/**
 * The session the chimes, ticks and reward sounds want.
 *
 * Kept under its original name because every cue in the app calls it before
 * playing, and that is exactly the behaviour that now matters: whatever the
 * meditation did to the session, the next chime puts it back.
 */
export function ensureAudioMode(): Promise<void> {
  return setAudioProfile('cues');
}
