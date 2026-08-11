/*
 * Synthesises the reward chimes in `assets/sounds/` from scratch.
 *
 * Written rather than sourced so the app owns the audio outright — no stock
 * licence to track, and the two cues can be tuned against each other by ear
 * (re-run this, listen, adjust the note tables below).
 *
 * Run with: node scripts/build-reward-sounds.js
 * Emits 44.1 kHz mono WAV, then encodes to .m4a via macOS `afconvert`
 * (AAC plays natively on both iOS and Android; the WAVs are ~10x larger and
 * are deleted once encoded).
 *
 * The palette is a C-major pentatonic — no semitone clashes are possible, so
 * every note lands consonant however the tiers stack up.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SAMPLE_RATE = 44100;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'sounds');

/** Equal-temperament pitch, A4 = 440 Hz. */
function note(name) {
  const table = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const [letter, octave] = [name[0], Number(name.slice(1))];
  const midi = (octave + 1) * 12 + table[letter];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * One struck note, mixed into `buffer` at `startSec`.
 *
 * Bell-like rather than a pure sine: partials above the fundamental decay
 * faster than it does, which is what a real struck bar does and what stops a
 * sine tone from sounding like a test signal. The 4 ms attack ramp exists to
 * kill the click a hard start makes at this sample rate.
 */
function strike(buffer, startSec, freq, { gain = 0.25, decay = 0.9, partials = [1, 2, 3] }) {
  const start = Math.floor(startSec * SAMPLE_RATE);
  const length = Math.floor(decay * 4 * SAMPLE_RATE);
  const attack = Math.floor(0.004 * SAMPLE_RATE);

  for (let i = 0; i < length; i += 1) {
    const index = start + i;
    if (index >= buffer.length) break;

    const t = i / SAMPLE_RATE;
    const envelope = Math.exp(-t / decay) * (i < attack ? i / attack : 1);

    let sample = 0;
    partials.forEach((multiple, order) => {
      // Higher partials are quieter and die sooner — the "ping then hum" shape.
      const partialGain = 1 / Math.pow(multiple, 1.6);
      const partialDecay = Math.exp(-t / (decay / (1 + order * 0.9)));
      sample += Math.sin(2 * Math.PI * freq * multiple * t) * partialGain * partialDecay;
    });

    buffer[index] += sample * envelope * gain;
  }
}

/** A breath of filtered noise under the first note — the "air" before the bell. */
function shimmer(buffer, startSec, durationSec, gain) {
  const start = Math.floor(startSec * SAMPLE_RATE);
  const length = Math.floor(durationSec * SAMPLE_RATE);
  let previous = 0;

  for (let i = 0; i < length; i += 1) {
    const index = start + i;
    if (index >= buffer.length) break;

    const t = i / SAMPLE_RATE;
    // One-pole high-pass on white noise: hiss, not rumble.
    const white = Math.random() * 2 - 1;
    const filtered = white - previous;
    previous = white;

    const envelope = Math.sin(Math.PI * (t / durationSec)) ** 2;
    buffer[index] += filtered * envelope * gain;
  }
}

function render(totalSec, build) {
  const buffer = new Float64Array(Math.ceil(totalSec * SAMPLE_RATE));
  build(buffer);
  return buffer;
}

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

/** Peak-normalise with headroom, then write 16-bit PCM. */
function writeWav(filePath, samples) {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const scale = peak > 0 ? 0.89 / peak : 1;

  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i] * scale));
    data.writeInt16LE(Math.round(clamped * 32767), i * 2);
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);

  fs.writeFileSync(filePath, Buffer.concat([header, data]));
}

fs.mkdirSync(OUT_DIR, { recursive: true });

/*
 * Each file is peak-normalised on its own, so these end up equally *loud* —
 * the fact that the completion cue should sit under the other two is a
 * playback concern, handled by the per-cue volumes in `src/lib/rewardSound.ts`.
 */
[
  ['reward-completion', completion],
  ['reward-badge', badge],
  ['reward-level', level],
].forEach(([name, samples]) => {
  const wav = path.join(OUT_DIR, `${name}.wav`);
  const m4a = path.join(OUT_DIR, `${name}.m4a`);
  writeWav(wav, samples);

  try {
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '96000', wav, m4a]);
    fs.unlinkSync(wav);
    console.log(`wrote ${path.relative(process.cwd(), m4a)}`);
  } catch (error) {
    console.log(`wrote ${path.relative(process.cwd(), wav)} (afconvert unavailable — WAV kept)`);
  }
});
