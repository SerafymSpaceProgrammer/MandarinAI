export const duration = {
  micro: 150,
  standard: 200,
  emphasis: 300,
} as const;

export const easingBezier = {
  easeOut: [0, 0, 0.58, 1] as const,
  emphasized: [0.16, 1, 0.3, 1] as const,
} as const;
