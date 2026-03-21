import { Platform } from 'react-native';

/** Warm yellow surface: semantic warnings and dashboard mood + insights strip below hero */
const WARM_YELLOW_SURFACE = '#FFF4E5';

export const colors = {
  // Brand core
  primary: '#F47C97',
  primaryLight: '#F9B8C8',
  primaryDark: '#D95F7E',

  // Secondary + accents
  navy: '#2E2A4D',
  blue: '#3ABFA3',
  blueLight: '#BDEEE4',
  gold: '#FFB38A',
  /** Dashboard: mood history + Lisa insights area (same hue as warningBg / WARM_YELLOW_SURFACE) */
  moodSectionBackground: WARM_YELLOW_SURFACE,
  /** Gold tint for mood history card border (pairs with moodSectionBackground) */
  moodSectionWaveMid: 'rgba(255, 179, 138, 0.32)',
  lavender: '#8B7CF6',
  plumSoft: '#EAE8F5',
  /** Referral / Invite friends – visible orange */
  orange: '#E85D04',
  orangeLight: 'rgba(232, 93, 4, 0.12)',

  /** Settings row tints (semantic backgrounds for action rows) */
  rowNavyBg: 'rgba(46, 42, 77, 0.14)',
  rowBlueBg: 'rgba(58, 191, 163, 0.18)',
  rowGoldBg: 'rgba(255, 179, 138, 0.30)',
  rowRedBg: 'rgba(220, 38, 38, 0.10)',

  // UI surfaces + text (off-whites: warm blush + cool lavender — not pure #fff)
  /** App canvas; pairs with navy/plum/blue and coral primary */
  background: '#F9F7FB',
  /** Frosted panels on top of background */
  surface: 'rgba(255, 252, 254, 0.94)',
  /** Slightly warmer lift (chips, avatar wells) */
  surfaceElevated: '#FFF6F8',
  /** Cards / bubbles: soft warm white vs canvas */
  card: '#FFFBFD',
  /**
   * Notification list (in-app): use opaque fills. Android often composites
   * translucent rgba() View backgrounds as flat gray.
   */
  notificationUnreadBg: '#FDF5F8',
  notificationIconPrimarySoft: '#FCE8EF',
  notificationIconGoldSoft: '#FFF1E8',
  text: '#1F1B2D',
  textMuted: '#6B647C',
  textInverse: '#FFFFFF',
  border: '#E8DDE3',
  borderStrong: '#DCCFD8',

  // Feedback / status
  danger: '#C83A54',
  dangerBg: '#FDECEF',
  warning: '#D98A1F',
  warningBg: WARM_YELLOW_SURFACE,
  success: '#22A06B',
  successBg: '#EAF8F1',
  info: '#4B8DF8',
  infoBg: '#EAF1FF',
};

/** Soft gradient used on Landing (and auth/quiz screens for consistency) */
export const landingGradient = ['#FAF8FB', '#F9F1F7', '#F3ECFA'] as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
};

/** Minimum touch target for 40+ accessibility (iOS HIG / Material) */
export const minTouchTarget = 44;

/** react-native-web prefers boxShadow over shadow* props. */
const isWeb = Platform.OS === 'web';
export const shadows = {
  card: isWeb
    ? { boxShadow: '0 8px 18px rgba(0,0,0,0.08)' }
    : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
        elevation: 6,
      },
  glowPrimary: isWeb
    ? { boxShadow: `0 6px 16px ${colors.primary}2e` }
    : {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 6,
      },
  /** Bottom shadow for primary buttons (solid, slightly extruded look) */
  buttonPrimary: isWeb
    ? { boxShadow: `0 4px 2px ${colors.primaryDark}59` }
    : {
        shadowColor: colors.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 2,
        elevation: 4,
      },
};

/** Font families: Poppins (body/UI), Nunito (display/CTAs). Use via typography.presets for use-case-based styling. */
const family = {
  light: 'Poppins_300Light',
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

const display = {
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
} as const;

export const typography = {
  /** Body and UI text (Poppins) */
  family,
  /** Buttons, greetings, and prominent headings (Nunito). Use sentence case for buttons (no uppercase). */
  display,
  /**
   * Semantic presets by use case. Spread into StyleSheet text styles; set color in component.
   * - Body/paragraphs: body, bodySmall, bodyMedium
   * - Headings: heading1 (hero), heading2 (screen/section), heading3 (card title)
   * - Buttons: button, buttonSmall (sentence case)
   * - Labels & captions: label, caption
   */
  presets: {
    body: { fontFamily: family.regular, fontSize: 16, lineHeight: 24 },
    bodySmall: { fontFamily: family.regular, fontSize: 14, lineHeight: 22 },
    bodyMedium: { fontFamily: family.medium, fontSize: 16, lineHeight: 24 },
    caption: { fontFamily: family.regular, fontSize: 12, lineHeight: 18 },
    label: { fontFamily: family.medium, fontSize: 14, lineHeight: 20 },
    heading1: { fontFamily: display.bold, fontSize: 24, lineHeight: 32 },
    heading2: { fontFamily: display.semibold, fontSize: 20, lineHeight: 28 },
    heading3: { fontFamily: family.semibold, fontSize: 18, lineHeight: 26 },
    button: { fontFamily: display.semibold, fontSize: 17, lineHeight: 22 },
    buttonSmall: { fontFamily: display.semibold, fontSize: 14, lineHeight: 20 },
  } as const,
};

