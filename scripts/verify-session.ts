/**
 * Walks the movement session state machine end to end and prints every step.
 *
 * The player's ordering is pure (`src/lib/sessionSteps.ts`), so it can be
 * simulated here with no renderer and no device. Run it after touching the
 * sequence — a wrong `nextStep` is close to invisible on screen until she is
 * halfway through a session that skipped her second side.
 *
 *   npx tsx scripts/verify-session.ts
 */

import {
  PREP_MAX_REST_SECONDS,
  completedSets,
  nextStep,
  restFor,
  stepSeconds,
  totalSets,
  type SessionExercise,
  type SessionStep,
} from '../src/lib/sessionSteps';
import {
  powerThisSession,
  type ExerciseDose,
  type PlanExercise,
  type PlanTask,
  type SessionPhase,
} from '../src/lib/planTypes';
import { cardioExercise, cardioProtocol } from '../src/lib/cardio';

function make(name: string, dose: ExerciseDose, phase: SessionPhase = 'main'): SessionExercise {
  const exercise: PlanExercise = { id: name.slice(0, 3), name, props: 'None', dose };
  return { exercise, dose, phase };
}

/** A warm-up or cool-down move as the plan should send one: one block, no rest. */
function prep(name: string, seconds: number, phase: SessionPhase, perSide = false): SessionExercise {
  return make(
    name,
    {
      unit: 'duration',
      perSide,
      sets: 1,
      seconds,
      restSeconds: 0,
      estimatedSeconds: seconds,
    },
    phase
  );
}

// One of each unit, both-sides and per-side, so every ordering rule is
// exercised — bracketed by the bookends and carrying a power block, so the
// phase-filtered tallies, the capped prep rest and the power block's *un*capped
// rest are all walked too.
const items: SessionExercise[] = [
  prep('Neck circles & shoulder rolls', 40, 'warmup'),
  prep('Hip circles', 40, 'warmup', true),
  make('Box squat', {
    unit: 'timed',
    perSide: false,
    sets: 3,
    seconds: 40,
    restSeconds: 45,
    estimatedSeconds: 210,
  }),
  make('Step-up', {
    unit: 'timed',
    perSide: true,
    sets: 2,
    seconds: 30,
    restSeconds: 45,
    estimatedSeconds: 165,
  }),
  make('Wall sit', {
    unit: 'hold',
    perSide: false,
    sets: 2,
    seconds: 30,
    restSeconds: 45,
    estimatedSeconds: 105,
  }),
  make('Single-leg balance', {
    unit: 'hold',
    perSide: true,
    sets: 2,
    seconds: 30,
    restSeconds: 45,
    estimatedSeconds: 165,
  }),
  make('Zone 2 walk', {
    unit: 'duration',
    perSide: false,
    sets: 1,
    seconds: 600,
    restSeconds: 0,
    estimatedSeconds: 600,
  }),
  // Bone loading, after the work and before the cool-down. Worked and rested
  // like main work, but it must never count toward the main-work total.
  make(
    'Marching landings',
    {
      unit: 'timed',
      perSide: false,
      sets: 3,
      seconds: 20,
      restSeconds: 60,
      estimatedSeconds: 180,
    },
    'power'
  ),
  prep('Dynamic floor stretching', 60, 'cooldown'),
  prep('Torso twist with arm swings', 40, 'cooldown'),
];

function describe(step: SessionStep): string {
  if (step.kind === 'done') return 'DONE';
  const { name } = items[step.index].exercise;
  if (step.kind === 'transition') return `next up      ${name}`;
  if (step.kind === 'rest') return `rest         ${name} (after set ${step.set})`;
  if (step.kind === 'switch') return `switch sides ${name} (set ${step.set})`;
  // A per-side exercise runs its seconds once per side, so each side is a step.
  const dose = items[step.index].dose;
  const side = dose.perSide ? ` · side ${step.side + 1}` : '';
  return `WORK         ${name} set ${step.set}${side}`;
}

let step: SessionStep = { kind: 'transition', index: 0 };
let guard = 0;
let workSteps = 0;
let untimed = 0;
let runSeconds = 0;
const total = totalSets(items);
const mainTotal = totalSets(items, 'main');

console.log(
  `${items.length} exercises · ${total} sets (${mainTotal} of them main work)\n`
);

while (step.kind !== 'done' && guard++ < 200) {
  const seconds = stepSeconds(step, items, false);
  const clock = seconds === null ? 'SELF-PACED' : `${seconds}s`;
  if (seconds === null) untimed++;
  else runSeconds += seconds;
  if (step.kind === 'work') workSteps++;
  const phase = items[step.index]?.phase ?? 'main';
  console.log(
    `${String(guard).padStart(3)}  ${phase.padEnd(8)} ${describe(step).padEnd(46)} ${clock.padStart(10)}  ` +
      `${completedSets(step, items)}/${total} sets · main ${completedSets(step, items, 'main')}/${mainTotal}`
  );
  step = nextStep(step, items);
}

