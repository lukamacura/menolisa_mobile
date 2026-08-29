import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { usePlan, tasksForPillar } from '../context/PlanContext';
import { useRewards } from '../context/RewardsContext';
import { useNotificationPermission } from '../context/NotificationPermissionContext';
import { useReminderPrefs } from './useReminderPrefs';
import { dayInPlan, isPlanFinished, isTaskComplete, taskRemainingLabel } from '../lib/planFormat';
import { PLAN_WEEKS, type PlanReady } from '../lib/planTypes';
import {
  cancelScheduledReminders,
  syncScheduledReminders,
} from '../lib/reminders/schedule';
import type { DayState, TrainingWindow } from '../lib/reminders/types';

/**
 * Keeps the device's scheduled reminders in step with her actual day.
 *
 * The contract is one line: **whenever anything that could change the answer
 * changes, rebuild the schedule.** That is what makes a reminder disappear the
 * instant she ticks the box — `PlanContext` hands back a new plan object on
 * every tick, this re-runs, and `syncScheduledReminders` cancels what is no
 * longer true. A server cron could not do that at any price.
 *
 * The reads are all derived, never fetched: everything below already lives in
 * `PlanContext` and `RewardsContext` for the screens, so a reminder costs no
 * network at all.
 */

/** Ticks settle before we rebuild — six water taps should cost one pass, not six. */
const DEBOUNCE_MS = 1_200;

/** The catalog id of the water row. Stable since the plan shipped. */
const WATER_ID = 'water_6';

export function useDailyReminders(): void {
  const { user, accountStatus } = useAuth();
  const { plan, status, date } = usePlan();
  const { rewards } = useRewards();
  const { status: permission } = useNotificationPermission();
  const prefs = useReminderPrefs();

  const ready = status === 'ready' ? plan : null;

  const dayState = useMemo<DayState | null>(() => {
    if (!ready) return null;
    return buildDayState(ready, {
      firstName: accountStatus?.first_name ?? null,
      trainingWindow: accountStatus?.training_time ?? null,
      streak: rewards && rewards.date === date ? rewards.streak.current : 0,
    });
  }, [ready, accountStatus?.first_name, accountStatus?.training_time, rewards, date]);

  /** Bumped by anything that should force a rebuild without changing the state. */
  const [wake, setWake] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      // Catches the day rolling over under a foregrounded app, and a return
      // from system settings where permission may have just been granted.
      if (next === 'active') setWake((n) => n + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);

    // Nothing to schedule for, or nowhere to schedule to. Clearing rather than
    // returning early matters on sign-out: reminders written for one account
    // must not go on firing at whoever holds the phone next.
    if (!user || !prefs || permission !== 'granted' || !dayState || !prefs.enabled) {
      cancelScheduledReminders();
      return;
    }

    timer.current = setTimeout(() => {
      syncScheduledReminders({ state: dayState, prefs });
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [user, prefs, permission, dayState, wake]);
}

/**
 * Everything the selector needs, read off the plan she is already looking at.
 *
 * The rules here mirror the server's, deliberately: "active today" is *any*
 * tick at all (the same rule `lib/rewards/compute.ts` scores a streak by), and
 * the week-start test is the same offset arithmetic the old evening cron ran.
 * Two implementations of one rule is how a streak reminder ends up naming a
 * number her Rewards screen disagrees with.
 */
function buildDayState(
  plan: PlanReady,
  extra: {
    firstName: string | null;
    trainingWindow: TrainingWindow | null;
    streak: number;
  }
): DayState {
  const finished = isPlanFinished(plan);
  const currentWeek = plan.weeks.find((week) => week.state === 'current') ?? null;

  const activeToday =
    (currentWeek?.tasks ?? []).some((task) => task.doneToday > 0) ||
    plan.habits.some((habit) => habit.doneToday > 0) ||
    plan.nutrition.groups.some((group) => group.items.some((item) => item.count > 0));

  const movementPillar = tasksForPillar(currentWeek, 'movement');
  /**
   * The week's open session, and whether she has already trained today.
   *
   * Kept as two facts rather than one, because they are answers to two
   * different questions. Movement is counted across the week, so a task at 1 of
   * 3 is genuinely still open on the evening of the day she did that first
   * session — nudging her about it *then* reads as an app that did not notice
   * she trained, which is why `trainedToday` suppresses today's reminder. But it
   * says nothing at all about tomorrow, and folding the two together is what
   * left the blind days with no movement reminder to schedule.
   */
  const trainedToday = movementPillar.some((task) => task.doneToday > 0);
  const movementTask = movementPillar.find((task) => !isTaskComplete(task, finished));

  const water = plan.nutrition.groups
    .flatMap((group) => group.items)
    .find((item) => item.id === WATER_ID);

  return {
    activeToday,
    firstName: extra.firstName,
    trainingWindow: extra.trainingWindow,
    trainedToday,
    movement: movementTask
      ? {
          taskKey: movementTask.key,
          title: movementTask.title,
          remaining: taskRemainingLabel(movementTask, finished),
        }
      : null,
    water: water ? { count: water.count, target: water.target } : null,
    streak: activeToday ? 0 : extra.streak,
    weekStartingTomorrow: weekStartingTomorrow(plan),
  };
}

/**
 * The plan week that begins tomorrow, on the one evening in seven that is true.
 *
 * `dayInPlan` is 1-based and counts today, which makes it exactly the number of
 * whole days between `startedAt` and tomorrow — so day 7 (the last day of week
 * 1) is the evening week 2 is announced.
 */
function weekStartingTomorrow(
  plan: PlanReady
): { number: number; title: string | null } | null {
  const dayIndex = dayInPlan(plan);
  if (dayIndex <= 0 || dayIndex % 7 !== 0) return null;

  const number = dayIndex / 7 + 1;
  if (number > PLAN_WEEKS) return null;

  return {
    number,
    title: plan.weeks.find((week) => week.number === number)?.title || null,
  };
}
