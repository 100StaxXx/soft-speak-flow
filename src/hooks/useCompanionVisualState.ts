import { useMemo } from 'react';
import type { CompanionMoodState } from './useCompanionHealth';

interface VisualState {
  filter: string;
  animation: 'bounce' | 'pulse' | 'shiver' | 'droop' | 'none';
  animationDuration: string;
  opacity: number;
  saturation: number;
}

/**
 * Maps companion health and mood to visual CSS filters and animations
 * Uses CSS-only approach for transient states (no AI calls)
 */
export const useCompanionVisualState = (
  moodState: CompanionMoodState,
  hunger: number,
  happiness: number,
  isAlive: boolean,
  recoveryProgress: number
) => {
  const visualState = useMemo((): VisualState => {
    // Dead companion - grayscale and no animation
    if (!isAlive) {
      return {
        filter: 'grayscale(1) brightness(0.5)',
        animation: 'none',
        animationDuration: '0s',
        opacity: 0.7,
        saturation: 0,
      };
    }

    // Recovering companion - gradual improvement
    if (recoveryProgress < 100) {
      const recoveryPercent = recoveryProgress / 100;
      return {
        filter: `saturate(${0.5 + recoveryPercent * 0.5}) brightness(${0.85 + recoveryPercent * 0.15})`,
        animation: 'pulse',
        animationDuration: '3s',
        opacity: 0.8 + recoveryPercent * 0.2,
        saturation: 0.5 + recoveryPercent * 0.5,
      };
    }

    // Mood-based visual states
    switch (moodState) {
      case 'happy':
        return {
          filter: 'saturate(1.2) brightness(1.1)',
          animation: 'bounce',
          animationDuration: '2s',
          opacity: 1,
          saturation: 1.2,
        };

      case 'content':
        return {
          filter: 'saturate(1.1) brightness(1.05)',
          animation: 'pulse',
          animationDuration: '4s',
          opacity: 1,
          saturation: 1.1,
        };

      case 'neutral':
        return {
          filter: 'saturate(0.95) brightness(0.98)',
          animation: 'pulse',
          animationDuration: '5s',
          opacity: 0.95,
          saturation: 0.95,
        };

      case 'worried':
        return {
          filter: 'saturate(0.8) brightness(0.92)',
          animation: 'shiver',
          animationDuration: '0.5s',
          opacity: 0.9,
          saturation: 0.8,
        };

      case 'sad':
        return {
          filter: 'saturate(0.6) brightness(0.85) sepia(0.1)',
          animation: 'droop',
          animationDuration: '3s',
          opacity: 0.85,
          saturation: 0.6,
        };

      case 'sick':
        return {
          filter: 'saturate(0.4) brightness(0.7) sepia(0.2)',
          animation: 'shiver',
          animationDuration: '0.3s',
          opacity: 0.75,
          saturation: 0.4,
        };

      default:
        return {
          filter: 'none',
          animation: 'none',
          animationDuration: '0s',
          opacity: 1,
          saturation: 1,
        };
    }
  }, [moodState, hunger, happiness, isAlive, recoveryProgress]);

  // Generate CSS styles object
  const cssStyles = useMemo((): React.CSSProperties => ({
    filter: visualState.filter,
    opacity: visualState.opacity,
    transition: 'filter 0.5s ease, opacity 0.5s ease',
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
      default:
        return '';
    }
  }, [visualState.animation]);

  return {
    visualState,
    cssStyles,
    animationClass,
  };
};
