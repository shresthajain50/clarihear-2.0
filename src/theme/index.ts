// ============================================================
//  theme/index.ts  —  ClariHear 2.0 Design System
//  All colors, typography, spacing, and shadow tokens.
// ============================================================

import {Platform, StyleSheet} from 'react-native';

// ── Color Palette ─────────────────────────────────────────────
export const Colors = {
  // Background layers (darkest → lightest)
  bg0: '#050810',   // deepest background
  bg1: '#0A0F1C',   // main background
  bg2: '#111827',   // card background
  bg3: '#1C2539',   // elevated card

  // Glass overlay (used for cards with backdrop blur)
  glass:       'rgba(255,255,255,0.05)',
  glassBorder: 'rgba(255,255,255,0.10)',

  // Primary accent — electric teal
  primary:      '#00D4FF',
  primaryDim:   '#0099BB',
  primaryGlow:  'rgba(0,212,255,0.25)',
  primaryGlow2: 'rgba(0,212,255,0.08)',

  // Secondary accent — warm violet
  secondary:    '#7B61FF',
  secondaryDim: '#5B44D4',
  secondaryGlow:'rgba(123,97,255,0.25)',

  // Semantic colours
  success:  '#22D3A5',
  warning:  '#FFB347',
  danger:   '#FF5E7D',

  // Text hierarchy
  textPrimary:   '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted:     '#475569',
  textAccent:    '#00D4FF',

  // EQ band colours (one per frequency — rainbow progression)
  eq: [
    '#FF6B6B',   // 250 Hz  — red
    '#FF9F40',   // 500 Hz  — orange
    '#FFD93D',   // 1 kHz   — yellow
    '#6BCB77',   // 2 kHz   — green
    '#4D96FF',   // 4 kHz   — blue
    '#C77DFF',   // 8 kHz   — purple
  ] as const,
} as const;

// ── Typography ────────────────────────────────────────────────
export const Fonts = {
  // Font families — must be linked in Xcode/Android
  // Falls back to system fonts if not present
  regular:   Platform.OS === 'ios' ? 'SF Pro Text'   : 'Roboto',
  medium:    Platform.OS === 'ios' ? 'SF Pro Text'   : 'Roboto-Medium',
  bold:      Platform.OS === 'ios' ? 'SF Pro Display': 'Roboto-Bold',
  mono:      Platform.OS === 'ios' ? 'SF Mono'       : 'monospace',

  sizes: {
    xs:   11,
    sm:   13,
    base: 15,
    md:   17,
    lg:   20,
    xl:   24,
    xxl:  32,
    hero: 48,
  },
} as const;

// ── Spacing ───────────────────────────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// ── Border radii ──────────────────────────────────────────────
export const Radius = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

// ── Shadows (iOS) / Elevation (Android) ───────────────────────
export const Shadow = {
  card: Platform.select({
    ios: {
      shadowColor: Colors.primary,
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.15,
      shadowRadius: 16,
    },
    android: {elevation: 8},
  }),
  glow: Platform.select({
    ios: {
      shadowColor: Colors.primary,
      shadowOffset: {width: 0, height: 0},
      shadowOpacity: 0.6,
      shadowRadius: 24,
    },
    android: {elevation: 24},
  }),
} as const;

// ── Reusable style fragments ──────────────────────────────────
export const Styles = StyleSheet.create({
  // Glass card (used throughout the app)
  glassCard: {
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.lg,
  },

  // Screen container
  screen: {
    flex: 1,
    backgroundColor: Colors.bg1,
  },

  // Horizontal rule
  divider: {
    height: 1,
    backgroundColor: Colors.glassBorder,
    marginVertical: Spacing.md,
  },

  // Row flex
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Centre everything
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
