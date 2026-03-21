export const SYMPTOM_TRIGGERS: Readonly<Record<string, readonly string[]>> = {
  'Hot flashes':   ['Alcohol', 'Caffeine', 'Spicy food', 'Warm room / heavy bedding', 'Stress', 'Tight or synthetic clothing', 'Smoking'],
  'Night sweats':  ['Alcohol', 'Caffeine', 'Spicy food', 'Warm room / heavy bedding', 'Stress', 'Tight or synthetic clothing', 'Smoking'],
  'Sleep problems':['Late exercise', 'Heavy meal late at night', 'High-carb dinner', 'Skipping meals', 'Screen time before bed', 'Stress', 'Alcohol', 'Caffeine'],
  'Mood swings':   ['High caffeine', 'Alcohol', 'Poor sleep', 'Skipped meals / blood sugar dip', 'Stress event', 'Lack of exercise', 'PMS-like cycle patterns'],
  'Anxiety':       ['High caffeine', 'Alcohol', 'Poor sleep', 'Skipped meals / blood sugar dip', 'Stress event', 'Lack of exercise', 'PMS-like cycle patterns'],
  'Brain fog':     ['Poor sleep', 'Alcohol', 'Dehydration', 'High sugar / processed food', 'Stress', 'Sedentary day'],
  'Low libido':    ['Vaginal discomfort', 'Poor sleep', 'Stress & mental overload', 'Low energy / fatigue', 'Relationship / emotional disconnect', 'Mood changes', 'Medications'],
} as const;

export function getTriggersForSymptom(name: string): readonly string[] {
  return SYMPTOM_TRIGGERS[name] ?? [];
}

/** Timing options for "when did this happen" — aligned with web app. */
export type TimeSelection = 'now' | 'earlier-today' | 'yesterday';
