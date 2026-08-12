import { useMemo } from 'react';
import { useCompanionCareSignals } from './useCompanionCareSignals';

interface VisualState {
  filter: string;
  animation: 'bounce' | 'pulse';
  animationDuration: string;
  opacity: number;
  saturation: number;
  posture: 'confident' | 'relaxed';
  eyeContact: 'direct' | 'friendly' | 'occasional';
}

/**
 * Maps companion health and HIDDEN care signals to visual CSS filters and animations.
 * Users see the effects but never the underlying numbers.
 */
export const useCompanionVisualState = () => {
  const { care } = useCompanionCareSignals();

  const visualState = useMemo((): VisualState => {
    // Consistency changes expressiveness, never health, safety, or affection.
    const overallCare = care.overallCare;

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

    return {
      filter: 'saturate(1) brightness(1)',
      animation: 'pulse',
      animationDuration: '5s',
      opacity: 1,
      saturation: 1,
      posture: 'relaxed',
      eyeContact: 'occasional',
    };
  }, [care]);

  // Generate CSS styles object
  const cssStyles = useMemo((): React.CSSProperties => ({
    filter: visualState.filter,
    opacity: visualState.opacity,
    transition: 'filter 0.8s ease, opacity 0.8s ease',
  }), [visualState]);

  // Generate animation class name
  const animationClass = useMemo(() => {
    switch (visualState.animation) {
      case 'bounce':
        return 'animate-companion-bounce';
      case 'pulse':
        return 'animate-companion-pulse';
      default:
        return '';
    }
  }, [visualState.animation]);

  return {
    visualState,
    cssStyles,
    animationClass,
    overallCare: care.overallCare,
    evolutionPath: care.evolutionPath,
    dialogueTone: care.dialogueTone,
    bondLevel: care.bond.level,
  };
};
