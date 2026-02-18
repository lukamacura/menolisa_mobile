/**
 * Trigger options for symptom logging — aligned with web app.
 */
export const TRIGGER_OPTIONS = [
  'Stress',
  'Poor sleep',
  'Alcohol',
  'Coffee',
  'Spicy food',
  'Skipped meal',
  'Exercise',
  'Hot weather',
  'Work',
  'Travel',
  'Hormonal',
  'Unknown',
] as const;

export type TriggerOption = (typeof TRIGGER_OPTIONS)[number];

/** Timing options for "when did this happen" — aligned with web app. */
export type TimeSelection = 'now' | 'earlier-today' | 'yesterday';
