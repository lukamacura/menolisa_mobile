/**
 * Maps symptom names (and icon strings from API) to Ionicons icon names
 * so logging and history use the same icons.
 */
const SYMPTOM_NAME_TO_ICON: Record<string, string> = {
  'Hot flashes': 'flame',
  'Night sweats': 'water',
  'Fatigue': 'flash',
  'Brain fog': 'bulb',
  'Mood swings': 'heart',
  'Anxiety': 'alert-circle',
  'Headaches': 'warning',
  'Joint pain': 'barbell',
  'Bloating': 'ellipse',
  'Insomnia': 'moon',
  'Weight gain': 'trending-up',
  'Low libido': 'heart-dislike',
  'Good Day': 'sunny',
  'Period': 'ellipse-outline',
};

/** Get Ionicons icon name for a symptom (by name or API icon string). */
export function getSymptomIconName(symptomName: string, apiIcon?: string | null): string {
  if (symptomName && SYMPTOM_NAME_TO_ICON[symptomName]) {
    return SYMPTOM_NAME_TO_ICON[symptomName];
  }
  if (apiIcon) {
    const normalized = apiIcon.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
    const byLucide: Record<string, string> = {
      'flame': 'flame',
      'droplet': 'water',
      'zap': 'flash',
      'brain': 'bulb',
      'heart': 'heart',
      'alert-circle': 'alert-circle',
      'alert-triangle': 'warning',
      'activity': 'barbell',
      'circle-dot': 'ellipse',
      'moon': 'moon',
      'trending-up': 'trending-up',
      'heart-off': 'heart-dislike',
      'sun': 'sunny',
    };
    if (byLucide[normalized]) return byLucide[normalized];
  }
  return 'medical';
}
