import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield } from 'lucide-react';
import { MiniGameResult } from '@/types/astralEncounters';
import { MiniGameHud } from './MiniGameHud';

interface ShieldBarrierGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
}

type Direction = 'top' | 'bottom' | 'left' | 'right';

interface Attack {
  id: number;
  direction: Direction;
  progress: number;
  blocked: boolean | null;
}

const DIRECTIONS: Direction[] = ['top', 'bottom', 'left', 'right'];

const getAttackPosition = (direction: Direction, progress: number) => {
  const start = 100 - progress * 100;
  switch (direction) {
    case 'top': return { top: `${start}%`, left: '50%', transform: 'translate(-50%, -50%)' };
    case 'bottom': return { bottom: `${start}%`, left: '50%', transform: 'translate(-50%, 50%)' };
    case 'left': return { left: `${start}%`, top: '50%', transform: 'translate(-50%, -50%)' };
    case 'right': return { right: `${start}%`, top: '50%', transform: 'translate(50%, -50%)' };
  }
};

export const ShieldBarrierGame = ({
  companionStats,
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0,
}: ShieldBarrierGameProps) => {
  const [attacks, setAttacks] = useState<Attack[]>([]);
  const [currentAttackIndex, setCurrentAttackIndex] = useState(0);
  const [activeShield, setActiveShield] = useState<Direction | null>(null);
  const [score, setScore] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [showResult, setShowResult] = useState<'blocked' | 'hit' | null>(null);
  const completedRef = useRef(false);
  const animationRef = useRef<number | null>(null);

  const baseTotalAttacks = difficulty === 'easy' ? 8 : difficulty === 'medium' ? 10 : 12;
  const totalAttacks = Math.round(baseTotalAttacks * (1 + questIntervalScale * 0.3));
  
  const baseApproachTime = difficulty === 'easy' ? 2500 : difficulty === 'medium' ? 2000 : 1500;
  const approachTime = baseApproachTime * (1 - questIntervalScale * 0.25);

  // Body stat affects timing window
  const bodyBonus = Math.min(companionStats.body / 100, 1);
  const blockWindow = 0.3 + bodyBonus * 0.15; // 30-45% of attack progress
  const difficultyLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  const questDriftPercent = Math.round(questIntervalScale * 100);
  const questDriftLabel = questDriftPercent === 0 
    ? 'Balanced assault'
    : `${questDriftPercent > 0 ? '+' : ''}${questDriftPercent}% volleys`;
  const questDriftTone = questDriftPercent > 0 ? 'warning' : questDriftPercent < 0 ? 'positive' : 'default';
  const bodyBonusPercent = Math.round(bodyBonus * 15);
  const infoChips = [
    { label: 'Difficulty', value: difficultyLabel, tone: 'accent' as const },
    { 
      label: 'Quest drift', 
      value: questDriftLabel, 
      tone: questDriftTone,
      helperText: questDriftPercent === 0 ? 'Baseline speed' : questDriftPercent > 0 ? 'More frequent' : 'Sparser attacks',
    },
    { 
      label: 'Body focus', 
      value: `+${bodyBonusPercent}% window`, 
      tone: 'positive' as const,
      helperText: 'Block timing',
    },
  ];

  // Generate attacks
  useEffect(() => {
    const newAttacks: Attack[] = [];
    for (let i = 0; i < totalAttacks; i++) {
      newAttacks.push({
        id: i,
        direction: DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)],
        progress: 0,
        blocked: null,
      });
    }
    setAttacks(newAttacks);
  }, [totalAttacks]);

  // Attack animation
  useEffect(() => {
    if (gameComplete || attacks.length === 0 || completedRef.current) return;
    
    const currentAttack = attacks[currentAttackIndex];
    if (!currentAttack || currentAttack.blocked !== null) return;

    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / approachTime, 1);

      setAttacks(prev => prev.map((a, i) =>
        i === currentAttackIndex ? { ...a, progress } : a
      ));

      if (progress >= 1) {
        // Attack reached center - player failed to block
        handleAttackResult(false);
      } else if (!completedRef.current) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [currentAttackIndex, attacks, approachTime, gameComplete]);

  const handleAttackResult = useCallback((blocked: boolean) => {
    if (completedRef.current) return;

    setAttacks(prev => prev.map((a, i) =>
      i === currentAttackIndex ? { ...a, blocked } : a
    ));

    if (blocked) {
      setScore(prev => prev + 1);
      setShowResult('blocked');
    } else {
      setShowResult('hit');
    }

    setTimeout(() => {
      setShowResult(null);
      setActiveShield(null);

      const nextIndex = currentAttackIndex + 1;
      if (nextIndex >= totalAttacks && !completedRef.current) {
        completedRef.current = true;
        setGameComplete(true);
        const finalScore = blocked ? score + 1 : score;
        const accuracy = Math.round(finalScore / totalAttacks * 100);
        onComplete({
          success: accuracy >= 50,
          accuracy,
          result: accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 50 ? 'partial' : 'fail',
        });
      } else {
        setCurrentAttackIndex(nextIndex);
      }
    }, 400);
  }, [currentAttackIndex, totalAttacks, score, onComplete]);

  const handleShieldActivate = useCallback((direction: Direction) => {
    if (gameComplete || completedRef.current) return;

    const currentAttack = attacks[currentAttackIndex];
    if (!currentAttack || currentAttack.blocked !== null) return;

    setActiveShield(direction);

    // Check if correct direction and in block window
    const inWindow = currentAttack.progress >= (1 - blockWindow);
    const correctDirection = currentAttack.direction === direction;

    if (correctDirection && inWindow) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      handleAttackResult(true);
    }
  }, [gameComplete, attacks, currentAttackIndex, blockWindow, handleAttackResult]);

  const currentAttack = attacks[currentAttackIndex];
  const impactPercent = currentAttack ? Math.min(currentAttack.progress, 1) * 100 : 0;
  const statusBarContent = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Blocks</p>
          <p className="font-semibold">{score}/{totalAttacks}</p>
        </div>
        <div className="text-xs text-muted-foreground">
          {gameComplete ? 'Assault repelled' : `Impact in ${Math.max(0, 100 - Math.round(impactPercent))}%`}
        </div>
      </div>
      <div className="flex gap-1 flex-wrap">
        {attacks.map((attack) => (
          <div
            key={attack.id}
            className={`h-2 w-6 rounded-full ${
              attack.blocked === true
                ? 'bg-green-500'
                : attack.blocked === false
                  ? 'bg-red-500'
                  : attack.id === currentAttackIndex
                    ? 'bg-primary animate-pulse'
                    : 'bg-muted'
            }`}
          />
        ))}
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Projectile distance</span>
          <span>{Math.round(impactPercent)}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
          <motion.div
            className="h-full bg-red-500"
            style={{ width: `${impactPercent}%` }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <MiniGameHud
      title="Shield Barrier"
      subtitle="Tap the directional shields right before the projectile lands."
      chips={infoChips}
      statusBar={statusBarContent}
      footerNote={`Body stat bonus: +${bodyBonusPercent}% block window`}
    >
      <div className="relative w-64 h-64 mx-auto">
        {/* Center core */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 border-2 border-primary/50 flex items-center justify-center ${
          showResult === 'hit' ? 'animate-shake bg-red-500/30 border-red-500' : ''
        }`}>
          <div className="w-8 h-8 rounded-full bg-primary/50 animate-pulse" />
        </div>

        {/* Shield buttons */}
        {DIRECTIONS.map((direction) => {
          const isActive = activeShield === direction;
          const positions: Record<Direction, string> = {
            top: 'top-0 left-1/2 -translate-x-1/2',
            bottom: 'bottom-0 left-1/2 -translate-x-1/2',
            left: 'left-0 top-1/2 -translate-y-1/2',
            right: 'right-0 top-1/2 -translate-y-1/2',
          };
          const rotations: Record<Direction, string> = {
            top: 'rotate-0',
            bottom: 'rotate-180',
            left: '-rotate-90',
            right: 'rotate-90',
          };

          return (
            <motion.button
              key={direction}
              className={`absolute ${positions[direction]} w-14 h-14 rounded-xl flex items-center justify-center transition-all ${
                isActive
                  ? 'bg-primary border-2 border-primary shadow-lg'
                  : 'bg-muted/50 border border-border hover:bg-muted'
              }`}
              style={{
                boxShadow: isActive ? '0 0 20px hsl(var(--primary))' : 'none',
              }}
              onClick={() => handleShieldActivate(direction)}
              whileTap={{ scale: 0.9 }}
            >
              <Shield className={`w-6 h-6 ${rotations[direction]} ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
            </motion.button>
          );
        })}

        {/* Attack projectile */}
        <AnimatePresence>
          {currentAttack && currentAttack.blocked === null && !gameComplete && (
            <motion.div
              key={currentAttack.id}
              className="absolute w-8 h-8 rounded-full bg-red-500 border-2 border-red-400"
              style={{
                ...getAttackPosition(currentAttack.direction, currentAttack.progress),
                boxShadow: '0 0 15px rgba(239, 68, 68, 0.7)',
              }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            >
              <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-50" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result feedback */}
        <AnimatePresence>
          {showResult && (
            <motion.div
              className={`absolute inset-0 rounded-full flex items-center justify-center text-2xl font-bold ${
                showResult === 'blocked' ? 'text-green-500' : 'text-red-500'
              }`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
            >
              {showResult === 'blocked' ? '🛡️' : '💥'}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translate(-50%, -50%); }
          25% { transform: translate(calc(-50% - 5px), calc(-50% - 5px)); }
          75% { transform: translate(calc(-50% + 5px), calc(-50% + 5px)); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </MiniGameHud>
  );
};