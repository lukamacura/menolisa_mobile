import { useDailyReminders } from '../hooks/useDailyReminders';

/**
 * Mount point for the local reminder scheduler. Renders nothing.
 *
 * It exists as a component rather than a hook call in `MainTabs` because the
 * scheduler reads `PlanContext`, `RewardsContext` and the notification
 * permission — all three of which `MainTabs` itself provides, and none of which
 * a component can consume from inside the tree it declares.
 */
export function DailyReminders(): null {
  useDailyReminders();
  return null;
}
