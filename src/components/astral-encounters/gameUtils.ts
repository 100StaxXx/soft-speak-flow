import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// Screen shake effect hook
export const useScreenShake = () => {
  const [shake, setShake] = useState(false);

  const triggerShake = useCallback((intensity: 'light' | 'medium' | 'heavy' = 'medium') => {
    setShake(true);
    const duration = intensity === 'light' ? 100 : intensity === 'medium' ? 200 : 400;
    setTimeout(() => setShake(false), duration);
  }, []);

  const shakeStyle = useMemo(() => shake ? {
    animation: 'shake 0.15s ease-in-out',
  } : {}, [shake]);

  return { shake, triggerShake, shakeStyle };
};

// Haptic feedback helper
export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'medium') => {
  if ('vibrate' in navigator) {
    const patterns = {
      light: [10],
      medium: [25],
      heavy: [50],
      success: [30, 50, 80],
      error: [100, 50, 100],
    };
    navigator.vibrate(patterns[type]);
  }
};

// Optimized game loop hook with delta time
export const useGameLoop = (
  callback: (deltaTime: number, time: number) => void,
  isRunning: boolean
) => {
  const callbackRef = useRef(callback);
  const frameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  // Keep callback ref up to date without causing re-subscriptions
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!isRunning) {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      lastTimeRef.current = 0;
      return;
    }

    const loop = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const deltaTime = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      callbackRef.current(deltaTime, time);
      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [isRunning]);
};

// Optimized interval-based timer with countdown
export const useGameTimer = (
  initialTime: number,
  isRunning: boolean,
  onComplete?: () => void
) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const intervalRef = useRef<NodeJS.Timeout>();
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    setTimeLeft(initialTime);
  }, [initialTime]);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          onCompleteRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const reset = useCallback(() => {
    setTimeLeft(initialTime);
  }, [initialTime]);

  return { timeLeft, reset };
};

// Particle system for optimized particle effects
interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
}

export const useParticleSystem = (maxParticles: number = 50) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const idRef = useRef(0);
  const frameRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);

  // Keep particles ref in sync
  useEffect(() => {
    particlesRef.current = particles;
  }, [particles]);

  // Update loop
  useEffect(() => {
    let lastTime = 0;

    const update = (time: number) => {
      if (!lastTime) lastTime = time;
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      if (particlesRef.current.length > 0) {
        setParticles(prev => {
          const updated = prev
            .map(p => ({
              ...p,
              x: p.x + p.vx * delta * 60,
              y: p.y + p.vy * delta * 60,
              vy: p.vy + 0.3 * delta * 60, // gravity
              life: p.life - delta,
            }))
            .filter(p => p.life > 0);
          return updated;
        });
      }

      frameRef.current = requestAnimationFrame(update);
    };

    frameRef.current = requestAnimationFrame(update);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const emit = useCallback((
    x: number,
    y: number,
    color: string,
    count: number = 5,
    spread: number = 4,
    lifespan: number = 0.6
  ) => {
    const newParticles: Particle[] = [];
    const actualCount = Math.min(count, maxParticles - particlesRef.current.length);
    
    for (let i = 0; i < actualCount; i++) {
      newParticles.push({
        id: idRef.current++,
        x,
        y,
        vx: (Math.random() - 0.5) * spread * 2,
        vy: (Math.random() - 0.5) * spread * 2 - 1,
        color,
        life: lifespan + Math.random() * 0.2,
        maxLife: lifespan + 0.2,
      });
    }

    setParticles(prev => [...prev.slice(-(maxParticles - actualCount)), ...newParticles]);
  }, [maxParticles]);

  const clear = useCallback(() => {
    setParticles([]);
  }, []);

  return { particles, emit, clear };
};

// Static background stars - memoized for performance
export const useStaticStars = (count: number) => {
  return useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      opacity: 0.2 + Math.random() * 0.6,
      animationDelay: Math.random() * 2,
      animationDuration: 1 + Math.random() * 2,
    }));
  }, [count]);
};

// Debounced callback for input handling
export const useDebouncedCallback = <T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T => {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]) as T;
};

// CSS-based shake animation styles (to be added to global CSS)
export const shakeKeyframes = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
    20%, 40%, 60%, 80% { transform: translateX(4px); }
  }
  .animate-shake {
    animation: shake 0.3s ease-in-out;
  }
  .will-animate {
    will-change: transform, opacity;
  }
  .gpu-accelerated {
    transform: translateZ(0);
    backface-visibility: hidden;
  }
`;

// Pre-calculated positions for orb/object spawning
export const getGridPositions = (count: number, padding: number = 15, areaSize: number = 70) => {
  const positions: { x: number; y: number }[] = [];
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const cellWidth = areaSize / cols;
  const cellHeight = areaSize / rows;

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({
      x: padding + col * cellWidth + cellWidth / 2 + (Math.random() - 0.5) * cellWidth * 0.5,
      y: padding + row * cellHeight + cellHeight / 2 + (Math.random() - 0.5) * cellHeight * 0.5,
    });
  }

  return positions;
};
