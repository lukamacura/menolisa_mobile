/*
 * The synthesiser the app's cue-building scripts share.
 *
 * Every sound this app makes is written rather than sourced, so there is no
 * stock licence to track and every cue can be tuned against every other one by
 * ear. Keeping the voice in one file is what makes that possible: the reward
 * chimes and the session countdown are struck by the same `strike()`, so they
 * sound like one instrument even though they are built by separate scripts.
 *
 * The palette everything is written in is a C-major pentatonic — no semitone
 * clashes are possible, so any two cues that collide still land consonant.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SAMPLE_RATE = 44100;

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

/**
 * Write every cue to `outDir` as 44.1 kHz mono, then encode to .m4a via macOS
 * `afconvert` (AAC plays natively on both iOS and Android; the WAVs are ~10x
 * larger and are deleted once encoded).
 *
 * Each file is peak-normalised on its own, so they all end up equally *loud* —
 * the hierarchy between cues is a playback concern, imposed by the per-cue
 * volumes in the `src/lib/*Sound.ts` that plays them.
 */
function emit(outDir, cues) {
  fs.mkdirSync(outDir, { recursive: true });

  cues.forEach(([name, samples]) => {
    const wav = path.join(outDir, `${name}.wav`);
    const m4a = path.join(outDir, `${name}.m4a`);
    writeWav(wav, samples);

    try {
      execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '96000', wav, m4a]);
      fs.unlinkSync(wav);
      console.log(`wrote ${path.relative(process.cwd(), m4a)}`);
    } catch (error) {
      console.log(`wrote ${path.relative(process.cwd(), wav)} (afconvert unavailable — WAV kept)`);
    }
  });
}

module.exports = { SAMPLE_RATE, note, strike, shimmer, render, writeWav, emit };
