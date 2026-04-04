// Evolution Theme Configuration
// Stage-specific themes based on companion's core_element

export type ParticleStyle = 'sparks' | 'embers' | 'stardust' | 'bubbles' | 'leaves';

export interface EvoTheme {
  name: string;
  glowA: string;           // Primary glow color (HSL)
  glowB: string;           // Secondary glow color (HSL)
  particleStyle: ParticleStyle;
  confettiColors: string[];
  confettiSpread: number;
  confettiGravity: number;
  confettiParticleCount: number;
  flashCore: string;
  flashGlow: string;
  glowStrength: number;
  revealBurstColor: string;
}

export const ELEMENT_THEMES: Record<string, EvoTheme> = {
  fire: {
    name: "Inferno",
    glowA: "20, 100%, 55%",
    glowB: "35, 100%, 60%",
    particleStyle: "embers",
    confettiColors: ["#FF6A3D", "#FF9F1C", "#FFD700", "#FF4500"],
    confettiSpread: 100,
    confettiGravity: 0.8,
    confettiParticleCount: 150,
    flashCore: "rgba(255, 243, 214, 0.95)",
    flashGlow: "hsla(24, 100%, 58%, 0.8)",
    glowStrength: 1,
    revealBurstColor: "hsla(20, 100%, 55%, 0.8)",
  },
  water: {
    name: "Tidal",
    glowA: "195, 90%, 55%",
    glowB: "210, 85%, 50%",
    particleStyle: "bubbles",
    confettiColors: ["#4FC3F7", "#29B6F6", "#81D4FA", "#B3E5FC"],
    confettiSpread: 140,
    confettiGravity: 0.4,
    confettiParticleCount: 120,
    flashCore: "rgba(235, 250, 255, 0.95)",
    flashGlow: "hsla(197, 96%, 60%, 0.76)",
    glowStrength: 0.88,
    revealBurstColor: "hsla(200, 90%, 60%, 0.68)",
  },
  earth: {
    name: "Terran",
    glowA: "25, 40%, 45%",
    glowB: "100, 50%, 45%",
    particleStyle: "leaves",
    confettiColors: ["#795548", "#8BC34A", "#4CAF50", "#A1887F"],
    confettiSpread: 90,
    confettiGravity: 0.9,
    confettiParticleCount: 130,
    flashCore: "rgba(255, 248, 230, 0.9)",
    flashGlow: "hsla(88, 52%, 45%, 0.72)",
    glowStrength: 0.82,
    revealBurstColor: "hsla(94, 45%, 44%, 0.62)",
  },
  air: {
    name: "Zephyr",
    glowA: "200, 80%, 80%",
    glowB: "190, 70%, 90%",
    particleStyle: "stardust",
    confettiColors: ["#E3F2FD", "#BBDEFB", "#90CAF9", "#E8F5E9"],
    confettiSpread: 180,
    confettiGravity: 0.3,
    confettiParticleCount: 100,
    flashCore: "rgba(255, 255, 255, 0.96)",
    flashGlow: "hsla(198, 86%, 82%, 0.74)",
    glowStrength: 0.76,
    revealBurstColor: "hsla(192, 75%, 86%, 0.62)",
  },
  lightning: {
    name: "Storm",
    glowA: "50, 100%, 55%",
    glowB: "270, 70%, 60%",
    particleStyle: "sparks",
    confettiColors: ["#FFD600", "#FFFF00", "#7C4DFF", "#B388FF"],
    confettiSpread: 120,
    confettiGravity: 1.0,
    confettiParticleCount: 160,
    flashCore: "rgba(255, 252, 214, 0.98)",
    flashGlow: "hsla(52, 100%, 58%, 0.82)",
    glowStrength: 1.06,
    revealBurstColor: "hsla(47, 100%, 55%, 0.84)",
  },
  ice: {
    name: "Frost",
    glowA: "185, 70%, 70%",
    glowB: "190, 50%, 92%",
    particleStyle: "stardust",
    confettiColors: ["#80DEEA", "#B2EBF2", "#E0F7FA", "#FFFFFF"],
    confettiSpread: 100,
    confettiGravity: 0.5,
    confettiParticleCount: 130,
    flashCore: "rgba(244, 252, 255, 0.96)",
    flashGlow: "hsla(189, 72%, 80%, 0.76)",
    glowStrength: 0.9,
    revealBurstColor: "hsla(190, 72%, 78%, 0.7)",
  },
  nature: {
    name: "Verdant",
    glowA: "120, 50%, 50%",
    glowB: "100, 50%, 70%",
    particleStyle: "leaves",
    confettiColors: ["#66BB6A", "#81C784", "#A5D6A7", "#DCEDC8"],
    confettiSpread: 110,
    confettiGravity: 0.6,
    confettiParticleCount: 140,
    flashCore: "rgba(246, 255, 240, 0.94)",
    flashGlow: "hsla(118, 55%, 58%, 0.72)",
    glowStrength: 0.86,
    revealBurstColor: "hsla(118, 48%, 52%, 0.68)",
  },
  light: {
    name: "Radiant",
    glowA: "50, 100%, 75%",
    glowB: "0, 0%, 100%",
    particleStyle: "stardust",
    confettiColors: ["#FFF59D", "#FFEE58", "#FFFFFF", "#FFF9C4"],
    confettiSpread: 150,
    confettiGravity: 0.4,
    confettiParticleCount: 160,
    flashCore: "rgba(255, 255, 249, 1)",
    flashGlow: "hsla(52, 100%, 82%, 0.84)",
    glowStrength: 1.1,
    revealBurstColor: "hsla(50, 100%, 78%, 0.8)",
  },
  shadow: {
    name: "Umbral",
    glowA: "270, 50%, 50%",
    glowB: "260, 60%, 25%",
    particleStyle: "sparks",
    confettiColors: ["#7E57C2", "#5E35B1", "#9575CD", "#D1C4E9"],
    confettiSpread: 80,
    confettiGravity: 0.7,
    confettiParticleCount: 120,
    flashCore: "rgba(239, 228, 255, 0.94)",
    flashGlow: "hsla(268, 68%, 58%, 0.78)",
    glowStrength: 0.92,
    revealBurstColor: "hsla(266, 64%, 54%, 0.72)",
  },
  cosmic: {
    name: "Celestial",
    glowA: "285, 60%, 55%",
    glowB: "230, 50%, 40%",
    particleStyle: "stardust",
    confettiColors: ["#AB47BC", "#CE93D8", "#5C6BC0", "#7986CB"],
    confettiSpread: 160,
    confettiGravity: 0.35,
    confettiParticleCount: 180,
    flashCore: "rgba(248, 240, 255, 0.96)",
    flashGlow: "hsla(282, 72%, 62%, 0.8)",
    glowStrength: 1.04,
    revealBurstColor: "hsla(276, 70%, 58%, 0.76)",
  },
};

