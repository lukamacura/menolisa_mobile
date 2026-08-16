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
  completedSets,
  nextStep,
  stepSeconds,
  totalSets,
  type SessionExercise,
  type SessionStep,
} from '../src/lib/sessionSteps';
import type { ExerciseDose, PlanExercise } from '../src/lib/planTypes';

function make(name: string, dose: ExerciseDose): SessionExercise {
  const exercise: PlanExercise = { id: name.slice(0, 3), name, props: 'None', dose };
  return { exercise, dose };
}

// One of each unit, both-sides and per-side, so every ordering rule is exercised.
const items: SessionExercise[] = [
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
];

function describe(step: SessionStep): string {
  if (step.kind === 'done') return 'DONE';
  const name = items[step.index].exercise.name;
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

console.log(`${items.length} exercises · ${total} sets\n`);

while (step.kind !== 'done' && guard++ < 200) {
  const seconds = stepSeconds(step, items, false);
  const clock = seconds === null ? 'SELF-PACED' : `${seconds}s`;
  if (seconds === null) untimed++;
  else runSeconds += seconds;
  if (step.kind === 'work') workSteps++;
  console.log(
    `${String(guard).padStart(3)}  ${describe(step).padEnd(46)} ${clock.padStart(10)}  ${completedSets(step, items)}/${total} sets`
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

if (problems.length) {
  console.error('\nFAIL\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log('\nOK — every set reached, both sides run, session terminates.');
