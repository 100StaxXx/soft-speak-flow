import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';
import { MiniGameHud } from './MiniGameHud';

interface GravityBalanceGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
}

type Direction = 'up' | 'down' | 'left' | 'right';

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

export const GravityBalanceGame = ({
  companionStats,
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0,
}: GravityBalanceGameProps) => {
  const [orbPosition, setOrbPosition] = useState({ x: 50, y: 50 });
  const [gravityDirection, setGravityDirection] = useState<Direction>('down');
  const [timeInZone, setTimeInZone] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [showGravityChange, setShowGravityChange] = useState(false);
  
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const completedRef = useRef(false);

  const gameDuration = 20000; // 20 seconds
  const baseSafeZoneSize = difficulty === 'easy' ? 35 : difficulty === 'medium' ? 28 : 22;
  const safeZoneSize = baseSafeZoneSize * (1 - questIntervalScale * 0.2);
  
  const baseGravityStrength = difficulty === 'easy' ? 15 : difficulty === 'medium' ? 22 : 30;
  const gravityStrength = baseGravityStrength * (1 + questIntervalScale * 0.25);
  
  const baseGravityChangeInterval = difficulty === 'easy' ? 3000 : difficulty === 'medium' ? 2200 : 1800;
  const gravityChangeInterval = baseGravityChangeInterval * (1 - questIntervalScale * 0.15);

  // Mind stat affects gravity response (slower drift)
  const mindBonus = Math.min(companionStats.mind / 100, 1);
  const adjustedGravityStrength = gravityStrength * (1 - mindBonus * 0.3);
  const difficultyLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  const questDriftPercent = Math.round(questIntervalScale * 100);
  const questDriftLabel = questDriftPercent === 0 
    ? 'Stable orbit'
    : `${questDriftPercent > 0 ? '+' : ''}${questDriftPercent}% pull`;
  const questDriftTone = questDriftPercent > 0 ? 'warning' : questDriftPercent < 0 ? 'positive' : 'default';
  const mindBonusPercent = Math.round(mindBonus * 30);
  const infoChips = [
    { label: 'Difficulty', value: difficultyLabel, tone: 'accent' as const },
    { 
      label: 'Quest drift', 
      value: questDriftLabel, 
      tone: questDriftTone,
      helperText: questDriftPercent === 0 ? 'Neutral gravity' : questDriftPercent > 0 ? 'Heavier pull' : 'Gentler pull',
    },
    { 
      label: 'Mind focus', 
      value: `-${mindBonusPercent}% gravity`, 
      tone: 'positive' as const,
      helperText: 'Gravity strength',
    },
  ];

  const isInSafeZone = useCallback(() => {
    const dx = orbPosition.x - 50;
    const dy = orbPosition.y - 50;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= safeZoneSize / 2;
  }, [orbPosition, safeZoneSize]);

  // Game loop
  useEffect(() => {
    if (gameComplete || completedRef.current) return;

    let startTime: number | null = null;
    let lastGravityChange = 0;

    const animate = (timestamp: number) => {
      if (!startTime) {
        startTime = timestamp;
        lastGravityChange = timestamp;
      }

      const elapsed = timestamp - startTime;
      const deltaTime = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      // Check for gravity direction change
      if (timestamp - lastGravityChange >= gravityChangeInterval) {
        const newDirection = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
        setGravityDirection(newDirection);
        setShowGravityChange(true);
        setTimeout(() => setShowGravityChange(false), 500);
        lastGravityChange = timestamp;
      }

      // Apply gravity
      setOrbPosition(prev => {
        const gravityDelta = (adjustedGravityStrength * deltaTime) / 1000;
        let newX = prev.x;
        let newY = prev.y;

        switch (gravityDirection) {
          case 'up': newY -= gravityDelta; break;
          case 'down': newY += gravityDelta; break;
          case 'left': newX -= gravityDelta; break;
          case 'right': newX += gravityDelta; break;
        }

        // Clamp to bounds
        newX = Math.max(10, Math.min(90, newX));
        newY = Math.max(10, Math.min(90, newY));

        return { x: newX, y: newY };
      });

      setTotalTime(elapsed);

      // Track time in safe zone
      const dx = orbPosition.x - 50;
      const dy = orbPosition.y - 50;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= safeZoneSize / 2) {
        setTimeInZone(prev => prev + deltaTime);
      }

      // Check game end
      if (elapsed >= gameDuration && !completedRef.current) {
        completedRef.current = true;
        setGameComplete(true);
        const accuracy = Math.round((timeInZone / gameDuration) * 100);
        onComplete({
          success: accuracy >= 50,
          accuracy,
          result: accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 50 ? 'partial' : 'fail',
        });
        return;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameComplete, gravityDirection, adjustedGravityStrength, gravityChangeInterval, safeZoneSize, orbPosition, timeInZone, onComplete]);

  const handleCounterGravity = useCallback((direction: Direction) => {
    if (gameComplete) return;

    const pushStrength = 8;
    setOrbPosition(prev => {
      let newX = prev.x;
      let newY = prev.y;

      switch (direction) {
        case 'up': newY -= pushStrength; break;
        case 'down': newY += pushStrength; break;
        case 'left': newX -= pushStrength; break;
        case 'right': newX += pushStrength; break;
      }

      newX = Math.max(10, Math.min(90, newX));
      newY = Math.max(10, Math.min(90, newY));

      return { x: newX, y: newY };
    });
  }, [gameComplete]);

  const inZone = isInSafeZone();
  const progressPercent = Math.min((totalTime / gameDuration) * 100, 100);
  const accuracyPercent = totalTime > 0 ? Math.round((timeInZone / totalTime) * 100) : 100;

  const gravityArrow: Record<Direction, string> = {
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
  };

  const statusBarContent = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Time</p>
          <p className="font-semibold">
            {Math.round(totalTime / 1000)}s / {gameDuration / 1000}s
          </p>
        </div>
        <div className={`text-sm font-semibold ${inZone ? 'text-green-500' : 'text-amber-400'}`}>
          Balance {accuracyPercent}%
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
        <motion.div
          className="h-full bg-primary"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );

  return (
    <MiniGameHud
      title="Gravity Balance"
      subtitle="Keep the orb hovering inside the safe zone by tapping against gravity."
      chips={infoChips}
      statusBar={statusBarContent}
      footerNote={`Mind stat bonus: -${mindBonusPercent}% gravity strength`}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-64 h-64 bg-muted/20 rounded-2xl border border-border/50 overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />

          {/* Gravity direction indicator */}
          <motion.div
            className={`absolute top-2 right-2 text-2xl ${showGravityChange ? 'text-primary' : 'text-muted-foreground'}`}
            animate={{ scale: showGravityChange ? [1, 1.5, 1] : 1 }}
          >
            {gravityArrow[gravityDirection]}
          </motion.div>

          {/* Safe zone */}
          <div
            className={`absolute rounded-full border-2 transition-colors ${
              inZone ? 'border-green-500 bg-green-500/10' : 'border-primary/50 bg-primary/5'
            }`}
            style={{
              width: `${safeZoneSize}%`,
              height: `${safeZoneSize}%`,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            {inZone && (
              <div className="absolute inset-0 rounded-full bg-green-500/20 animate-pulse" />
            )}
          </div>

          {/* Orb */}
          <motion.div
            className="absolute w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent border-2 border-primary-foreground/30"
            style={{
              left: `${orbPosition.x}%`,
              top: `${orbPosition.y}%`,
              transform: 'translate(-50%, -50%)',
              boxShadow: inZone
                ? '0 0 20px hsl(var(--primary)), inset 0 0 10px rgba(255,255,255,0.3)'
                : '0 0 10px hsl(var(--accent))',
            }}
            animate={{
              scale: inZone ? [1, 1.05, 1] : 1,
            }}
            transition={{ repeat: Infinity, duration: 1 }}
          >
            <div className="absolute inset-2 rounded-full bg-white/30" />
          </motion.div>

          {/* Touch controls - invisible tap zones */}
          <button
            className="absolute top-0 left-0 right-0 h-1/3 opacity-0"
            onClick={() => handleCounterGravity('up')}
          />
          <button
            className="absolute bottom-0 left-0 right-0 h-1/3 opacity-0"
            onClick={() => handleCounterGravity('down')}
          />
          <button
            className="absolute left-0 top-1/3 bottom-1/3 w-1/3 opacity-0"
            onClick={() => handleCounterGravity('left')}
          />
          <button
            className="absolute right-0 top-1/3 bottom-1/3 w-1/3 opacity-0"
            onClick={() => handleCounterGravity('right')}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div />
          <button
            className="p-2 rounded bg-muted hover:bg-muted/80 active:bg-primary/20 text-sm"
            onClick={() => handleCounterGravity('up')}
          >
            ↑
          </button>
          <div />
          <button
            className="p-2 rounded bg-muted hover:bg-muted/80 active:bg-primary/20 text-sm"
            onClick={() => handleCounterGravity('left')}
          >
            ←
          </button>
          <button
            className="p-2 rounded bg-muted hover:bg-muted/80 active:bg-primary/20 text-sm"
            onClick={() => handleCounterGravity('down')}
          >
            ↓
          </button>
          <button
            className="p-2 rounded bg-muted hover:bg-muted/80 active:bg-primary/20 text-sm"
            onClick={() => handleCounterGravity('right')}
          >
            →
          </button>
        </div>
      </div>
    </MiniGameHud>
  );
};