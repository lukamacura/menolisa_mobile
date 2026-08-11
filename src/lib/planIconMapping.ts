import type { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Nutrition row id → icon.
 *
 * Decoration only. Labels, groups and targets always come from the API response
 * — these ids have changed once already and the icons are the one thing safe to
 * hold locally. An unmapped id falls back rather than rendering nothing, so a
 * new catalog row never ships a hole in the list.
 *
 * Chosen to echo the funnel's icons (`NUTRITION_GROUPS` in the web app's
 * `/register` page), so a row looks the same before and after she pays.
 */
const NUTRITION_ICONS: Record<string, IconName> = {
  protein_25_30g: 'restaurant',
  healthy_fats: 'water',
  high_fiber: 'leaf',
  low_gi_fruit: 'nutrition',
  post_meal_walk: 'walk',
  fast_12h: 'hourglass',
  gap_5h: 'timer',
  no_snacking: 'ban',
  water_6: 'water',
  supplements: 'medkit',
};

const DEFAULT_NUTRITION_ICON: IconName = 'ellipse-outline';

export function nutritionIcon(id: string): IconName {
  return NUTRITION_ICONS[id] ?? DEFAULT_NUTRITION_ICON;
}
