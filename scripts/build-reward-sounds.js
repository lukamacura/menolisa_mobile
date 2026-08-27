/*
 * Synthesises the reward chimes in `assets/sounds/` from scratch.
 *
 * Written rather than sourced so the app owns the audio outright — no stock
 * licence to track, and the three cues can be tuned against each other by ear
 * (re-run this, listen, adjust the note tables below). The voice they are
 * struck with lives in `scripts/lib/wav-synth.js`, shared with the session
 * countdown so the two never sound like two different apps.
 *
 * Run with: node scripts/build-reward-sounds.js
 */

const path = require('path');
const { note, strike, shimmer, render, emit } = require('./lib/wav-synth');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'sounds');

/**
 * One thing ticked off: two notes a fourth apart, and gone.
 *
 * The one that fires most — a dozen-plus times on a full day — so it is the
 * shortest and plainest of the three. No shimmer, no tail: anything with a ring
 * to it becomes unbearable by the fourth nutrition row. It resolves upward onto
 * C6, the note the badge cue *starts* on, so a badge landing right after a tick
 * sounds like the same instrument continuing rather than a second app.
 */
const completion = render(1.2, (buffer) => {
  strike(buffer, 0.0, note('G5'), { gain: 0.22, decay: 0.22, partials: [1, 2] });
  strike(buffer, 0.07, note('C6'), { gain: 0.26, decay: 0.42, partials: [1, 2] });
});

/**
 * Badge earned: three notes up, quick and light. Under a second so it can fire
 * three times in a row (three tiers at midnight) without wearing thin.
 */
const badge = render(2.4, (buffer) => {
  shimmer(buffer, 0, 0.35, 0.05);
  strike(buffer, 0.0, note('C6'), { gain: 0.3, decay: 0.55 });
  strike(buffer, 0.09, note('E6'), { gain: 0.28, decay: 0.6 });
  strike(buffer, 0.18, note('G6'), { gain: 0.32, decay: 1.1 });
  // An octave above the last note, quiet and late: the tail that reads as sparkle.
  strike(buffer, 0.3, note('G7'), { gain: 0.1, decay: 0.9, partials: [1, 2] });
});

/**
 * Level up: the same voice, but four notes climbing an octave and landing on a
 * held chord. Longer and fuller so it is unmistakably the bigger of the two —
 * a level should never sound like just another badge.
 */
const level = render(3.4, (buffer) => {
  shimmer(buffer, 0, 0.5, 0.06);
  strike(buffer, 0.0, note('C6'), { gain: 0.26, decay: 0.5 });
  strike(buffer, 0.1, note('E6'), { gain: 0.26, decay: 0.5 });
  strike(buffer, 0.2, note('G6'), { gain: 0.26, decay: 0.5 });
  strike(buffer, 0.3, note('A6'), { gain: 0.28, decay: 0.6 });
  // The landing: a chord rather than a single note, rung out long.
  strike(buffer, 0.46, note('C7'), { gain: 0.3, decay: 1.6 });
  strike(buffer, 0.46, note('E7'), { gain: 0.2, decay: 1.5 });
  strike(buffer, 0.46, note('G7'), { gain: 0.16, decay: 1.4 });
  strike(buffer, 0.62, note('C5'), { gain: 0.18, decay: 1.8, partials: [1, 2] });
});

emit(OUT_DIR, [
  ['reward-completion', completion],
  ['reward-badge', badge],
  ['reward-level', level],
]);
