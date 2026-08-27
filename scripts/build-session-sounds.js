/*
 * Synthesises the guided-session countdown cues in `assets/sounds/`.
 *
 * Two sounds, and the whole point is that she can tell them apart with her eyes
 * shut and her hands on the floor: three short ticks at three, two, one, then
 * one bigger note when the clock hits zero. Nothing else — a session that
 * chirps at every state change becomes a session she mutes.
 *
 * Struck with the same voice as the reward chimes (`scripts/lib/wav-synth.js`)
 * so the timer and the celebration sound like one instrument.
 *
 * Run with: node scripts/build-session-sounds.js
 */

const path = require('path');
const { note, strike, render, emit } = require('./lib/wav-synth');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'sounds');

/**
 * Three, two, one: one dry note, cut short.
 *
 * Deliberately the plainest sound in the app. It fires three times in four
 * seconds, so any ring on it would smear the three ticks into one wash and
 * destroy the only thing they carry — the count. G5 is the note the completion
 * chime opens on, and it resolves up to the C6 the cue below lands on.
 */
const tick = render(0.6, (buffer) => {
  strike(buffer, 0.0, note('G5'), { gain: 0.3, decay: 0.14, partials: [1, 2] });
});

/**
 * Zero: the same instrument, struck properly.
 *
 * A fourth above the ticks and rung out ten times longer, with the octave and
 * a low C under it for body. It has to read as *arrival* through gym noise and
 * a pocket — she is mid-plank waiting to be told to stop, and a fourth tick
 * that happens to be the last one is not an ending.
 */
const end = render(2.4, (buffer) => {
  strike(buffer, 0.0, note('C6'), { gain: 0.32, decay: 1.1 });
  strike(buffer, 0.0, note('G6'), { gain: 0.16, decay: 0.85 });
  strike(buffer, 0.0, note('C7'), { gain: 0.1, decay: 0.6, partials: [1, 2] });
  // Under everything, quiet and long: the weight that makes it land.
  strike(buffer, 0.02, note('C5'), { gain: 0.16, decay: 1.4, partials: [1, 2] });
});

emit(OUT_DIR, [
  ['session-tick', tick],
  ['session-end', end],
]);
