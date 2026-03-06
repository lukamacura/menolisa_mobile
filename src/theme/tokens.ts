import { Platform } from 'react-native';

export const colors = {
  // Brand (soft coral/salmon)
  primary: '#ff8da1',
  primaryLight: '#ffb8c9',
  primaryDark: '#e67a8f',
  navy: '#1D3557',
  blue: '#65dbff',
  blueLight: '#a6eaff',
  gold: '#ffeb76',
  /** Referral / Invite friends – visible orange */
  orange: '#E85D04',
  orangeLight: 'rgba(232, 93, 4, 0.12)',

  /** Settings row tints (semantic backgrounds for action rows) */
  rowNavyBg: 'rgba(29, 53, 87, 0.14)',
  rowBlueBg: 'rgba(101, 219, 255, 0.18)',
  rowGoldBg: 'rgba(255, 235, 118, 0.32)',
  rowRedBg: 'rgba(220, 38, 38, 0.10)',

  // UI
  background: '#FFFFFF',
  surface: 'rgba(255, 255, 255, 0.92)',
  card: '#FFFFFF',
  text: '#1F2937',
  textMuted: '#6B7280',
  border: 'rgba(17, 24, 39, 0.10)',
  borderStrong: 'rgba(17, 24, 39, 0.14)',

  // Feedback
  danger: '#DC2626',
  dangerBg: 'rgba(220, 38, 38, 0.10)',
  warning: '#F97316',
  success: '#10B981',
};

/** Soft gradient used on Landing (and auth/quiz screens for consistency) */
export const landingGradient = ['#FDF8F9', '#F9F2F4', '#F5EDF0'] as const;

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

