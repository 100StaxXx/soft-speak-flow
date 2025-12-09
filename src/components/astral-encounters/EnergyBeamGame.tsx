import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap } from 'lucide-react';
import { MiniGameResult } from '@/types/astralEncounters';

interface EnergyBeamGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export const EnergyBeamGame = ({ 
  companionStats, 
  onComplete,
  difficulty = 'medium' 
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
  const sweetSpotSize = difficulty === 'easy' ? 25 : difficulty === 'medium' ? 20 : 15;
  const adjustedSweetSpotSize = sweetSpotSize + (bodyBonus * 10); // Body stat widens sweet spot
  
  // Sweet spot position (randomized each attempt)
  const [sweetSpotStart, setSweetSpotStart] = useState(40);
  
  useEffect(() => {
    // Randomize sweet spot position for each attempt
    const newStart = 30 + Math.random() * 30; // Between 30-60
    setSweetSpotStart(newStart);
  }, [attempts]);

  const sweetSpotEnd = sweetSpotStart + adjustedSweetSpotSize;

  const startCharging = useCallback(() => {
    if (gameComplete || released) return;
    setIsCharging(true);
    setChargeLevel(0);
    
    chargeRef.current = setInterval(() => {
      setChargeLevel(prev => {
        if (prev >= 100) {
          // Auto-release if maxed out
          return 100;
        }
        return prev + 2;
      });
    }, 30);
  }, [gameComplete, released]);

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

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      {/* Title */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-foreground mb-2">Energy Beam Harmonization</h3>
        <p className="text-sm text-muted-foreground">
          Hold to charge, release in the glowing zone!
        </p>
      </div>

      {/* Attempts counter */}
      <div className="flex gap-2">
        {Array.from({ length: maxAttempts }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full ${
              i < attempts 
                ? i < hits 
                  ? 'bg-green-500' 
                  : 'bg-red-500'
                : 'bg-muted'
            }`}
          />
        ))}
      </div>

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
        <motion.button
          className="w-32 h-32 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center border-4 border-primary/50"
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
                  '0 0 40px hsl(var(--primary))',
                  '0 0 20px hsl(var(--primary))',
                ]
              : '0 0 10px hsl(var(--primary) / 0.5)',
          }}
          transition={{ repeat: isCharging ? Infinity : 0, duration: 0.5 }}
        >
          <Zap className={`w-12 h-12 text-primary-foreground ${isCharging ? 'animate-pulse' : ''}`} />
        </motion.button>
      )}

      <p className="text-xs text-muted-foreground">
        Body stat bonus: +{Math.round(bodyBonus * 10)}% sweet spot
      </p>
    </div>
  );
};
