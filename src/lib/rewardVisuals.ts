/**
 * How each achievement looks. The only part of the reward system this app owns.
 *
 * Everything else — targets, XP, which tiers are earned — comes from
 * `GET /api/rewards`. Keyed by family id so a badge added on the server renders
 * immediately with the fallback below, rather than crashing a grid.
 */

import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/tokens';

export type BadgeVisual = {
  icon: keyof typeof Ionicons.glyphMap;
  /** The badge's own colour when unlocked. */
  tint: string;
  /** A soft fill of the same hue. Always rgba — Android renders 8-digit hex gray. */
  tintSoft: string;
};

const VISUALS: Record<string, BadgeVisual> = {
  wildfire: { icon: 'flame', tint: '#F4623A', tintSoft: 'rgba(244, 98, 58, 0.14)' },
  sage: { icon: 'sparkles', tint: colors.lavender, tintSoft: 'rgba(139, 124, 246, 0.16)' },
  flawless: { icon: 'checkmark-circle', tint: colors.success, tintSoft: 'rgba(34, 160, 107, 0.14)' },
  devoted: { icon: 'calendar', tint: colors.primary, tintSoft: 'rgba(244, 124, 151, 0.14)' },
  strong: { icon: 'barbell', tint: colors.primaryDark, tintSoft: 'rgba(217, 95, 126, 0.14)' },
  serene: { icon: 'leaf', tint: colors.blue, tintSoft: 'rgba(58, 191, 163, 0.16)' },
  nourished: { icon: 'nutrition', tint: '#5BA84F', tintSoft: 'rgba(91, 168, 79, 0.14)' },
  hydrated: { icon: 'water', tint: colors.info, tintSoft: 'rgba(75, 141, 248, 0.14)' },
  protein: { icon: 'egg', tint: colors.gold, tintSoft: 'rgba(255, 179, 138, 0.26)' },
  habitual: { icon: 'repeat', tint: '#C77DBB', tintSoft: 'rgba(199, 125, 187, 0.16)' },
  mindful: { icon: 'happy', tint: colors.warning, tintSoft: 'rgba(217, 138, 31, 0.14)' },
  attuned: { icon: 'pulse', tint: colors.danger, tintSoft: 'rgba(200, 58, 84, 0.12)' },
  graduate: { icon: 'ribbon', tint: colors.navy, tintSoft: 'rgba(46, 42, 77, 0.12)' },
  consistent: { icon: 'trending-up', tint: '#3F8F7A', tintSoft: 'rgba(63, 143, 122, 0.14)' },
  weekender: { icon: 'sunny', tint: '#E8A33D', tintSoft: 'rgba(232, 163, 61, 0.16)' },
  century: { icon: 'medal', tint: '#8C6D3F', tintSoft: 'rgba(140, 109, 63, 0.14)' },
  overachiever: { icon: 'rocket', tint: '#7A5AF5', tintSoft: 'rgba(122, 90, 245, 0.14)' },
  comeback: { icon: 'refresh-circle', tint: '#2E8FA8', tintSoft: 'rgba(46, 143, 168, 0.14)' },
};

const FALLBACK: BadgeVisual = {
  icon: 'trophy',
  tint: colors.primary,
  tintSoft: 'rgba(244, 124, 151, 0.14)',
};

export function badgeVisual(familyId: string): BadgeVisual {
  return VISUALS[familyId] ?? FALLBACK;
}

/** Muted styling for a badge she has not unlocked yet. */
export const LOCKED_VISUAL: BadgeVisual = {
  icon: 'lock-closed',
  tint: colors.textMuted,
  tintSoft: 'rgba(107, 100, 124, 0.10)',
};

/**
 * What a tier is called. Duolingo numbers its badge levels; the same idea reads
 * warmer here with metal names, and it stops at the family's own ceiling so a
 * four-tier badge never claims a "Diamond" it doesn't have.
 */
const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Legendary'];

/** Name for tier `tier` (1-based) of a family with `maxTier` tiers. */
export function tierName(tier: number, maxTier: number): string {
  if (tier <= 0) return 'Locked';
  // Spread the names across however many tiers this family has, so the last
  // tier of every badge is the best-sounding one she can reach on it.
  const index = Math.round(((tier - 1) / Math.max(1, maxTier - 1)) * (TIER_NAMES.length - 1));
  return TIER_NAMES[Math.min(TIER_NAMES.length - 1, Math.max(0, index))];
}

/** "Level 3 of 8" — the honest, countable version, shown under the tier name. */
export function tierLabel(tier: number, maxTier: number): string {
  return `Level ${tier} of ${maxTier}`;
}
