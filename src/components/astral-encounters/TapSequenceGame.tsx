import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';

interface TapSequenceGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
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
  difficulty = 'medium' 
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
  const orbsPerRound = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 5 : 6;
  
  // Mind stat affects timing forgiveness (longer display time)
  const mindBonus = Math.min(companionStats.mind / 100, 1);
  const displayTime = 500 + (mindBonus * 300); // 500-800ms per orb (faster)

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

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* Title */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-foreground mb-2">Cosmic Tap Sequence</h3>
        <p className="text-sm text-muted-foreground">
          {showSequence ? 'Watch the sequence...' : 'Tap in order!'}
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">Round {round}/{maxRounds}</span>
        <span className="text-primary">Score: {score}</span>
        <span className="text-red-500">Mistakes: {mistakes}</span>
      </div>

      {/* Game area */}
      <div className="relative w-full aspect-square max-w-xs bg-muted/20 rounded-2xl border border-border/50 overflow-hidden">
        {/* Cosmic background effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        
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
      </div>

      <p className="text-xs text-muted-foreground">
        Mind stat bonus: +{Math.round(mindBonus * 400)}ms display time
      </p>

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
  );
};
