import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Sparkles, Star } from 'lucide-react';
import { MiniGameResult } from '@/types/astralEncounters';
import { MiniGameHud } from './MiniGameHud';

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
  const maxRounds = 3;
  const baseStarCount = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 5 : 6;
  const starCount = Math.round(baseStarCount * (1 + questIntervalScale * 0.3));

  // Soul stat affects fade time
  const soulBonus = Math.min(companionStats.soul / 100, 1);
  const baseFadeTime = difficulty === 'easy' ? 4000 : difficulty === 'medium' ? 3000 : 2500;
  const fadeTime = baseFadeTime * (1 - questIntervalScale * 0.2) + soulBonus * 1000;

  const [stars, setStars] = useState<Star[]>([]);
  const [currentOrder, setCurrentOrder] = useState(1);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [totalStars, setTotalStars] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [connections, setConnections] = useState<number[][]>([]);
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [constellationName, setConstellationName] = useState<string>('Constellation');
  const [fadeRemaining, setFadeRemaining] = useState(fadeTime);
  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fadeProgressRef = useRef<number | null>(null);

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
    setConstellationName(constellation.name);
    setFadeRemaining(fadeTime);
  }, [starCount, fadeTime]);

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
  }, [stars.length, round, fadeTime, gameComplete, handleRoundEnd]);

  useEffect(() => {
    if (stars.length === 0 || gameComplete) return;
    
    const start = performance.now();
    setFadeRemaining(fadeTime);

    const tick = () => {
      const elapsed = performance.now() - start;
      setFadeRemaining(Math.max(fadeTime - elapsed, 0));
      if (elapsed < fadeTime && !gameComplete) {
        fadeProgressRef.current = requestAnimationFrame(tick);
      }
    };

    fadeProgressRef.current = requestAnimationFrame(tick);

    return () => {
      if (fadeProgressRef.current) {
        cancelAnimationFrame(fadeProgressRef.current);
      }
    };
  }, [stars, fadeTime, gameComplete]);

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

  const difficultyLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  const questDriftPercent = Math.round(questIntervalScale * 100);
  const questDriftLabel = questDriftPercent === 0 
    ? 'Balanced map'
    : `${questDriftPercent > 0 ? '+' : ''}${questDriftPercent}% stars`;
  const questDriftTone = questDriftPercent > 0 ? 'warning' : questDriftPercent < 0 ? 'positive' : 'default';
  const soulBonusMs = Math.round(soulBonus * 1000);
  const infoChips = [
    { label: 'Difficulty', value: difficultyLabel, tone: 'accent' as const, icon: <Star className="w-3.5 h-3.5" /> },
    { label: 'Constellation', value: constellationName, helperText: 'Pattern', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { 
      label: 'Quest drift', 
      value: questDriftLabel, 
      tone: questDriftTone,
      helperText: questDriftPercent === 0 ? 'Standard nodes' : questDriftPercent > 0 ? 'More stars' : 'Fewer stars',
      icon: <Activity className="w-3.5 h-3.5" />,
    },
    { 
      label: 'Soul focus', 
      value: `+${soulBonusMs}ms`, 
      tone: 'positive' as const,
      helperText: 'Fade buffer',
      icon: <Sparkles className="w-3.5 h-3.5" />,
    },
  ];
  const fadePercent = Math.max(0, Math.round((fadeRemaining / fadeTime) * 100));
  const statusBarContent = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Round</p>
          <p className="font-semibold">{round}/{maxRounds}</p>
        </div>
        <div className="text-xs text-muted-foreground">
          Score {score}
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Star visibility</span>
          <span>{Math.ceil(fadeRemaining / 1000)}s</span>
        </div>
        <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            style={{ width: `${100 - fadePercent}%` }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <MiniGameHud
      title="Constellation Trace"
      subtitle="Connect the stars in order before their light fades."
      eyebrow="Stellar Cartography"
      chips={infoChips}
      statusBar={statusBarContent}
      footerNote={`Soul stat bonus: +${soulBonusMs}ms fade time`}
    >
      <div className="relative w-full aspect-square max-w-xs bg-muted/20 rounded-2xl border border-border/50 overflow-hidden mx-auto">
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

        <div className="absolute top-3 left-3 rounded-full bg-black/35 px-3 py-1 text-xs text-white/80 backdrop-blur capitalize">
          {constellationName}
        </div>
        <div className="absolute top-3 right-3 text-right text-xs text-white/70">
          <p className="uppercase tracking-[0.3em] text-[9px]">Fade</p>
          <p className="font-semibold text-sm">{Math.ceil(fadeRemaining / 1000)}s</p>
        </div>

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
    </MiniGameHud>
  );
};