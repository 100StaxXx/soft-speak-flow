import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { logger } from "@/utils/logger";

export type TimePeriod = 'dawn' | 'morning' | 'afternoon' | 'sunset' | 'night';

interface TimeColors {
  primary: string;
  accent: string;
  nebula1: string;
  nebula2: string;
  nebula3: string;
  starTint: 'warm' | 'cool' | 'neutral';
  gradient: string;
}

interface TimeContextType {
  period: TimePeriod;
  progress: number; // 0-1 progress within current period
  colors: TimeColors;
  rotationHue: number; // Slow rotation hue offset
}

// Time period configurations
const TIME_PERIODS: Record<TimePeriod, { start: number; end: number; colors: TimeColors }> = {
  dawn: {
    start: 5,
    end: 8,
    colors: {
      primary: 'hsl(25, 90%, 55%)',
      accent: 'hsl(340, 75%, 60%)',
      nebula1: 'hsl(330, 65%, 45%)',
      nebula2: 'hsl(25, 80%, 50%)',
      nebula3: 'hsl(45, 90%, 60%)',
      starTint: 'warm',
      gradient: 'from-rose-950/40 via-amber-900/30 to-slate-900/50',
    },
  },
  morning: {
    start: 8,
    end: 12,
    colors: {
      primary: 'hsl(195, 85%, 50%)',
      accent: 'hsl(170, 75%, 45%)',
      nebula1: 'hsl(185, 70%, 45%)',
      nebula2: 'hsl(45, 85%, 55%)',
      nebula3: 'hsl(210, 75%, 50%)',
      starTint: 'neutral',
      gradient: 'from-sky-950/40 via-cyan-900/30 to-slate-900/50',
    },
  },
  afternoon: {
    start: 12,
    end: 17,
    colors: {
      primary: 'hsl(35, 95%, 55%)',
      accent: 'hsl(190, 80%, 50%)',
      nebula1: 'hsl(40, 85%, 50%)',
      nebula2: 'hsl(180, 70%, 45%)',
      nebula3: 'hsl(55, 90%, 60%)',
      starTint: 'warm',
      gradient: 'from-amber-950/40 via-teal-900/30 to-slate-900/50',
    },
  },
  sunset: {
    start: 17,
    end: 20,
    colors: {
      primary: 'hsl(330, 80%, 55%)',
      accent: 'hsl(20, 90%, 55%)',
      nebula1: 'hsl(340, 75%, 50%)',
      nebula2: 'hsl(25, 85%, 55%)',
      nebula3: 'hsl(280, 60%, 50%)',
      starTint: 'warm',
      gradient: 'from-pink-950/40 via-orange-900/30 to-purple-950/40',
    },
  },
  night: {
    start: 20,
    end: 5, // Wraps around midnight
    colors: {
      primary: 'hsl(230, 70%, 55%)',
      accent: 'hsl(195, 90%, 55%)',
      nebula1: 'hsl(240, 60%, 45%)',
      nebula2: 'hsl(200, 75%, 50%)',
      nebula3: 'hsl(270, 55%, 45%)',
      starTint: 'cool',
      gradient: 'from-indigo-950/50 via-slate-900/40 to-black/60',
    },
  },
};

const getTimePeriod = (hour: number): TimePeriod => {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'sunset';
  return 'night';
};

const getPeriodProgress = (hour: number, minute: number, period: TimePeriod): number => {
  const config = TIME_PERIODS[period];
  const currentMinutes = hour * 60 + minute;
  
  let startMinutes = config.start * 60;
  let endMinutes = config.end * 60;
  
  // Handle night period wrapping around midnight
  if (period === 'night') {
    if (hour >= 20) {
      // Before midnight
      endMinutes = 24 * 60 + 5 * 60; // Next day 5am
    } else {
      // After midnight
      startMinutes = 0;
      endMinutes = 5 * 60;
    }
  }
  
  const duration = endMinutes - startMinutes;
  const elapsed = currentMinutes - startMinutes;
  
  return Math.max(0, Math.min(1, elapsed / duration));
};

const getRotationHueForTime = (hour: number, minute: number): number => {
  const totalMinutes = (hour * 60) + minute;
  return (totalMinutes * 0.5) % 360;
};

const defaultColors: TimeColors = TIME_PERIODS.night.colors;

const TimeContext = createContext<TimeContextType>({
  period: 'night',
  progress: 0,
  colors: defaultColors,
  rotationHue: 0,
});

export const useTime = () => useContext(TimeContext);

interface TimeProviderProps {
  children: ReactNode;
}

export const TimeProvider = ({ children }: TimeProviderProps) => {
  const [period, setPeriod] = useState<TimePeriod>('night');
  const [progress, setProgress] = useState(0);
  const [rotationHue, setRotationHue] = useState(0);

  // Update time period every minute
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      const newPeriod = getTimePeriod(hour);
      const newProgress = getPeriodProgress(hour, minute, newPeriod);
      const newRotationHue = getRotationHueForTime(hour, minute);
      
      setPeriod(newPeriod);
      setProgress(newProgress);
      setRotationHue(newRotationHue);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute

    if (import.meta.env.DEV) {
      logger.debug("TimeContext running on minute cadence", { updateIntervalMs: 60000 });
    }
    
    return () => clearInterval(interval);
  }, []);

  // Apply CSS variables to root
  useEffect(() => {
    const root = document.documentElement;
    const colors = TIME_PERIODS[period].colors;
    
    root.style.setProperty('--time-primary', colors.primary);
    root.style.setProperty('--time-accent', colors.accent);
    root.style.setProperty('--time-nebula-1', colors.nebula1);
    root.style.setProperty('--time-nebula-2', colors.nebula2);
    root.style.setProperty('--time-nebula-3', colors.nebula3);
    root.style.setProperty('--time-gradient', colors.gradient);
    root.style.setProperty('--rotation-hue', `${rotationHue}deg`);
    root.setAttribute('data-time-period', period);
  }, [period, rotationHue]);

  const colors = useMemo(() => TIME_PERIODS[period].colors, [period]);

  const value = useMemo(() => ({
    period,
    progress,
    colors,
    rotationHue,
  }), [period, progress, colors, rotationHue]);

  return (
    <TimeContext.Provider value={value}>
      {children}
    </TimeContext.Provider>
  );
};
