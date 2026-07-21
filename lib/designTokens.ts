/**
 * MIZAN Design System Tokens
 * Centralized design definitions for colors, spacing, typography, and component constants.
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
};

export const typography = {
  fontFamilyBold: 'Cairo_700Bold',
  fontFamilySemiBold: 'Cairo_600SemiBold',
  fontFamilyRegular: 'Cairo_400Regular',
  sizes: {
    tiny: 9,
    caption: 11,
    bodySm: 13,
    body: 15,
    subtitle: 17,
    title: 20,
    largeTitle: 26,
    hero: 34,
  },
};

export const shadows = {
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  }),
};
