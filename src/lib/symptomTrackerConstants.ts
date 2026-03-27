/**
 * Per-symptom triggers — canonical copy in docs/symptoms.md.
 * Empty array = log without trigger chips (mobile flow skips trigger step when none).
 */
export const SYMPTOM_TRIGGERS: Readonly<Record<string, readonly string[]>> = {
  'Hot flashes': [
    'Alcohol',
    'Caffeine',
    'Spicy food',
    'Warm room / heavy bedding',
    'Stress',
    'Tight or synthetic clothing',
    'Smoking',
  ],
  'Night sweats': [
    'Alcohol',
    'Caffeine',
    'Spicy food',
    'Warm room / heavy bedding',
    'Stress',
    'Tight or synthetic clothing',
    'Smoking',
  ],
  Palpitations: [],
  'Sleep problems': [
    'Late exercise',
    'Heavy meal late at night',
    'High-carb dinner',
    'Skipping meals',
    'Screen time before bed',
    'Stress',
    'Alcohol',
    'Caffeine',
  ],
  'Mood swings': [
    'High caffeine',
    'Alcohol',
    'Poor sleep (night before)',
    'Skipped meals / blood sugar dip',
    'Stress event',
    'Lack of exercise',
    'PMS-like cycle patterns (perimenopause)',
  ],
  Irritability: [],
  Anxiety: [
    'High caffeine',
    'Alcohol',
    'Poor sleep (night before)',
    'Skipped meals / blood sugar dip',
    'Stress event',
    'Lack of exercise',
    'PMS-like cycle patterns (perimenopause)',
  ],
  'Brain fog': [
    'Poor sleep (night before)',
    'Alcohol',
    'Dehydration',
    'High sugar / processed food',
    'Stress',
    'Sedentary day',
  ],
  Fatigue: [],
  'Low libido': [
    'Vaginal discomfort',
    'Poor sleep',
    'Stress & mental overload',
    'Low energy / fatigue',
    'Relationship / emotional disconnect',
    'Mood changes',
    'Medications',
  ],
  'Vaginal discomfort': [],
  'Bladder problems': [],
  'Joint pain': [],
  'Weight gain': [],
} as const;

export function getTriggersForSymptom(name: string): readonly string[] {
  if (name === "Insomnia") {
    return SYMPTOM_TRIGGERS["Sleep problems"];
  }
  const list = SYMPTOM_TRIGGERS[name as keyof typeof SYMPTOM_TRIGGERS];
  return list ?? [];
}

/** Timing options for "when did this happen" — aligned with web app. */
export type TimeSelection = 'now' | 'earlier-today' | 'yesterday';
