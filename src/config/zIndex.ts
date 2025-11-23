/**
 * Centralized z-index configuration to prevent stacking order conflicts
 * Higher values appear above lower values
 */
export const Z_INDEX = {
  // Base layers
  BACKGROUND_IMAGE: 0,
  BASE_CONTENT: 10,
  
  // Navigation
  BOTTOM_NAV: 50,
  
  // UI Components
  TOAST: 100,
  SELECT_DROPDOWN: 100,
  
  // Overlays and modals (in order of priority)
  EVOLUTION_OVERLAY: 9997,
  WALKTHROUGH_OVERLAY: 9998,
  COMPANION_EVOLUTION: 9999,
  TUTORIAL_MODAL: 10000,
  COMPLETION_MODAL: 10001,
  EVOLUTION_DISMISS_BUTTON: 10002,
} as const;

export type ZIndexKey = keyof typeof Z_INDEX;