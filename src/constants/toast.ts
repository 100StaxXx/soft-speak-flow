export const MAX_TOAST_DURATION_MS = 2000;
export const TOAST_REMOVE_DELAY_MS = 1000;

export const clampToastDuration = (duration?: number) =>
  Math.min(duration ?? MAX_TOAST_DURATION_MS, MAX_TOAST_DURATION_MS);