console.log(
  `\nfinal: ${describe(step)} · ${completedSets(step, items)}/${total} sets · ` +
    `${Math.round(runSeconds / 60)} min on the clock`
);

// A unilateral exercise runs its work step twice per set, once per side.
const expectedWork = items.reduce(
  (n, item) => n + item.dose.sets * (item.dose.perSide ? 2 : 1),
  0
);

const problems: string[] = [];
if (step.kind !== 'done') problems.push('never reached done');
// The whole point of the session: it runs itself. One untimed step and she is
// back to holding the phone waiting to be asked whether she is finished.
if (untimed) problems.push(`${untimed} step(s) had no clock — the session would stall there`);
if (workSteps !== expectedWork) problems.push(`ran ${workSteps} work steps, expected ${expectedWork}`);
if (completedSets(step, items) !== total) problems.push('final set count does not match the total');
if (completedSets(step, items, 'main') !== mainTotal) {
  problems.push('final main-work set count does not match the main total');
}

// The bookends must never be able to make the session look done. If a warm-up
// set counted as main work, `mainDone` would go true before she had lifted
// anything and the runner would offer to log the session on the way in.
const afterWarmup: SessionStep = { kind: 'transition', index: 2 };
if (completedSets(afterWarmup, items, 'main') !== 0) {
  problems.push('warm-up sets counted toward the main-work total');
}

// The power block is real work and must not count as main work either. If it
// did, `mainDone` would stay false through the whole block and the "the work is
// done" prompt would never appear where it should.
const powerItem = items.find((item) => item.phase === 'power');
if (!powerItem) {
  problems.push('the fixture lost its power block');
} else {
  const afterMain: SessionStep = { kind: 'transition', index: items.indexOf(powerItem) };
  if (completedSets(afterMain, items, 'main') !== mainTotal) {
    problems.push('main work was not complete on entering the power block');
  }
  if (totalSets(items, 'power') !== powerItem.dose.sets) {
    problems.push('power sets did not tally on their own phase');
  }
  if (totalSets(items, 'main') !== mainTotal || mainTotal === 0) {
    problems.push('power sets leaked into the main-work total');
  }
  // Full prescribed rest, unlike a bookend. Plyometrics done tired are a fall
  // risk, so the phase cap must not reach into this block.
  if (restFor(powerItem, false) !== powerItem.dose.restSeconds) {
    problems.push('the power block had its prescribed rest capped');
  }
}

// Run order: every power exercise sits after the last main one and before the
// first cool-down one. The order is a training decision, not a rendering one.
const phaseOrder = items.map((item) => item.phase);
const lastMain = phaseOrder.lastIndexOf('main');
const firstPower = phaseOrder.indexOf('power');
const firstCooldown = phaseOrder.indexOf('cooldown');
if (firstPower !== -1 && (firstPower < lastMain || firstPower > firstCooldown)) {
  problems.push('the power block did not run between the work and the cool-down');
}

// Rest is capped by phase, not by the catalog row it came from.
const longRest: SessionExercise = {
  ...items[0],
  dose: { ...items[0].dose, restSeconds: 90 },
};
if (restFor(longRest, false) !== PREP_MAX_REST_SECONDS) {
  problems.push('a warm-up kept its full prescribed rest');
}

/**
 * The `powerSessions` gate, walked across a whole week.
 *
 * The one piece of this feature that is app logic rather than rendering, and the
 * one an off-by-one hides in completely: showing the block on three of three
 * sessions looks fine on screen and is simply the wrong plan.
 */
function task(over: Partial<PlanTask>): PlanTask {
  return {
    key: 'w1_movement0',
    pillar: 'movement',
    title: 'Lower body',
    why: '',
    cadence: 'weekly',
    target: 3,
    doneToday: 0,
    doneThisWeek: 0,
    exercises: [],
    power: [{ id: 'I01', name: 'Marching landings', props: 'None' }],
    powerSessions: 2,
    ...over,
  };
}

const gate: [string, PlanTask, boolean][] = [
  ['session 1 of 3, 2 power sessions', task({ doneThisWeek: 0 }), true],
  ['session 2 of 3, 2 power sessions', task({ doneThisWeek: 1 }), true],
  ['session 3 of 3, 2 power sessions', task({ doneThisWeek: 2 }), false],
  ['a fourth, unasked-for session', task({ doneThisWeek: 3 }), false],
  ['beginner: 2 sessions, both with power', task({ target: 2, doneThisWeek: 1 }), true],
  // Absent on purpose: snacks, cardio-only sessions, and every plan written
  // before 2026-08-29. Nothing is invented to fill the gap.
  ['no power block at all', task({ power: undefined }), false],
  ['an empty power block', task({ power: [] }), false],
  // A server that sends the block without saying how often: every session.
  ['power with no powerSessions', task({ powerSessions: undefined, doneThisWeek: 5 }), true],
  ['powerSessions with no power', task({ power: undefined, powerSessions: 2 }), false],
];

