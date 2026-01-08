import { useMemo } from "react";
import { useCompanionPresence, CompanionMood } from "@/contexts/CompanionPresenceContext";

export interface AuraColors {
  primaryAura: string;        // HSL color for primary glow effects
  secondaryAura: string;      // Complementary color
  glowShadow: string;         // Box-shadow value for glowing elements
  gradientOverlay: string;    // CSS gradient for subtle overlays
  particleColor: string;      // Color for ambient particles
  navGlow: string;            // Glow for navigation indicator
}

// Mood-based saturation and lightness adjustments
const MOOD_MODIFIERS: Record<CompanionMood, { saturation: number; lightness: number; glowIntensity: number }> = {
  joyful: { saturation: 80, lightness: 65, glowIntensity: 0.4 },
  content: { saturation: 60, lightness: 55, glowIntensity: 0.3 },
  neutral: { saturation: 40, lightness: 50, glowIntensity: 0.2 },
  reserved: { saturation: 25, lightness: 45, glowIntensity: 0.15 },
  quiet: { saturation: 15, lightness: 40, glowIntensity: 0.1 },
  dormant: { saturation: 5, lightness: 30, glowIntensity: 0 },
};

export const useCompanionAuraColors = (): AuraColors => {
  const { presence } = useCompanionPresence();
  
  return useMemo(() => {
    const { auraHue, mood, auraOpacity } = presence;
    const modifiers = MOOD_MODIFIERS[mood];
    
    const primaryAura = `hsl(${auraHue}, ${modifiers.saturation}%, ${modifiers.lightness}%)`;
    const secondaryAura = `hsl(${(auraHue + 30) % 360}, ${modifiers.saturation * 0.8}%, ${modifiers.lightness}%)`;
    
    const glowShadow = modifiers.glowIntensity > 0
      ? `0 0 20px hsla(${auraHue}, ${modifiers.saturation}%, ${modifiers.lightness}%, ${modifiers.glowIntensity}), 
         0 0 40px hsla(${auraHue}, ${modifiers.saturation}%, ${modifiers.lightness}%, ${modifiers.glowIntensity * 0.5})`
      : 'none';
    
    const gradientOverlay = `radial-gradient(
      ellipse at 50% 30%,
      hsla(${auraHue}, ${modifiers.saturation}%, ${modifiers.lightness}%, ${auraOpacity}),
      transparent 70%
    )`;
    
    const particleColor = `hsla(${auraHue}, ${modifiers.saturation}%, ${modifiers.lightness + 15}%, 0.8)`;
    
    const navGlow = modifiers.glowIntensity > 0
      ? `0 0 12px hsla(${auraHue}, ${modifiers.saturation}%, ${modifiers.lightness}%, ${modifiers.glowIntensity * 0.8})`
      : 'none';
    
    return {
      primaryAura,
      secondaryAura,
      glowShadow,
      gradientOverlay,
      particleColor,
      navGlow,
    };
  }, [presence]);
};
