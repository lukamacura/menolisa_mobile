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

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },
  glowPrimary: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  /** Bottom shadow for primary buttons (solid, slightly extruded look) */
  buttonPrimary: {
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 4,
  },
};

export const typography = {
  family: {
    light: 'Poppins_300Light',
    regular: 'Poppins_400Regular',
    medium: 'Poppins_500Medium',
    semibold: 'Poppins_600SemiBold',
    bold: 'Poppins_700Bold',
  },
};

