import { useMemo } from 'react';
import type { CompanionMoodState } from './useCompanionHealth';
import { useCompanionCareSignals, type CareSignals } from './useCompanionCareSignals';

interface VisualState {
  filter: string;
  animation: 'bounce' | 'pulse' | 'shiver' | 'droop' | 'dormant-breathe' | 'none';
  animationDuration: string;
  opacity: number;
  saturation: number;
  posture: 'confident' | 'relaxed' | 'neutral' | 'withdrawn' | 'curled' | 'sleeping';
  eyeContact: 'direct' | 'friendly' | 'occasional' | 'averted' | 'none' | 'closed';
}

/**
 * Maps companion health and HIDDEN care signals to visual CSS filters and animations.
 * Users see the effects but never the underlying numbers.
 */
export const useCompanionVisualState = (
  moodState: CompanionMoodState,
  hunger: number,
  happiness: number,
  isAlive: boolean,
  recoveryProgress: number
) => {
  const { care } = useCompanionCareSignals();

  const visualState = useMemo((): VisualState => {
    // Dead companion - grayscale and no animation
    if (!isAlive) {
      return {
        filter: 'grayscale(1) brightness(0.5)',
        animation: 'none',
        animationDuration: '0s',
        opacity: 0.7,
        saturation: 0,
        posture: 'curled',
        eyeContact: 'closed',
      };
    }

    // Dormant companion - sleeping state
    if (care.dormancy.isDormant) {
      return {
        filter: 'grayscale(0.5) brightness(0.6) blur(0.5px)',
        animation: 'dormant-breathe',
        animationDuration: '6s',
        opacity: 0.75,
        saturation: 0.5,
        posture: 'sleeping',
        eyeContact: 'closed',
      };
    }

    // Recovering from dormancy
    if (care.dormancy.recoveryDays > 0 && care.dormancy.recoveryDays < 5) {
      const recoveryPercent = care.dormancy.recoveryDays / 5;
      return {
        filter: `saturate(${0.5 + recoveryPercent * 0.5}) brightness(${0.8 + recoveryPercent * 0.2})`,
        animation: 'pulse',
        animationDuration: '4s',
        opacity: 0.8 + recoveryPercent * 0.2,
        saturation: 0.5 + recoveryPercent * 0.5,
        posture: recoveryPercent > 0.5 ? 'neutral' : 'withdrawn',
        eyeContact: recoveryPercent > 0.5 ? 'occasional' : 'averted',
      };
    }

    // Pre-dormancy visual decay (5-6 days inactive)
    if (care.dormancy.daysUntilDormancy !== null) {
      const daysUntil = care.dormancy.daysUntilDormancy;
      // Progressive fade: 2 days = slight, 1 day = more noticeable
      const fadeProgress = daysUntil === 1 ? 0.6 : 0.3;
      return {
        filter: `saturate(${0.7 - fadeProgress * 0.2}) brightness(${0.85 - fadeProgress * 0.1}) sepia(${fadeProgress * 0.15})`,
        animation: 'droop',
        animationDuration: '5s',
        opacity: 0.9 - fadeProgress * 0.1,
        saturation: 0.7 - fadeProgress * 0.2,
        posture: 'withdrawn',
        eyeContact: 'averted',
      };
    }

    // Care-based visual states (uses hidden signals)
    const overallCare = care.overallCare;

    // High care (0.8+) - Vibrant and engaged
    if (overallCare > 0.8) {
      return {
        filter: 'saturate(1.25) brightness(1.1)',
        animation: 'bounce',
        animationDuration: '2s',
        opacity: 1,
        saturation: 1.25,
        posture: 'confident',
        eyeContact: 'direct',
      };
    }

    // Good care (0.6-0.8) - Content and friendly
    if (overallCare > 0.6) {
      return {
        filter: 'saturate(1.1) brightness(1.05)',
        animation: 'pulse',
        animationDuration: '3s',
        opacity: 1,
        saturation: 1.1,
        posture: 'relaxed',
        eyeContact: 'friendly',
      };
    }

    // Moderate care (0.4-0.6) - Neutral
    if (overallCare > 0.4) {
      return {
        filter: 'saturate(0.95) brightness(0.98)',
        animation: 'pulse',
        animationDuration: '5s',
        opacity: 0.95,
        saturation: 0.95,
        posture: 'neutral',
        eyeContact: 'occasional',
      };
    }

    // Low care (0.2-0.4) - Withdrawn
    if (overallCare > 0.2) {
      return {
        filter: 'saturate(0.75) brightness(0.88) sepia(0.08)',
        animation: 'droop',
        animationDuration: '4s',
        opacity: 0.88,
        saturation: 0.75,
        posture: 'withdrawn',
        eyeContact: 'averted',
      };
    }

    // Critical care (<0.2) - Distressed
    return {
      filter: 'saturate(0.5) brightness(0.75) sepia(0.15)',
      animation: 'shiver',
      animationDuration: '0.4s',
      opacity: 0.75,
      saturation: 0.5,
      posture: 'curled',
      eyeContact: 'none',
    };
  }, [care, isAlive]);

  // Generate CSS styles object
  const cssStyles = useMemo((): React.CSSProperties => ({
    filter: visualState.filter,
    opacity: visualState.opacity,
    transition: 'filter 0.8s ease, opacity 0.8s ease',
  }), [visualState]);

  // Generate animation class name
  const animationClass = useMemo(() => {
    if (visualState.animation === 'none') return '';
    
    switch (visualState.animation) {
      case 'bounce':
        return 'animate-companion-bounce';
      case 'pulse':
        return 'animate-companion-pulse';
      case 'shiver':
        return 'animate-companion-shiver';
      case 'droop':
        return 'animate-companion-droop';
      case 'dormant-breathe':
        return 'animate-companion-dormant';
      default:
        return '';
    }
  }, [visualState.animation]);

  return {
    visualState,
    cssStyles,
    animationClass,
    care, // Return full care object to avoid duplicate hook calls
    overallCare: care.overallCare,
    evolutionPath: care.evolutionPath,
    dialogueTone: care.dialogueTone,
    isDormant: care.dormancy.isDormant,
    hasDormancyWarning: care.hasDormancyWarning,
    bondLevel: care.bond.level,
  };
};
