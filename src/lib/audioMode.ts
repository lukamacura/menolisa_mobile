import { setAudioModeAsync } from 'expo-audio';
import { logger } from './logger';

let ready: Promise<void> | null = null;

/**
 * Configure the audio session. Set once, for the whole app.
 *
 * `playsInSilentMode: false` is the important line: on iOS it makes the mute
 * switch mute us. She may well be logging a hot flash in a meeting, and a
 * celebration chirping out loud is the kind of thing that gets an app deleted.
 * The switch is her control and we do not override it — which is also why every
 * cue this app makes is paired with a haptic, so a muted phone still carries the
 * moment.
 *
 * `mixWithOthers` keeps whatever she is listening to playing underneath — a
 * one-second chime is not worth interrupting a podcast for, and a guided session
 * she is running to her own music must not silence it.
 *
 * Idempotent, and safe to call from every cue: the promise is memoised, so the
 * countdown does not re-negotiate the session three seconds before a set ends.
 */
export function ensureAudioMode(): Promise<void> {
  if (!ready) {
    ready = setAudioModeAsync({
      playsInSilentMode: false,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
      interruptionModeAndroid: 'duckOthers',
      shouldRouteThroughEarpiece: false,
    }).catch((error) => {
      logger.warn('audioMode: setup failed', error);
    });
  }
  return ready;
}
