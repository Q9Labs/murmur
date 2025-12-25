import colors from "../constants/theme-colors";

export const theme = {
  // Color Palette - Simplified and synced with theme-colors.js
  colors: {
    // Primary colors
    coral: colors.coral,
    coralLight: colors.primary.coralLight,
    coralMuted: colors.primary.coralMuted,
    coralAccent: colors.primary.coralAccent,
    coralBorder: colors.primary.coralBorder,

    // Gold/Orange
    gold: colors.gold,
    goldMuted: colors.glass.gold,

    // Red
    red: colors.status.error,
    redLight: colors.status.errorLight,

    // Text colors
    text: {
      primary: colors.ink.DEFAULT,
      secondary: colors.ink.secondary,
      muted: colors.ink.muted,
      light: colors.ink.light,
    },

    // Background & Surface
    white: colors.white.full,
    whiteTransparent: colors.white,

    // Glass backgrounds
    glass: colors.glass,

    // Pastels
    pastel: {
      cream: colors.bg.cream,
      butter: colors.peach,
      mint: colors.bg.mint,
    },

    // Status/Error
    error: colors.status.error,
    errorBackground: colors.status.errorBackground,
    errorLight: colors.status.errorLight,
    errorBorder: colors.status.errorBorder,
  },

  // Gradient Configurations
  gradients: {
    // Main background gradient
    background: {
      colors: ["#FFFBF7", "#FFE19C", "#EDFFD9"] as const,
      locations: [0, 0.5, 1] as const,
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
    },

    // Primary button gradient
    button: {
      primary: {
        colors: ["#FF784F", "#DB9D47"] as const,
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
      },
      secondary: {
        colors: ["#FFFFFF", "#FFF8F0"] as const,
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
      },
      microphone: {
        idle: ["#FF784F", "#DB9D47"] as const,
        active: ["#FF784F", "#FF5733"] as const,
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
      },
    },

    // Overlay gradients
    overlay: {
      translationCard: {
        colors: [
          "rgba(255, 120, 79, 0.08)",
          "rgba(219, 157, 71, 0.08)",
        ] as const,
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
      },
      bottomFade: {
        colors: ["transparent", "rgba(255, 251, 247, 0.9)", "#FFFBF7"] as const,
        locations: [0, 0.4, 1] as const,
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
      },
      buttonFade: {
        colors: ["transparent", "#FFFBF7"] as const,
        locations: [0, 0.3] as const,
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
      },
    },
  },

  // Typography
  typography: {
    fontFamily: {
      mono: "Space Mono",
    },
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      "2xl": 24,
      "3xl": 28,
      "4xl": 32,
      "5xl": 40,
    },
    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.6,
      loose: 1.8,
    },
  },

  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    "2xl": 24,
    "3xl": 32,
    "4xl": 40,
    "5xl": 48,
    "6xl": 64,
  },

  // Border Radius
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    "2xl": 24,
    "3xl": 32,
    full: 9999,
  },

  // Shadow/Elevation
  shadow: {
    soft: {
      shadowColor: "#FF784F",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 2,
    },
    default: {
      shadowColor: "#FF784F",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    elevated: {
      shadowColor: "#FF784F",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 6,
    },
    highElevated: {
      shadowColor: "#FF784F",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 8,
    },
    microphone: {
      idle: {
        shadowColor: "#FF784F",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
      },
      active: {
        shadowColor: "#FF784F",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 8,
      },
    },
  },

  // Animation Durations (in milliseconds)
  animation: {
    fast: 200,
    default: 300,
    slow: 400,
    verySlow: 500,
    glacial: 600,
  },

  // Spring Configuration for Reanimated
  spring: {
    gentle: {
      damping: 12,
      stiffness: 180,
    },
    default: {
      damping: 15,
      stiffness: 200,
    },
    bouncy: {
      damping: 10,
      stiffness: 250,
    },
  },

  // Dot Indicator Sizes
  dot: {
    small: 8,
    medium: 12,
    large: 16,
  },

  // Button Size Configurations
  button: {
    sizes: {
      sm: {
        height: 40,
        paddingHorizontal: 16,
        fontSize: 14,
      },
      md: {
        height: 48,
        paddingHorizontal: 24,
        fontSize: 16,
      },
      lg: {
        height: 56,
        paddingHorizontal: 32,
        fontSize: 18,
      },
    },
  },

  // Icon Button Sizes
  iconButton: {
    sizes: {
      sm: {
        container: 36,
        icon: 18,
      },
      md: {
        container: 44,
        icon: 22,
      },
      lg: {
        container: 56,
        icon: 26,
      },
    },
    borderRadius: 12,
  },

  // Language Card Configuration
  languageCard: {
    padding: 16,
    borderRadius: 16,
    flagContainer: {
      size: 48,
      borderRadius: 12,
      fontSize: 24,
    },
    nameTextSize: 16,
    nativeNameTextSize: 14,
  },

  // Microphone Button Configuration
  micButton: {
    container: {
      width: 80,
      height: 80,
      borderRadius: 40,
    },
    ring: {
      size: 80,
      borderRadius: 40,
    },
    icon: 32,
  },

  // Onboarding Configuration
  onboarding: {
    iconCircle: {
      size: 96,
      borderRadius: 48,
    },
    iconSize: 48,
    titleFontSize: 32,
    descriptionFontSize: 16,
  },

  // Safe Area Defaults
  safeArea: {
    topPadding: 56, // pt-14 equivalent (14 * 4)
    sidePadding: 24, // px-6 equivalent (6 * 4)
    bottomPadding: 40, // pb-10 equivalent (10 * 4)
  },
} as const;

// Type exports for strict typing
export type Theme = typeof theme;
export type ColorKey = keyof typeof theme.colors;
export type GradientKey = keyof typeof theme.gradients;
