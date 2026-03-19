export const motion = {
  duration: {
    fast: 120,
    base: 220,
    slow: 360,
    entrance: 420,
  },
  pressScale: {
    default: 0.98,
    subtle: 0.985,
  },
  spring: {
    pressIn: {
      damping: 22,
      stiffness: 360,
      mass: 0.6,
    },
    pressOut: {
      damping: 18,
      stiffness: 280,
      mass: 0.7,
    },
  },
} as const;
