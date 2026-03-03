/**
 * Maps symptom names to illustration assets in assets/symptoms/.
 * Filenames use snake_case (e.g. hot_flashes.png, night_sweats.png).
 * If no asset exists for a symptom (e.g. custom or "Good Day"), fallback to Ionicons via getSymptomIconName.
 */
import type { ImageSourcePropType } from 'react-native';
import { getSymptomIconName } from './symptomIconMapping';

/** Known illustration assets — add new PNGs under assets/symptoms/ with snake_case names. */
const SYMPTOM_IMAGES: Record<string, ImageSourcePropType> = {
  anxiety: require('../../assets/symptoms/anxiety.png'),
  bloating: require('../../assets/symptoms/bloating.png'),
  brain_fog: require('../../assets/symptoms/brain_fog.png'),
  fatigue: require('../../assets/symptoms/fatigue.png'),
  headaches: require('../../assets/symptoms/headaches.png'),
  hot_flashes: require('../../assets/symptoms/hot_flashes.png'),
  insomnia: require('../../assets/symptoms/insomnia.png'),
  joint_pain: require('../../assets/symptoms/joint_pain.png'),
  low_libido: require('../../assets/symptoms/low_libido.png'),
  mood_swings: require('../../assets/symptoms/mood_swings.png'),
  night_sweats: require('../../assets/symptoms/night_sweats.png'),
  period: require('../../assets/symptoms/period.png'),
  weight_gain: require('../../assets/symptoms/weight_gain.png'),
};

function nameToSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export type SymptomIllustrationResult =
  | { type: 'image'; source: ImageSourcePropType }
  | { type: 'icon'; iconName: string };

/**
 * Returns either an image source for the symptom illustration or an icon name for fallback.
 * Use when rendering the symptom grid; fallback to Ionicons for custom/missing assets.
 */
export function getSymptomIllustration(
  symptomName: string,
  apiIcon?: string | null
): SymptomIllustrationResult {
  const slug = nameToSlug(symptomName);
  const source = SYMPTOM_IMAGES[slug];
  if (source) {
    return { type: 'image', source };
  }
  return {
    type: 'icon',
    iconName: getSymptomIconName(symptomName, apiIcon),
  };
}
