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
import type { ExerciseDose, PlanExercise, SessionPhase } from '../src/lib/planTypes';

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
// exercised — bracketed by the bookends, so the phase-filtered tallies and the
// capped prep rest are walked too.
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

// Rest is capped by phase, not by the catalog row it came from.
const longRest: SessionExercise = {
  ...items[0],
  dose: { ...items[0].dose, restSeconds: 90 },
};
if (restFor(longRest, false) !== PREP_MAX_REST_SECONDS) {
  problems.push('a warm-up kept its full prescribed rest');
}

if (problems.length) {
  console.error('\nFAIL\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log(
  '\nOK — every set reached, both sides run, bookends counted separately, session terminates.'
);
