import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Eye, Sparkles } from 'lucide-react';
import { MiniGameResult } from '@/types/astralEncounters';
import { MiniGameHud } from './MiniGameHud';

interface TapSequenceGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number; // -0.15 to +0.15 (2 quests = easier, 4 = harder)
}

interface Orb {
  id: number;
  x: number;
  y: number;
  order: number;
  tapped: boolean;
}

export const TapSequenceGame = ({ 
  companionStats, 
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0
}: TapSequenceGameProps) => {
  const [orbs, setOrbs] = useState<Orb[]>([]);
  const [currentOrder, setCurrentOrder] = useState(1);
  const [showSequence, setShowSequence] = useState(true);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);

  const maxRounds = 3;
  const baseOrbsPerRound = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 5 : 6;
  // Quest interval scaling: more quests waited = more orbs
  const orbsPerRound = Math.round(baseOrbsPerRound * (1 + questIntervalScale));
  
  // Mind stat affects timing forgiveness (longer display time)
  const mindBonus = Math.min(companionStats.mind / 100, 1);
  const baseDisplayTime = 500 + (mindBonus * 300); // 500-800ms per orb
  // Quest interval scaling: more quests waited = less display time
  const displayTime = baseDisplayTime * (1 - questIntervalScale * 0.5);
  const difficultyLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  const questDriftPercent = Math.round(questIntervalScale * 100);
  const questDriftLabel = questDriftPercent === 0 
    ? 'Standard cadence'
    : `${questDriftPercent > 0 ? '+' : ''}${questDriftPercent}% orbit count`;
  const questDriftTone = questDriftPercent > 0 ? 'warning' : questDriftPercent < 0 ? 'positive' : 'default';
  const mindBonusMs = Math.round(mindBonus * 400);
  const infoChips = [
    { label: 'Difficulty', value: difficultyLabel, tone: 'accent' as const, icon: <Target className="w-3.5 h-3.5" /> },
    { 
      label: 'Quest drift', 
      value: questDriftLabel, 
      tone: questDriftTone,
      helperText: questDriftPercent === 0 ? 'Baseline memory' : questDriftPercent > 0 ? 'More nodes visible' : 'Fewer nodes',
      icon: <Sparkles className="w-3.5 h-3.5" />,
    },
    { 
      label: 'Mind focus', 
      value: `+${mindBonusMs}ms`, 
      tone: 'positive' as const,
      helperText: 'Reveal duration',
      icon: <Eye className="w-3.5 h-3.5" />,
    },
  ];

  // Generate orbs for current round
  const generateOrbs = useCallback(() => {
    const newOrbs: Orb[] = [];
    for (let i = 0; i < orbsPerRound; i++) {
      newOrbs.push({
        id: i,
        x: 15 + Math.random() * 70, // 15-85% of width
        y: 15 + Math.random() * 60, // 15-75% of height
        order: i + 1,
        tapped: false,
      });
    }
    setOrbs(newOrbs);
  }, [orbsPerRound]);

  // Initialize game
  useEffect(() => {
    generateOrbs();
  }, [generateOrbs]);

  // Show sequence animation
  useEffect(() => {
    if (!showSequence || orbs.length === 0) return;

    const timer = setTimeout(() => {
      if (highlightIndex < orbs.length) {
        setHighlightIndex(prev => prev + 1);
      } else {
        setShowSequence(false);
        setHighlightIndex(0);
      }
    }, displayTime);

    return () => clearTimeout(timer);
  }, [showSequence, highlightIndex, orbs.length, displayTime]);

  const handleOrbTap = useCallback((orb: Orb) => {
    if (showSequence || gameComplete || orb.tapped) return;

    if (orb.order === currentOrder) {
      // Correct tap
      setOrbs(prev => prev.map(o => 
        o.id === orb.id ? { ...o, tapped: true } : o
      ));
      setCurrentOrder(prev => prev + 1);
      setScore(prev => prev + 1);

      // Check if round complete
      if (currentOrder === orbsPerRound) {
        const newRound = round + 1;
        
        if (newRound > maxRounds) {
          // Game complete
          setGameComplete(true);
          const totalOrbs = maxRounds * orbsPerRound;
          const accuracy = Math.round(((score + 1) / totalOrbs) * 100);
          
          onComplete({
            success: accuracy >= 50,
            accuracy,
            result: accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 50 ? 'partial' : 'fail'
          });
        } else {
          // Next round
          setTimeout(() => {
            setRound(newRound);
            setCurrentOrder(1);
            setShowSequence(true);
            setHighlightIndex(0);
            generateOrbs();
          }, 500);
        }
      }
    } else {
      // Wrong tap
      setMistakes(prev => prev + 1);
      
      // Visual feedback
      const element = document.getElementById(`orb-${orb.id}`);
      if (element) {
        element.classList.add('shake');
        setTimeout(() => element.classList.remove('shake'), 300);
      }
    }
  }, [showSequence, gameComplete, currentOrder, orbsPerRound, round, score, generateOrbs, onComplete]);

  const phaseLabel = showSequence ? 'Memorize pattern' : 'Tap the order';
  const phaseToneClass = showSequence ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300';
  const statusBarContent = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Round</p>
          <p className="font-semibold">{round}/{maxRounds}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${phaseToneClass}`}>
          {phaseLabel}
        </div>
        <div className="text-xs text-muted-foreground">
          Score {score} · Mistakes {mistakes}
        </div>
      </div>
      <div className="flex justify-center flex-wrap gap-1">
        {Array.from({ length: orbsPerRound }).map((_, idx) => {
          const order = idx + 1;
          const isCleared = !showSequence && order < currentOrder;
          const isActive = showSequence ? order === highlightIndex : order === currentOrder;
          const isPreviewed = showSequence && order < highlightIndex;
          return (
            <div
              key={order}
              className={`h-2 w-8 rounded-full ${
                isCleared
                  ? 'bg-green-500'
                  : isActive
                    ? 'bg-primary animate-pulse'
                    : isPreviewed
                      ? 'bg-primary/40'
                      : 'bg-muted'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
  const tracedLines = orbs.reduce<
    { id: string; x1: number; y1: number; x2: number; y2: number; intensity: number }[]
  >((acc, orb) => {
    const next = orbs.find((o) => o.order === orb.order + 1);
    if (!next) return acc;
    const revealThreshold = showSequence ? highlightIndex : currentOrder;
    const shouldReveal = revealThreshold > orb.order;
    const lockedIn = orb.tapped && next.tapped;
    if (!shouldReveal && !lockedIn) return acc;
    acc.push({
      id: `${orb.id}-${next.id}`,
      x1: orb.x,
      y1: orb.y,
      x2: next.x,
      y2: next.y,
      intensity: lockedIn ? 1 : 0.35,
    });
    return acc;
  }, []);

  return (
    <MiniGameHud
      title="Cosmic Tap Sequence"
      subtitle={showSequence ? 'Watch the orbiting lights.' : 'Recreate the cosmic path.'}
      eyebrow="Memory Trial"
      chips={infoChips}
      statusBar={statusBarContent}
      footerNote={`Mind stat bonus: +${mindBonusMs}ms display time`}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-full aspect-square max-w-xs bg-muted/20 rounded-2xl border border-border/50 overflow-hidden">
          {/* Cosmic background effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {tracedLines.map((line) => (
              <motion.line
                key={line.id}
                x1={`${line.x1}%`}
                y1={`${line.y1}%`}
                x2={`${line.x2}%`}
                y2={`${line.y2}%`}
                stroke="hsl(var(--primary))"
                strokeWidth={line.intensity > 0.5 ? 4 : 2}
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: line.intensity }}
                transition={{ duration: 0.35 }}
                style={{ filter: 'drop-shadow(0 0 6px hsl(var(--primary)))' }}
              />
            ))}
          </svg>
          
          <AnimatePresence>
            {orbs.map((orb) => {
              const isHighlighted = showSequence && highlightIndex === orb.order;
              const isPast = showSequence && highlightIndex > orb.order;
              
              return (
                <motion.button
                  key={orb.id}
                  id={`orb-${orb.id}`}
                  className={`absolute w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold transition-all ${
                    orb.tapped 
                      ? 'bg-green-500 border-green-400 text-white' 
                      : isHighlighted
                        ? 'bg-primary border-primary text-primary-foreground scale-125 shadow-lg shadow-primary/50'
                        : isPast
                          ? 'bg-primary/50 border-primary/50 text-primary-foreground'
                          : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
                  }`}
                  style={{
                    left: `${orb.x}%`,
                    top: `${orb.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ 
                    scale: isHighlighted ? 1.25 : 1, 
                    opacity: 1,
                    boxShadow: isHighlighted ? '0 0 30px hsl(var(--primary))' : 'none'
                  }}
                  exit={{ scale: 0, opacity: 0 }}
                  onClick={() => handleOrbTap(orb)}
                  disabled={showSequence || orb.tapped}
                >
                  {showSequence && orb.order}
                </motion.button>
              );
            })}
          </AnimatePresence>
          <AnimatePresence>
            {showSequence && (
              <motion.div
                key="sequenceOverlay"
                className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/35 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-white/80 backdrop-blur"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                Memorize the arc
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <style>{`
          @keyframes shake {
            0%, 100% { transform: translate(-50%, -50%); }
            25% { transform: translate(calc(-50% - 5px), -50%); }
            75% { transform: translate(calc(-50% + 5px), -50%); }
          }
          .shake {
            animation: shake 0.3s ease-in-out;
          }
        `}</style>
      </div>
    </MiniGameHud>
  );
};
