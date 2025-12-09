import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowUpDown as ArrowUpDownIcon, Activity, Sparkles } from 'lucide-react';
import { MiniGameResult } from '@/types/astralEncounters';
import { MiniGameHud } from './MiniGameHud';

interface QuickSwipeGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number; // -0.15 to +0.15
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
  difficulty = 'medium',
  questIntervalScale = 0
}: QuickSwipeGameProps) => {
  const [attacks, setAttacks] = useState<Attack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [showResult, setShowResult] = useState<'success' | 'fail' | null>(null);
  const [countdown, setCountdown] = useState(0);
  const completedRef = useRef(false); // Guard against double completion
  const processingRef = useRef(false); // Guard against concurrent swipes
  
  const baseTotalAttacks = difficulty === 'easy' ? 8 : difficulty === 'medium' ? 10 : 12;
  // Quest interval scaling: more quests waited = more attacks
  const totalAttacks = Math.round(baseTotalAttacks * (1 + questIntervalScale));
  const baseAttackSpeed = difficulty === 'easy' ? 2000 : difficulty === 'medium' ? 1600 : 1200;
  // Quest interval scaling: more quests waited = faster attacks
  const attackSpeed = baseAttackSpeed * (1 - questIntervalScale * 0.3);
  
  // Combined stat bonus affects reaction time window
  const statBonus = Math.min((companionStats.body + companionStats.mind) / 200, 1);
  const timeWindow = attackSpeed + (statBonus * 350);
  const difficultyLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  const questDriftPercent = Math.round(questIntervalScale * 100);
  const questDriftLabel = questDriftPercent === 0 
    ? 'Standard volley'
    : `${questDriftPercent > 0 ? '+' : ''}${questDriftPercent}% attacks`;
  const questDriftTone = questDriftPercent > 0 ? 'warning' : questDriftPercent < 0 ? 'positive' : 'default';
  const reactionBonus = Math.round(statBonus * 500);
  const infoChips = [
    { label: 'Difficulty', value: difficultyLabel, tone: 'accent' as const, icon: <ArrowUpDownIcon className="w-3.5 h-3.5" /> },
    { 
      label: 'Quest drift', 
      value: questDriftLabel, 
      tone: questDriftTone,
      helperText: questDriftPercent === 0 ? 'Baseline tempo' : questDriftPercent > 0 ? 'More, faster swipes' : 'Fewer, slower swipes',
      icon: <Activity className="w-3.5 h-3.5" />,
    },
    { 
      label: 'Mind + Body', 
      value: `+${reactionBonus}ms`, 
      tone: 'positive' as const,
      helperText: 'Reaction window',
      icon: <Sparkles className="w-3.5 h-3.5" />,
    },
  ];

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
    if (gameComplete || attacks.length === 0 || completedRef.current) return;

    const timer = setTimeout(() => {
      if (currentIndex < totalAttacks && !completedRef.current) {
        // Mark current attack as failed if not swiped
        setAttacks(prev => prev.map((a, i) => 
          i === currentIndex && !a.result ? { ...a, result: 'fail' } : a
        ));
        
        const nextIndex = currentIndex + 1;
        if (nextIndex >= totalAttacks && !completedRef.current) {
          completedRef.current = true;
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

  useEffect(() => {
    if (gameComplete || completedRef.current) return;
    let frame: number;
    const start = performance.now();
    const animateCountdown = () => {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / timeWindow, 1);
      setCountdown(progress);
      if (progress < 1) {
        frame = requestAnimationFrame(animateCountdown);
      }
    };
    animateCountdown();
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [currentIndex, timeWindow, gameComplete]);

  const handleSwipe = useCallback((direction: Direction) => {
    // Guards against double completion and concurrent processing
    if (gameComplete || completedRef.current || processingRef.current) return;
    if (currentIndex >= attacks.length) return;
    
    const currentAttack = attacks[currentIndex];
    if (!currentAttack || currentAttack.result) return;
    
    processingRef.current = true;
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
      processingRef.current = false;
      const nextIndex = currentIndex + 1;
      
      if (nextIndex >= totalAttacks && !completedRef.current) {
        completedRef.current = true;
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

  const upcomingAttacks = attacks.slice(currentIndex + 1, currentIndex + 3);
  const statusBarContent = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Deflections</p>
          <p className="font-semibold">{score}/{totalAttacks}</p>
        </div>
        <div className="text-xs text-muted-foreground">
          {gameComplete ? 'Wave complete' : `Swipe ${currentIndex + 1} of ${totalAttacks}`}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex gap-1 flex-wrap">
          {attacks.map((attack, i) => (
            <div
              key={attack.id}
              className={`h-2 w-6 rounded-full ${
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
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="uppercase tracking-wider">Up next</span>
          {upcomingAttacks.length === 0 ? (
            <span className="text-muted-foreground/60">—</span>
          ) : (
            upcomingAttacks.map((attack) => {
              const PreviewIcon = DIRECTION_ICONS[attack.direction];
              return (
                <span
                  key={attack.id}
                  className="inline-flex items-center justify-center rounded-full border border-border/60 bg-muted/30 p-1"
                >
                  <PreviewIcon className="w-4 h-4 text-muted-foreground" />
                </span>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  const ringRadius = 70;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const countdownOffset = ringCircumference - countdown * ringCircumference;

  return (
    <MiniGameHud
      title="Quick Swipe Reactions"
      subtitle="Drag in the highlighted direction before the impact circle reaches you."
      eyebrow="Reflex Check"
      chips={infoChips}
      statusBar={statusBarContent}
      footerNote={`Mind + Body bonus: +${reactionBonus}ms reaction window`}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex items-center justify-center">
          <svg className="absolute inset-0 w-60 h-60 -rotate-90" viewBox="0 0 180 180">
            <circle
              cx="90"
              cy="90"
              r={ringRadius}
              stroke="hsl(var(--border))"
              strokeWidth="6"
              fill="transparent"
            />
            <motion.circle
              cx="90"
              cy="90"
              r={ringRadius}
              stroke="hsl(var(--primary))"
              strokeWidth="6"
              strokeDasharray={ringCircumference}
              strokeDashoffset={countdownOffset}
              strokeLinecap="round"
              fill="transparent"
              animate={{ strokeDashoffset: countdownOffset }}
              transition={{ duration: 0.2, ease: 'linear' }}
            />
          </svg>
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
            <AnimatePresence>
              {showResult && (
                <motion.span
                  key={showResult}
                  className={`absolute inset-0 rounded-full border-4 ${
                    showResult === 'success' ? 'border-green-400/60' : 'border-red-400/60'
                  }`}
                  initial={{ opacity: 0.6, scale: 0.8 }}
                  animate={{ opacity: 0, scale: 1.4 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              )}
            </AnimatePresence>
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
            <div className="absolute bottom-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {currentAttack ? currentAttack.direction : 'Ready'}
            </div>

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
        </div>

        <div className="grid grid-cols-3 gap-2">
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
      </div>
    </MiniGameHud>
  );
};
