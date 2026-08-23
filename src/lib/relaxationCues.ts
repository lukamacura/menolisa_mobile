/**
 * The lines that appear mid-practice, while she is breathing or lying still.
 *
 * Kept here rather than inside the players for two reasons. They are copy, and
 * copy is the one thing on these screens that will need translating. And they
 * are the only words in the app written to be read with half her attention —
 * they have to survive being glanced at from the floor, mid-exhale, so they are
 * short, they never ask a question, and none of them can be failed.
 *
 * Rules, if you add to these:
 * - No instruction she could get wrong ("breathe deeper" is a way to fail).
 * - No count, no timing, no target — the circle and the clock own those.
 * - Permission over correction. "If your mind wandered, that's the practice."
 */

/** Rotated through a breathing session, one every ~35 seconds. */
export const BREATHING_CUES = [
  'Let your shoulders drop away from your ears.',
  'Soften your jaw. Let your tongue rest.',
  'Nothing to fix right now. Only this breath.',
  'Let your hands be heavy.',
  'Feel the floor, or the chair, holding you.',
  'If your mind wandered, that is the practice. Come back.',
  'Slower is not better. Steady is.',
  'Let the exhale finish all the way out.',
] as const;

/** The first stretch, while the rhythm is still arriving. */
export const BREATHING_SETTLE_CUE = 'Settle in. The first few breaths are just arriving.';

/** The last stretch. Only shown when there are enough rounds for it to mean anything. */
export const BREATHING_LAST_CUE = 'Nearly there. Stay with it to the end.';

/** Rotated through a practice timer, one every ~40 seconds. */
export const PRACTICE_CUES = [
  'Let your body get heavy where it is resting.',
  'Unclench your jaw, your hands, your stomach.',
  'You do not have to do this well. You only have to stay.',
  'Notice one sound, then let it go.',
  'Let the out-breath be the longer one.',
  'If you drifted off, you are still doing it right.',
  'Nothing needs deciding for the next few minutes.',
] as const;

/** Shown once, around the midpoint. */
export const PRACTICE_HALFWAY_CUE = 'Halfway. The second half is the one that works.';

/** The last stretch of a practice. */
export const PRACTICE_LAST_CUE = 'Almost done. Do not rush the ending.';

/** How long one cue stays up before the next, per practice kind. */
export const BREATHING_CUE_SECONDS = 35;
export const PRACTICE_CUE_SECONDS = 40;

/** Wraps around, so a 90-round session keeps cycling rather than running dry. */
export function cueAt(cues: readonly string[], index: number): string {
  if (cues.length === 0) return '';
  return cues[((index % cues.length) + cues.length) % cues.length];
}
