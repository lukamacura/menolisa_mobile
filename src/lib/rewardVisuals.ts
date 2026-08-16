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
  /** The badge's own colour when unlocked. Always a 6-digit hex. */
  tint: string;
};

/**
 * One hue per badge, walked around the colour wheel rather than picked from the
 * brand palette. A grid of eighteen medals in four shades of coral reads as one
 * repeated sticker; distinct hues let her recognise a badge before she reads it.
 * Warm reds run into pinks, then purples, blues, teals, greens and back to gold.
 */
const VISUALS: Record<string, BadgeVisual> = {
  wildfire: { icon: 'flame', tint: '#F4623A' },
  attuned: { icon: 'pulse', tint: '#E5484D' },
  devoted: { icon: 'calendar', tint: '#F47C97' },
  strong: { icon: 'barbell', tint: '#D6336C' },
  habitual: { icon: 'repeat', tint: '#B455B0' },
  sage: { icon: 'sparkles', tint: '#8B5CF6' },
  overachiever: { icon: 'rocket', tint: '#5B4BD6' },
  graduate: { icon: 'ribbon', tint: '#2E2A4D' },
  hydrated: { icon: 'water', tint: '#2E9BF0' },
  comeback: { icon: 'refresh-circle', tint: '#0EA5C9' },
  serene: { icon: 'leaf', tint: '#17C3B2' },
  consistent: { icon: 'trending-up', tint: '#0D8A7D' },
  flawless: { icon: 'checkmark-circle', tint: '#12B76A' },
  nourished: { icon: 'nutrition', tint: '#7CB342' },
  mindful: { icon: 'happy', tint: '#F2B705' },
  century: { icon: 'medal', tint: '#B08A2E' },
  protein: { icon: 'egg', tint: '#C97B30' },
  weekender: { icon: 'sunny', tint: '#FF9F1C' },
};

const FALLBACK: BadgeVisual = { icon: 'trophy', tint: colors.primary };

export function badgeVisual(familyId: string): BadgeVisual {
  return VISUALS[familyId] ?? FALLBACK;
}

/** Muted styling for a badge she has not unlocked yet. */
export const LOCKED_VISUAL: BadgeVisual = {
  icon: 'lock-closed',
  tint: colors.textMuted,
};

/**
 * `#RRGGBB` + alpha → `rgba(...)`. Never build an 8-digit hex instead: Android
 * renders those gray.
 */
export function badgeTint(hex: string, alpha: number): string {
  const value = parseInt(hex.replace('#', ''), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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