// First evolution (hatching) theme
export const HATCH_THEME: EvoTheme = {
  name: "Hatch",
  glowA: "45, 100%, 60%",
  glowB: "35, 100%, 70%",
  particleStyle: "stardust",
  confettiColors: ["#FFD700", "#FFA500", "#FFFACD", "#FFE4B5", "#F0E68C"],
  confettiSpread: 140,
  confettiGravity: 0.6,
  confettiParticleCount: 200,
  flashCore: "rgba(255, 252, 220, 0.98)",
  flashGlow: "hsla(43, 100%, 62%, 0.82)",
  glowStrength: 1.08,
  revealBurstColor: "hsla(42, 100%, 64%, 0.82)",
};

// Default fallback theme (cosmic/purple)
export const DEFAULT_THEME: EvoTheme = {
  name: "Cosmic",
  glowA: "270, 70%, 55%",
  glowB: "280, 80%, 65%",
  particleStyle: "stardust",
  confettiColors: ["#A76CFF", "#C084FC", "#E879F9", "#FFD700"],
  confettiSpread: 120,
  confettiGravity: 0.6,
  confettiParticleCount: 150,
  flashCore: "rgba(245, 238, 255, 0.95)",
  flashGlow: "hsla(274, 78%, 64%, 0.78)",
  glowStrength: 0.96,
  revealBurstColor: "hsla(280, 80%, 64%, 0.74)",
};

export const getEvolutionTheme = (element?: string, isFirstEvolution?: boolean): EvoTheme => {
  if (isFirstEvolution) {
    return HATCH_THEME;
  }
  
  const normalizedElement = element?.trim().toLowerCase();

  if (normalizedElement && ELEMENT_THEMES[normalizedElement]) {
    return ELEMENT_THEMES[normalizedElement];
  }
  
  return DEFAULT_THEME;
};
