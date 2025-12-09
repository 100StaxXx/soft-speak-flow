import { useState, useEffect, useCallback, useRef, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Gauge, Activity, Sparkles } from 'lucide-react';
import { MiniGameResult } from '@/types/astralEncounters';
import { MiniGameHud } from './MiniGameHud';

interface EnergyBeamGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number; // -0.15 to +0.15
}

export const EnergyBeamGame = ({ 
  companionStats, 
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0
}: EnergyBeamGameProps) => {
  const [isCharging, setIsCharging] = useState(false);
  const [chargeLevel, setChargeLevel] = useState(0);
  const [released, setReleased] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [hits, setHits] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  
  const chargeRef = useRef<NodeJS.Timeout | null>(null);
  const maxAttempts = 3;

  // Sweet spot calculation based on body stat
  const bodyBonus = Math.min(companionStats.body / 100, 1);
  const baseSweetSpotSize = difficulty === 'easy' ? 18 : difficulty === 'medium' ? 14 : 10;
  // Quest interval scaling: more quests waited = smaller sweet spot
  const sweetSpotSize = baseSweetSpotSize * (1 - questIntervalScale * 0.5);
  const adjustedSweetSpotSize = sweetSpotSize + (bodyBonus * 6); // Body stat widens sweet spot
  
  // Sweet spot position (randomized each attempt)
  const [sweetSpotStart, setSweetSpotStart] = useState(40);
  
  useEffect(() => {
    // Randomize sweet spot position for each attempt
    const newStart = 30 + Math.random() * 30; // Between 30-60
    setSweetSpotStart(newStart);
  }, [attempts]);

  const sweetSpotEnd = sweetSpotStart + adjustedSweetSpotSize;
  const difficultyLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  const questDriftPercent = Math.round(questIntervalScale * 100);
  const questDriftLabel = questDriftPercent === 0 
    ? 'Balanced pace' 
    : `${questDriftPercent > 0 ? '+' : ''}${questDriftPercent}% tempo`;
  const questDriftTone = questDriftPercent > 0 ? 'warning' : questDriftPercent < 0 ? 'positive' : 'default';
  const bodyBonusPercent = Math.round(bodyBonus * 10);

  const infoChips = [
    {
      label: 'Difficulty',
      value: difficultyLabel,
      tone: 'accent' as const,
      icon: <Gauge className="w-3.5 h-3.5" />,
    },
    {
      label: 'Quest drift',
      value: questDriftLabel,
      tone: questDriftTone,
      helperText:
        questDriftPercent === 0
          ? 'Standard timing'
          : questDriftPercent > 0
            ? 'Faster charge, tighter window'
            : 'Slower charge, wider window',
      icon: <Activity className="w-3.5 h-3.5" />,
    },
    {
      label: 'Body boost',
      value: `+${bodyBonusPercent}% window`,
      tone: 'positive' as const,
      helperText: 'Sweet spot width',
      icon: <Sparkles className="w-3.5 h-3.5" />,
    },
  ];

  const startCharging = useCallback(() => {
    if (gameComplete || released) return;
    setIsCharging(true);
    setChargeLevel(0);
    
    chargeRef.current = setInterval(() => {
      setChargeLevel(prev => {
        if (prev >= 100) {
          return 100;
        }
        // Quest interval scaling: more quests waited = faster charge
        return prev + 2.5 * (1 + questIntervalScale);
      });
    }, 25);
  }, [gameComplete, released, questIntervalScale]);

  const releaseBeam = useCallback(() => {
    if (!isCharging || gameComplete) return;
    
    setIsCharging(false);
    setReleased(true);
    
    if (chargeRef.current) {
      clearInterval(chargeRef.current);
    }

    // Check if in sweet spot
    const isHit = chargeLevel >= sweetSpotStart && chargeLevel <= sweetSpotEnd;
    
    if (isHit) {
      setHits(prev => prev + 1);
    }

    // Show result briefly
    setShowResult(true);
    
    setTimeout(() => {
      setShowResult(false);
      setReleased(false);
      setChargeLevel(0);
      
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      if (newAttempts >= maxAttempts) {
        setGameComplete(true);
        const accuracy = Math.round((hits + (isHit ? 1 : 0)) / maxAttempts * 100);
        const finalHits = hits + (isHit ? 1 : 0);
        
        onComplete({
          success: finalHits >= 2,
          accuracy,
          result: accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 50 ? 'partial' : 'fail'
        });
      }
    }, 1000);
  }, [isCharging, chargeLevel, sweetSpotStart, sweetSpotEnd, attempts, hits, gameComplete, onComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chargeRef.current) {
        clearInterval(chargeRef.current);
      }
    };
  }, []);

  const isInSweetSpot = chargeLevel >= sweetSpotStart && chargeLevel <= sweetSpotEnd;
  const sweetSpotRangeLabel = `${Math.round(sweetSpotStart)}% - ${Math.round(sweetSpotEnd)}%`;
  const precisionStatus = isInSweetSpot
    ? 'Aligned'
    : chargeLevel === 0
      ? 'Waiting'
      : chargeLevel < sweetSpotStart
        ? 'Too early'
        : 'Overcharged';
  const statusBarContent = (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Attempts</span>
          <span>{Math.min(attempts + (released ? 1 : 0), maxAttempts)}/{maxAttempts}</span>
        </div>
        <div className="flex gap-2 justify-center">
          {Array.from({ length: maxAttempts }).map((_, i) => (
            <div
              key={i}
              className={`h-2.5 w-8 rounded-full ${
                i < attempts 
                  ? i < hits 
                    ? 'bg-green-500'
                    : 'bg-red-500/80'
                  : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Precision window</span>
          <span className={`font-semibold text-xs ${isInSweetSpot ? 'text-emerald-400' : 'text-amber-400'}`}>
            {precisionStatus}
          </span>
        </div>
        <div className="relative h-2 rounded-full bg-muted/40 overflow-hidden">
          <div 
            className="absolute inset-y-0 bg-primary/20"
            style={{ left: `${sweetSpotStart}%`, width: `${adjustedSweetSpotSize}%` }}
          />
          <motion.div 
            className="absolute inset-y-0 bg-foreground/70"
            style={{ width: `${chargeLevel}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
          <span>0%</span>
          <span>{sweetSpotRangeLabel}</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
  const gradientId = useId();
  const ringRadius = 58;
  const circumference = 2 * Math.PI * ringRadius;
  const chargeProgress = chargeLevel / 100;
  const dashOffset = circumference - chargeProgress * circumference;

  return (
    <MiniGameHud
      title="Energy Beam Harmonization"
      subtitle="Hold to charge and release power inside the shimmering window."
      eyebrow="Beam Resonance"
      chips={infoChips}
      statusBar={statusBarContent}
      footerNote={`Body stat bonus: +${bodyBonusPercent}% sweet spot size`}
    >
      <div className="flex flex-col items-center gap-6">
        {/* Charge bar */}
        <div className="relative w-full max-w-xs h-16 bg-muted/30 rounded-xl overflow-hidden border border-border/50">
          {/* Sweet spot indicator */}
          <div 
            className="absolute top-0 bottom-0 bg-primary/30 border-x-2 border-primary"
            style={{ 
              left: `${sweetSpotStart}%`, 
              width: `${adjustedSweetSpotSize}%` 
            }}
          >
            <div className="absolute inset-0 animate-pulse bg-primary/20" />
          </div>
          
          {/* Charge level */}
          <motion.div 
            className={`absolute top-0 bottom-0 left-0 ${
              isInSweetSpot ? 'bg-primary' : 'bg-accent'
            }`}
            style={{ width: `${chargeLevel}%` }}
            animate={{ 
              boxShadow: isInSweetSpot 
                ? '0 0 20px hsl(var(--primary))' 
                : 'none'
            }}
          />

          {/* Charge indicator */}
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 w-1 h-12 bg-foreground rounded-full"
            style={{ left: `${chargeLevel}%` }}
            animate={{ 
              scale: isCharging ? [1, 1.2, 1] : 1,
            }}
            transition={{ repeat: Infinity, duration: 0.3 }}
          />
        </div>

        {/* Result feedback */}
        <AnimatePresence>
          {showResult && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className={`text-2xl font-bold ${
                chargeLevel >= sweetSpotStart && chargeLevel <= sweetSpotEnd
                  ? 'text-green-500'
                  : 'text-red-500'
              }`}
            >
              {chargeLevel >= sweetSpotStart && chargeLevel <= sweetSpotEnd
                ? '✨ Perfect Hit!'
                : '💨 Missed!'}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Charge button */}
        {!gameComplete && (
          <div className="flex flex-col items-center gap-3">
            <div className="relative flex items-center justify-center">
              <svg className="absolute inset-0 h-32 w-32 -rotate-90" viewBox="0 0 140 140">
                <circle
                  cx="70"
                  cy="70"
                  r={ringRadius}
                  className="text-border/40"
                  strokeWidth="6"
                  stroke="currentColor"
                  fill="transparent"
                />
                <motion.circle
                  cx="70"
                  cy="70"
                  r={ringRadius}
                  strokeWidth="6"
                  stroke={`url(#${gradientId})`}
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  animate={{ strokeDashoffset: dashOffset }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                />
                <defs>
                  <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="hsl(var(--primary))" />
                    <stop offset="100%" stopColor="hsl(var(--accent))" />
                  </linearGradient>
                </defs>
              </svg>
              <motion.button
                className="relative z-10 w-28 h-28 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center border-4 border-white/20 shadow-[0_0_35px_rgba(255,255,255,0.25)]"
                onMouseDown={startCharging}
                onMouseUp={releaseBeam}
                onMouseLeave={releaseBeam}
                onTouchStart={startCharging}
                onTouchEnd={releaseBeam}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={{
                  boxShadow: isCharging
                    ? [
                        '0 0 20px hsl(var(--primary))',
                        '0 0 35px hsl(var(--primary))',
                        '0 0 20px hsl(var(--primary))',
                      ]
                    : '0 0 15px hsl(var(--primary) / 0.4)',
                }}
                transition={{ repeat: isCharging ? Infinity : 0, duration: 0.6 }}
              >
                <Zap className={`w-12 h-12 text-primary-foreground ${isCharging ? 'animate-pulse' : ''}`} />
              </motion.button>
            </div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              {isCharging ? 'Release in the glow' : 'Hold to charge'}
            </p>
          </div>
        )}
      </div>
  </MiniGameHud>
  );
};
