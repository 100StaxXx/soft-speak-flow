export const MOTION_EASE = {
  standard: [0.22, 1, 0.36, 1] as const,
  smooth: [0.4, 0, 0.2, 1] as const,
  ios: [0.25, 0.1, 0.25, 1] as const,
};

export const MOTION_DURATION = {
  instant: 0,
  quick: 0.16,
  medium: 0.22,
  page: 0.24,
  slow: 0.32,
  tabSwap: 0.2,
};

export const MOTION_SPRING = {
  gentle: { type: "spring" as const, stiffness: 220, damping: 24 },
  snappy: { type: "spring" as const, stiffness: 320, damping: 28 },
};
