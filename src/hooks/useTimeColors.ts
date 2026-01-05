import { useMemo } from 'react';
import { useTime, TimePeriod } from '@/contexts/TimeContext';

interface StarColorDistribution {
  white: number;
  blue: number;
  pink: number;
  gold: number;
  teal: number;
  orange: number;
}

// Star color distributions by time period
const STAR_DISTRIBUTIONS: Record<TimePeriod, StarColorDistribution> = {
  dawn: { white: 0.35, blue: 0.1, pink: 0.2, gold: 0.25, teal: 0.05, orange: 0.05 },
  morning: { white: 0.4, blue: 0.25, pink: 0.1, gold: 0.1, teal: 0.1, orange: 0.05 },
  afternoon: { white: 0.35, blue: 0.15, pink: 0.1, gold: 0.2, teal: 0.15, orange: 0.05 },
  sunset: { white: 0.25, blue: 0.05, pink: 0.25, gold: 0.2, teal: 0.05, orange: 0.2 },
  night: { white: 0.4, blue: 0.25, pink: 0.15, gold: 0.1, teal: 0.1, orange: 0 },
};

export type StarColor = 'white' | 'blue' | 'pink' | 'gold' | 'teal' | 'orange';

export const useTimeColors = () => {
  const { period, progress, colors, rotationHue } = useTime();

  const starDistribution = useMemo(() => STAR_DISTRIBUTIONS[period], [period]);

  // Get a star color based on the current time period distribution
  const getStarColorForPeriod = useMemo(() => {
    return (): StarColor => {
      const roll = Math.random();
      const dist = starDistribution;
      
      let cumulative = 0;
      if ((cumulative += dist.orange) > roll && dist.orange > 0) return 'orange';
      if ((cumulative += dist.gold) > roll) return 'gold';
      if ((cumulative += dist.teal) > roll) return 'teal';
      if ((cumulative += dist.pink) > roll) return 'pink';
      if ((cumulative += dist.blue) > roll) return 'blue';
      return 'white';
    };
  }, [starDistribution]);

  // Get HSL color for a star color
  const getStarHSL = (color: StarColor, hueOffset: number = 0): string => {
    const baseColors: Record<StarColor, [number, number, number]> = {
      white: [0, 0, 100],
      blue: [200, 85, 70],
      pink: [320, 60, 75],
      gold: [45, 100, 65],
      teal: [175, 70, 60],
      orange: [25, 90, 65],
    };
    
    const [h, s, l] = baseColors[color];
    const adjustedHue = color === 'white' ? h : (h + hueOffset) % 360;
    return `hsl(${adjustedHue}, ${s}%, ${l}%)`;
  };

  // Get glow effect for a star
  const getStarGlow = (color: StarColor, opacity: number, hueOffset: number = 0): string => {
    const hsl = getStarHSL(color, hueOffset);
    if (color === 'white') {
      return `0 0 6px hsla(0, 0%, 100%, ${opacity})`;
    }
    return `0 0 8px ${hsl.replace(')', ` / ${opacity})`).replace('hsl', 'hsla')}, 0 0 16px ${hsl.replace(')', ` / ${opacity * 0.5})`).replace('hsl', 'hsla')}`;
  };

  // Get nebula gradient based on time
  const getNebulaGradient = (index: 1 | 2 | 3): string => {
    const key = `nebula${index}` as 'nebula1' | 'nebula2' | 'nebula3';
    return colors[key];
  };

  return {
    period,
    progress,
    colors,
    rotationHue,
    starDistribution,
    getStarColorForPeriod,
    getStarHSL,
    getStarGlow,
    getNebulaGradient,
  };
};
