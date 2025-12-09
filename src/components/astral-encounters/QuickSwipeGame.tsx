import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { MiniGameResult } from '@/types/astralEncounters';

interface QuickSwipeGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
}

type Direction = 'up' | 'down' | 'left' | 'right';

interface Attack {
  id: number;
  direction: Direction;
  active: boolean;
  result?: 'success' | 'fail';
}

const DIRECTION_ICONS: Record<Direction, typeof ArrowUp> = {
  up: ArrowUp,
  down: ArrowDown,
  left: ArrowLeft,
  right: ArrowRight,
};

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

export const QuickSwipeGame = ({ 
  companionStats, 
  onComplete,
  difficulty = 'medium' 
}: QuickSwipeGameProps) => {
  const [attacks, setAttacks] = useState<Attack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [showResult, setShowResult] = useState<'success' | 'fail' | null>(null);
  
  const totalAttacks = difficulty === 'easy' ? 6 : difficulty === 'medium' ? 8 : 10;
  const attackSpeed = difficulty === 'easy' ? 2500 : difficulty === 'medium' ? 2000 : 1500;
  
  // Combined stat bonus affects reaction time window
  const statBonus = Math.min((companionStats.body + companionStats.mind) / 200, 1);
  const timeWindow = attackSpeed + (statBonus * 500);

  // Generate attacks
  useEffect(() => {
    const newAttacks: Attack[] = [];
    for (let i = 0; i < totalAttacks; i++) {
      newAttacks.push({
        id: i,
        direction: DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)],
        active: false,
      });
    }
    setAttacks(newAttacks);
  }, [totalAttacks]);

  // Attack timer
  useEffect(() => {
    if (gameComplete || attacks.length === 0) return;

    const timer = setTimeout(() => {
      if (currentIndex < totalAttacks) {
        // Mark current attack as failed if not swiped
        setAttacks(prev => prev.map((a, i) => 
          i === currentIndex && !a.result ? { ...a, result: 'fail' } : a
        ));
        
        const nextIndex = currentIndex + 1;
        if (nextIndex >= totalAttacks) {
          setGameComplete(true);
          const accuracy = Math.round((score / totalAttacks) * 100);
          onComplete({
            success: accuracy >= 50,
            accuracy,
            result: accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 50 ? 'partial' : 'fail'
          });
        } else {
          setCurrentIndex(nextIndex);
        }
      }
    }, timeWindow);

    return () => clearTimeout(timer);
  }, [currentIndex, attacks, totalAttacks, timeWindow, gameComplete, score, onComplete]);

  const handleSwipe = useCallback((direction: Direction) => {
    if (gameComplete || currentIndex >= attacks.length) return;
    
    const currentAttack = attacks[currentIndex];
    if (!currentAttack || currentAttack.result) return;
    
    const isCorrect = currentAttack.direction === direction;
    
    setAttacks(prev => prev.map((a, i) => 
      i === currentIndex ? { ...a, result: isCorrect ? 'success' : 'fail' } : a
    ));
    
    if (isCorrect) {
      setScore(prev => prev + 1);
      setShowResult('success');
    } else {
      setShowResult('fail');
    }
    
    setTimeout(() => {
      setShowResult(null);
      const nextIndex = currentIndex + 1;
      
      if (nextIndex >= totalAttacks) {
        setGameComplete(true);
        const finalScore = isCorrect ? score + 1 : score;
        const accuracy = Math.round((finalScore / totalAttacks) * 100);
        onComplete({
          success: accuracy >= 50,
          accuracy,
          result: accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 50 ? 'partial' : 'fail'
        });
      } else {
        setCurrentIndex(nextIndex);
      }
    }, 300);
  }, [gameComplete, currentIndex, attacks, totalAttacks, score, onComplete]);

  const handleDragEnd = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50;
    const { offset } = info;
    
    let direction: Direction | null = null;
    
    if (Math.abs(offset.x) > Math.abs(offset.y)) {
      if (offset.x > threshold) direction = 'right';
      else if (offset.x < -threshold) direction = 'left';
    } else {
      if (offset.y > threshold) direction = 'down';
      else if (offset.y < -threshold) direction = 'up';
    }
    
    if (direction) {
      handleSwipe(direction);
    }
  }, [handleSwipe]);

  const currentAttack = attacks[currentIndex];
  const Icon = currentAttack ? DIRECTION_ICONS[currentAttack.direction] : null;

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      {/* Title */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-foreground mb-2">Quick Swipe Reactions</h3>
        <p className="text-sm text-muted-foreground">
          Swipe in the direction shown!
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1">
          {attacks.map((attack, i) => (
            <div
              key={attack.id}
              className={`w-2 h-2 rounded-full ${
                attack.result === 'success' 
                  ? 'bg-green-500' 
                  : attack.result === 'fail'
                    ? 'bg-red-500'
                    : i === currentIndex
                      ? 'bg-primary animate-pulse'
                      : 'bg-muted'
              }`}
            />
          ))}
        </div>
        <span className="text-sm text-muted-foreground">{score}/{totalAttacks}</span>
      </div>

      {/* Swipe area */}
      <motion.div
        className={`relative w-48 h-48 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing ${
          showResult === 'success' 
            ? 'bg-green-500/20 border-green-500' 
            : showResult === 'fail'
              ? 'bg-red-500/20 border-red-500'
              : 'bg-muted/30 border-border'
        } border-4`}
        drag
        dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
        dragElastic={0.5}
        onDragEnd={handleDragEnd}
        whileDrag={{ scale: 1.05 }}
      >
        <AnimatePresence mode="wait">
          {Icon && !gameComplete && (
            <motion.div
              key={currentIndex}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              className="text-primary"
            >
              <Icon className="w-20 h-20" strokeWidth={3} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Direction hints */}
        <div className="absolute -top-8 text-muted-foreground">
          <ArrowUp className="w-6 h-6" />
        </div>
        <div className="absolute -bottom-8 text-muted-foreground">
          <ArrowDown className="w-6 h-6" />
        </div>
        <div className="absolute -left-8 text-muted-foreground">
          <ArrowLeft className="w-6 h-6" />
        </div>
        <div className="absolute -right-8 text-muted-foreground">
          <ArrowRight className="w-6 h-6" />
        </div>
      </motion.div>

      {/* Keyboard/button controls */}
      <div className="grid grid-cols-3 gap-2 mt-2">
        <div />
        <button 
          onClick={() => handleSwipe('up')}
          className="p-3 rounded-lg bg-muted hover:bg-muted/80 active:bg-primary/20"
        >
          <ArrowUp className="w-6 h-6 mx-auto" />
        </button>
        <div />
        <button 
          onClick={() => handleSwipe('left')}
          className="p-3 rounded-lg bg-muted hover:bg-muted/80 active:bg-primary/20"
        >
          <ArrowLeft className="w-6 h-6 mx-auto" />
        </button>
        <button 
          onClick={() => handleSwipe('down')}
          className="p-3 rounded-lg bg-muted hover:bg-muted/80 active:bg-primary/20"
        >
          <ArrowDown className="w-6 h-6 mx-auto" />
        </button>
        <button 
          onClick={() => handleSwipe('right')}
          className="p-3 rounded-lg bg-muted hover:bg-muted/80 active:bg-primary/20"
        >
          <ArrowRight className="w-6 h-6 mx-auto" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Body+Mind bonus: +{Math.round(statBonus * 500)}ms reaction time
      </p>
    </div>
  );
};
