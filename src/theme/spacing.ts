export const spacing = {
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
  "7xl": 80,
  "8xl": 96,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

type ShadowToken = {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
};

export const shadows: Record<"sm" | "md" | "lg" | "xl", ShadowToken> = {
  sm: {
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  md: {
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  lg: {
    shadowColor: "#000000",
    shadowOpacity: 0.15,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  xl: {
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 20 },
    elevation: 16,
  },
} as const;
