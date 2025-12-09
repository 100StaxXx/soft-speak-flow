import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';

interface ConstellationTraceGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
}

interface Star {
  id: number;
  x: number;
  y: number;
  order: number;
  connected: boolean;
  fading: boolean;
}

const CONSTELLATIONS = [
  // Simple patterns for different difficulties
  { name: 'Triangle', points: [[50, 20], [20, 80], [80, 80]] },
  { name: 'Diamond', points: [[50, 10], [80, 50], [50, 90], [20, 50]] },
  { name: 'Arrow', points: [[50, 10], [30, 40], [50, 30], [70, 40], [50, 10]] },
  { name: 'Zigzag', points: [[10, 30], [30, 70], [50, 30], [70, 70], [90, 30]] },
  { name: 'Crown', points: [[10, 70], [25, 30], [50, 60], [75, 30], [90, 70]] },
];

export const ConstellationTraceGame = ({
  companionStats,
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0,
}: ConstellationTraceGameProps) => {
  const [stars, setStars] = useState<Star[]>([]);
  const [currentOrder, setCurrentOrder] = useState(1);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [totalStars, setTotalStars] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [connections, setConnections] = useState<number[][]>([]);
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);
  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const maxRounds = 3;
  const baseStarCount = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 5 : 6;
  const starCount = Math.round(baseStarCount * (1 + questIntervalScale * 0.3));

  // Soul stat affects fade time
  const soulBonus = Math.min(companionStats.soul / 100, 1);
  const baseFadeTime = difficulty === 'easy' ? 4000 : difficulty === 'medium' ? 3000 : 2500;
  const fadeTime = baseFadeTime * (1 - questIntervalScale * 0.2) + soulBonus * 1000;

  // Generate stars for current round
  const generateStars = useCallback(() => {
    const constellation = CONSTELLATIONS[Math.floor(Math.random() * CONSTELLATIONS.length)];
    const numStars = Math.min(starCount, constellation.points.length);
    
    const newStars: Star[] = [];
    for (let i = 0; i < numStars; i++) {
      const point = constellation.points[i % constellation.points.length];
      // Add slight randomization to positions
      const offsetX = (Math.random() - 0.5) * 10;
      const offsetY = (Math.random() - 0.5) * 10;
      
      newStars.push({
        id: i,
        x: Math.max(10, Math.min(90, point[0] + offsetX)),
        y: Math.max(10, Math.min(90, point[1] + offsetY)),
        order: i + 1,
        connected: false,
        fading: false,
      });
    }
    
    setStars(newStars);
    setTotalStars(prev => prev + numStars);
    setConnections([]);
    setCurrentOrder(1);
  }, [starCount]);

  // Initialize game
  useEffect(() => {
    generateStars();
  }, [generateStars]);

  // Start fade timer for stars
  useEffect(() => {
    if (stars.length === 0 || gameComplete) return;

    fadeTimerRef.current = setTimeout(() => {
      setStars(prev => prev.map(s => ({ ...s, fading: true })));
      
      // After fade animation, mark remaining as failed
      setTimeout(() => {
        if (!gameComplete) {
          handleRoundEnd();
        }
      }, 1000);
    }, fadeTime);

    return () => {
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
      }
    };
  }, [stars.length, round, fadeTime, gameComplete]);

  const handleRoundEnd = useCallback(() => {
    const connectedCount = stars.filter(s => s.connected).length;
    
    if (round < maxRounds) {
      setTimeout(() => {
        setRound(prev => prev + 1);
        generateStars();
      }, 500);
    } else {
      setGameComplete(true);
      const accuracy = Math.round((score + connectedCount) / totalStars * 100);
      onComplete({
        success: accuracy >= 50,
        accuracy,
        result: accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 50 ? 'partial' : 'fail',
      });
    }
  }, [round, stars, score, totalStars, generateStars, onComplete]);

  const handleStarTap = useCallback((star: Star) => {
    if (gameComplete || star.connected || star.fading) return;

    if (star.order === currentOrder) {
      // Correct tap
      setStars(prev => prev.map(s =>
        s.id === star.id ? { ...s, connected: true } : s
      ));
      
      // Add connection line
      if (currentOrder > 1) {
        const prevStar = stars.find(s => s.order === currentOrder - 1);
        if (prevStar) {
          setConnections(prev => [...prev, [prevStar.x, prevStar.y, star.x, star.y]]);
        }
      }
      
      setScore(prev => prev + 1);
      setCurrentOrder(prev => prev + 1);
      setShowFeedback('correct');
      
      // Check if round complete
      if (currentOrder === stars.length) {
        if (fadeTimerRef.current) {
          clearTimeout(fadeTimerRef.current);
        }
        
        if (round < maxRounds) {
          setTimeout(() => {
            setRound(prev => prev + 1);
            generateStars();
          }, 500);
        } else {
          setGameComplete(true);
          const finalScore = score + stars.length;
          const accuracy = Math.round(finalScore / totalStars * 100);
          onComplete({
            success: accuracy >= 50,
            accuracy,
            result: accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 50 ? 'partial' : 'fail',
          });
        }
      }
    } else {
      setShowFeedback('wrong');
    }

    setTimeout(() => setShowFeedback(null), 300);
  }, [gameComplete, currentOrder, stars, round, score, totalStars, generateStars, onComplete]);

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="text-center">
        <h3 className="text-xl font-bold text-foreground mb-2">Constellation Trace</h3>
        <p className="text-sm text-muted-foreground">
          Connect the stars in order before they fade!
        </p>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">Round {round}/{maxRounds}</span>
        <span className="text-primary">Score: {score}</span>
      </div>

      {/* Game area */}
      <div className="relative w-full aspect-square max-w-xs bg-muted/20 rounded-2xl border border-border/50 overflow-hidden">
        {/* Starfield background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-foreground/30 rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            />
          ))}
        </div>

        {/* Connection lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {connections.map((conn, i) => (
            <motion.line
              key={i}
              x1={`${conn[0]}%`}
              y1={`${conn[1]}%`}
              x2={`${conn[2]}%`}
              y2={`${conn[3]}%`}
              stroke="hsl(var(--primary))"
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              style={{ filter: 'drop-shadow(0 0 6px hsl(var(--primary)))' }}
            />
          ))}
        </svg>

        {/* Stars */}
        <AnimatePresence>
          {stars.map((star) => {
            const isNext = star.order === currentOrder && !star.connected;
            
            return (
              <motion.button
                key={star.id}
                className={`absolute w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  star.connected
                    ? 'bg-primary border-2 border-primary shadow-lg'
                    : star.fading
                      ? 'bg-muted/30 border border-muted opacity-30'
                      : isNext
                        ? 'bg-accent/50 border-2 border-accent animate-pulse'
                        : 'bg-muted/50 border border-border hover:bg-muted'
                }`}
                style={{
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  transform: 'translate(-50%, -50%)',
                  boxShadow: star.connected
                    ? '0 0 20px hsl(var(--primary))'
                    : isNext
                      ? '0 0 15px hsl(var(--accent))'
                      : 'none',
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: star.fading ? 0.5 : isNext ? 1.2 : 1,
                  opacity: star.fading ? 0.3 : 1,
                }}
                exit={{ scale: 0, opacity: 0 }}
                onClick={() => handleStarTap(star)}
                disabled={star.connected || star.fading}
              >
                <span className={`text-xs font-bold ${star.connected ? 'text-primary-foreground' : 'text-foreground'}`}>
                  {star.order}
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>

        {/* Feedback overlay */}
        <AnimatePresence>
          {showFeedback && (
            <motion.div
              className={`absolute inset-0 ${
                showFeedback === 'correct' ? 'bg-green-500/20' : 'bg-red-500/20'
              }`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>
      </div>

      <p className="text-xs text-muted-foreground">
        Soul stat bonus: +{Math.round(soulBonus * 1000)}ms fade time
      </p>
    </div>
  );
};