console.log('\npowerSessions gate:');
for (const [name, entry, expected] of gate) {
  const actual = powerThisSession(entry);
  console.log(`  ${actual === expected ? 'ok  ' : 'FAIL'} ${name.padEnd(44)} ${actual}`);
  if (actual !== expected) {
    problems.push(`power gate wrong for ${name}: expected ${expected}, got ${actual}`);
  }
}

/**
 * Cardio: which tasks are one, and that one runs as a single block.
 *
 * The interesting half is what is *not* cardio. The test is the exercise id
 * family, never the log key — `w3_cardio` and `w3_movement` are keys, they have
 * changed once already, and a screen that matched on one would draw a walk's
 * layout around a squat the day the server renamed it.
 */
const cardioDose: ExerciseDose = {
  unit: 'duration',
  perSide: false,
  sets: 1,
  seconds: 25 * 60,
  restSeconds: 0,
  estimatedSeconds: 25 * 60,
};

const zone2: PlanExercise = {
  id: 'K01',
  name: 'Zone 2 cardio',
  props: 'Any activity — walk, bike, swim, row, elliptical',
  dose: cardioDose,
};
const intervals: PlanExercise = { ...zone2, id: 'K02', name: 'Sprint intervals' };
const squat: PlanExercise = { id: 'L01', name: 'Box squat', props: 'Sturdy chair' };

const cardioCases: [string, PlanTask, string | null][] = [
  ['a Zone 2 task', task({ key: 'w3_cardio', exercises: [zone2], power: undefined }), 'K01'],
  [
    'the interval task',
    task({ key: 'w5_intervals', exercises: [intervals], power: undefined }),
    'K02',
  ],
  // The key says cardio and the exercise says otherwise. The exercise wins.
  ['a strength session', task({ key: 'w3_movement', exercises: [squat] }), null],
  ['a strength session on the old key', task({ key: 'w3_movement0', exercises: [squat] }), null],
  ['a session with no exercises', task({ exercises: [] }), null],
  // Cardio never arrives with bookends or a power block. One that did would not
  // be the single-timer session this branch draws, so it falls through to the
  // ordinary runner rather than losing its warm-up on screen.
  [
    'a K row with a warm-up bolted on',
    task({ exercises: [zone2], warmup: [squat], power: undefined }),
    null,
  ],
  ['a K row with a power block', task({ exercises: [zone2] }), null],
  ['a relaxation task', task({ pillar: 'relaxation', exercises: [zone2], power: undefined }), null],
];

console.log('\ncardio tasks:');
for (const [name, entry, expected] of cardioCases) {
  const actual = cardioExercise(entry)?.id ?? null;
  console.log(`  ${actual === expected ? 'ok  ' : 'FAIL'} ${name.padEnd(44)} ${actual}`);
  if (actual !== expected) {
    problems.push(`cardio detection wrong for ${name}: expected ${expected}, got ${actual}`);
  }
}

// Only the protocol row explains itself. Zone 2 has no structure to print, and
// inventing one for it would be the app telling her how to walk.
if (cardioProtocol(zone2) !== null) problems.push('Zone 2 was given a protocol it does not have');
if (cardioProtocol(intervals)?.length !== 3) problems.push('the interval protocol lost a step');

// One block, start to finish: the whole session is one work step, and the step
// after it ends the session. No rest, no second set, no switch.
const walk: SessionExercise[] = [{ exercise: zone2, dose: cardioDose, phase: 'main' }];
const walkStart: SessionStep = { kind: 'work', index: 0, set: 1, side: 0 };
if (stepSeconds(walkStart, walk, false) !== cardioDose.seconds) {
  problems.push('a cardio block did not run for its full duration');
}
if (nextStep(walkStart, walk).kind !== 'done') {
  problems.push('a cardio block did not end the session when it finished');
}
if (totalSets(walk, 'main') !== 1 || completedSets({ kind: 'done' }, walk, 'main') !== 1) {
  problems.push('a finished cardio block did not count as a session');
}

if (problems.length) {
  console.error('\nFAIL\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log(
  '\nOK — every set reached, both sides run, bookends and power counted separately,\n' +
    'the power block runs between the work and the cool-down, the gate holds,\n' +
    'cardio is recognised by its exercise id and runs as one block, session terminates.'
);
