import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap } from 'lucide-react';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic } from './gameUtils';

interface EnergyBeamGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
}

// Memoized attempt indicator dots
const AttemptDots = memo(({ 
  maxAttempts, 
  attempts, 
  hits 
}: { 
  maxAttempts: number; 
  attempts: number; 
  hits: number;
}) => (
  <div className="flex gap-3 mb-4">
    {Array.from({ length: maxAttempts }).map((_, i) => (
      <div
        key={i}
        className={`w-4 h-4 rounded-full border-2 transition-all ${
          i < attempts 
            ? i < hits 
              ? 'bg-green-500 border-green-400' 
              : 'bg-red-500 border-red-400'
            : i === attempts
              ? 'border-primary bg-primary/20 scale-pulse'
              : 'border-muted bg-muted/20'
        }`}
      />
    ))}
  </div>
));
AttemptDots.displayName = 'AttemptDots';

// Memoized charge bar component
const ChargeBar = memo(({ 
  chargeLevel, 
  sweetSpotStart, 
  adjustedSweetSpotSize, 
  isInSweetSpot, 
  isPerfectZone,
  isCharging,
  pulseRing,
}: { 
  chargeLevel: number;
  sweetSpotStart: number;
  adjustedSweetSpotSize: number;
  isInSweetSpot: boolean;
  isPerfectZone: boolean;
  isCharging: boolean;
  pulseRing: boolean;
}) => (
  <div className="relative w-full max-w-xs h-20 mb-6">
    {/* Background track */}
    <div className="absolute inset-0 bg-muted/30 rounded-2xl overflow-hidden border border-border/50 backdrop-blur-sm">
      {/* Sweet spot indicator with gradient */}
      <div 
        className="absolute top-0 bottom-0 overflow-hidden"
        style={{ 
          left: `${sweetSpotStart}%`, 
          width: `${adjustedSweetSpotSize}%` 
        }}
      >
        {/* Outer zone */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/30 via-primary/50 to-primary/30" />
        
        {/* Perfect zone (inner) */}
        <div 
          className="absolute top-0 bottom-0 bg-gradient-to-r from-yellow-400/40 via-yellow-400/60 to-yellow-400/40 perfect-zone-pulse"
          style={{
            left: '30%',
            width: '40%',
          }}
        />
        
        {/* Edge borders */}
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />
        <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-primary" />
      </div>
      
      {/* Charge level fill */}
      <div 
        className={`absolute top-0 bottom-0 left-0 transition-all duration-75 ${
          isPerfectZone ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
          isInSweetSpot ? 'bg-gradient-to-r from-primary to-primary/80' : 
          'bg-gradient-to-r from-accent to-accent/80'
        }`}
        style={{ 
          width: `${chargeLevel}%`,
          boxShadow: isInSweetSpot ? '0 0 30px hsl(var(--primary))' : 'none',
        }}
      />

      {/* Charge indicator line */}
      <div
        className={`absolute top-2 bottom-2 w-1 bg-white rounded-full shadow-lg gpu-accelerated ${isCharging ? 'charge-pulse' : ''}`}
        style={{ 
          left: `${chargeLevel}%`,
          boxShadow: '0 0 10px white, 0 0 20px white',
        }}
      />

      {/* Pulse ring on hit */}
      <AnimatePresence>
        {pulseRing && (
          <motion.div
            className="absolute inset-0 border-4 border-yellow-400 rounded-2xl"
            initial={{ opacity: 1, scale: 1 }}
            animate={{ opacity: 0, scale: 1.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>
    </div>

    {/* Zone labels */}
    <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-xs text-muted-foreground px-1">
      <span>0%</span>
      <span className="text-primary font-medium">Sweet Spot</span>
      <span>100%</span>
    </div>
  </div>
));
ChargeBar.displayName = 'ChargeBar';

export const EnergyBeamGame = ({ 
  companionStats, 
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0
}: EnergyBeamGameProps) => {
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'complete'>('countdown');
  const [isCharging, setIsCharging] = useState(false);
  const [chargeLevel, setChargeLevel] = useState(0);
  const [released, setReleased] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [hits, setHits] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [lastHitType, setLastHitType] = useState<'perfect' | 'good' | 'miss' | null>(null);
  const [shake, setShake] = useState(false);
  const [pulseRing, setPulseRing] = useState(false);
  
  const chargeRef = useRef<NodeJS.Timeout | null>(null);
  const maxAttempts = 3;

  // Sweet spot calculation based on body stat
  const bodyBonus = Math.min(companionStats.body / 100, 1);
  const baseSweetSpotSize = difficulty === 'easy' ? 20 : difficulty === 'medium' ? 15 : 10;
  const sweetSpotSize = baseSweetSpotSize * (1 - questIntervalScale * 0.5);
  const adjustedSweetSpotSize = sweetSpotSize + (bodyBonus * 6);
  
  // Sweet spot position (randomized each attempt)
  const [sweetSpotStart, setSweetSpotStart] = useState(40);
  
  useEffect(() => {
    const newStart = 30 + Math.random() * 30;
    setSweetSpotStart(newStart);
  }, [attempts]);

  const sweetSpotEnd = sweetSpotStart + adjustedSweetSpotSize;

  // Memoized charge speed
  const chargeSpeed = useMemo(() => 2.5 * (1 + questIntervalScale), [questIntervalScale]);

  const startCharging = useCallback(() => {
    if (gameState !== 'playing' || released) return;
    setIsCharging(true);
    setChargeLevel(0);
    triggerHaptic('light');
    
    chargeRef.current = setInterval(() => {
      setChargeLevel(prev => {
        if (prev >= 100) return 100;
        // Subtle haptic feedback while charging
        if (Math.floor(prev / 20) < Math.floor((prev + chargeSpeed) / 20)) {
          triggerHaptic('light');
        }
        return prev + chargeSpeed;
      });
    }, 25);
  }, [gameState, released, chargeSpeed]);

  const releaseBeam = useCallback(() => {
    if (!isCharging || gameState !== 'playing') return;
    
    setIsCharging(false);
    setReleased(true);
    
    if (chargeRef.current) {
      clearInterval(chargeRef.current);
    }

    const isInSweetSpot = chargeLevel >= sweetSpotStart && chargeLevel <= sweetSpotEnd;
    const isPerfect = chargeLevel >= sweetSpotStart + adjustedSweetSpotSize * 0.3 && 
                      chargeLevel <= sweetSpotEnd - adjustedSweetSpotSize * 0.3;
    
    if (isInSweetSpot) {
      setHits(prev => prev + 1);
      setCombo(c => {
        const newCombo = c + 1;
        setMaxCombo(m => Math.max(m, newCombo));
        return newCombo;
      });
      setLastHitType(isPerfect ? 'perfect' : 'good');
      setPulseRing(true);
      triggerHaptic(isPerfect ? 'success' : 'medium');
      setTimeout(() => setPulseRing(false), 500);
    } else {
      setCombo(0);
      setLastHitType('miss');
      setShake(true);
      triggerHaptic('error');
      setTimeout(() => setShake(false), 300);
    }

    setShowResult(true);
    
    setTimeout(() => {
      setShowResult(false);
      setReleased(false);
      setChargeLevel(0);
      setLastHitType(null);
      
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      if (newAttempts >= maxAttempts) {
        setGameState('complete');
        const finalHits = hits + (isInSweetSpot ? 1 : 0);
        const accuracy = Math.round((finalHits / maxAttempts) * 100);
        const comboBonus = Math.min(maxCombo * 5, 20);
        const finalAccuracy = Math.min(100, accuracy + comboBonus);
        
        onComplete({
          success: finalHits >= 2,
          accuracy: finalAccuracy,
          result: finalAccuracy >= 90 ? 'perfect' : finalAccuracy >= 70 ? 'good' : finalAccuracy >= 50 ? 'partial' : 'fail'
        });
      }
    }, 800);
  }, [isCharging, chargeLevel, sweetSpotStart, sweetSpotEnd, adjustedSweetSpotSize, attempts, hits, maxCombo, gameState, onComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chargeRef.current) {
        clearInterval(chargeRef.current);
      }
    };
  }, []);

  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
  }, []);

  const isInSweetSpot = chargeLevel >= sweetSpotStart && chargeLevel <= sweetSpotEnd;
  const isPerfectZone = chargeLevel >= sweetSpotStart + adjustedSweetSpotSize * 0.3 && 
                        chargeLevel <= sweetSpotEnd - adjustedSweetSpotSize * 0.3;

  return (
    <div className={`flex flex-col items-center relative ${shake ? 'animate-shake' : ''}`}>
      {/* Countdown Overlay */}
      {gameState === 'countdown' && (
        <CountdownOverlay count={3} onComplete={handleCountdownComplete} />
      )}

      {/* Pause Overlay */}
      <AnimatePresence>
        {gameState === 'paused' && (
          <PauseOverlay onResume={() => setGameState('playing')} />
        )}
      </AnimatePresence>

      {/* Game HUD */}
      <GameHUD
        title="Energy Beam"
        subtitle="Release in the glowing zone!"
        score={hits}
        maxScore={maxAttempts}
        combo={combo}
        showCombo={true}
        primaryStat={{ value: attempts + 1, label: 'Attempt', color: 'hsl(217, 91%, 60%)' }}
        isPaused={gameState === 'paused'}
        onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      />

      {/* Attempts indicator - memoized */}
      <AttemptDots maxAttempts={maxAttempts} attempts={attempts} hits={hits} />

      {/* Charge bar - memoized */}
      <ChargeBar
        chargeLevel={chargeLevel}
        sweetSpotStart={sweetSpotStart}
        adjustedSweetSpotSize={adjustedSweetSpotSize}
        isInSweetSpot={isInSweetSpot}
        isPerfectZone={isPerfectZone}
        isCharging={isCharging}
        pulseRing={pulseRing}
      />

      {/* Result feedback */}
      <AnimatePresence>
        {showResult && lastHitType && (
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0, y: -20 }}
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 text-3xl font-black px-6 py-3 rounded-xl ${
              lastHitType === 'perfect' ? 'bg-yellow-500/20 text-yellow-400 border-2 border-yellow-400' :
              lastHitType === 'good' ? 'bg-green-500/20 text-green-400 border-2 border-green-400' :
              'bg-red-500/20 text-red-400 border-2 border-red-400'
            }`}
          >
            {lastHitType === 'perfect' ? '✨ PERFECT!' :
             lastHitType === 'good' ? '👍 GOOD!' : '💨 MISS'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Charge button */}
      {gameState === 'playing' && !showResult && (
        <motion.button
          className={`relative w-36 h-36 rounded-full flex items-center justify-center border-4 border-primary/50 overflow-hidden mt-4 gpu-accelerated ${isCharging ? 'charging-glow' : 'idle-glow'}`}
          style={{
            background: isCharging 
              ? 'radial-gradient(circle, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)'
              : 'radial-gradient(circle, hsl(var(--primary)/0.8) 0%, hsl(var(--accent)/0.8) 100%)',
          }}
          onMouseDown={startCharging}
          onMouseUp={releaseBeam}
          onMouseLeave={releaseBeam}
          onTouchStart={startCharging}
          onTouchEnd={releaseBeam}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {/* Inner rings animation - CSS only */}
          <div className={`absolute inset-4 rounded-full border-2 border-white/30 ${isCharging ? 'ring-pulse-1' : ''}`} />
          <div className={`absolute inset-8 rounded-full border-2 border-white/20 ${isCharging ? 'ring-pulse-2' : ''}`} />
          
          {/* Center icon */}
          <Zap 
            className={`w-14 h-14 text-primary-foreground relative z-10 ${isCharging ? 'animate-pulse' : ''}`}
            style={{ filter: 'drop-shadow(0 0 10px white)' }}
          />
          
          {/* Charge level indicator inside button */}
          <div 
            className="absolute bottom-0 left-0 right-0 bg-white/30 transition-all duration-100"
            style={{ height: `${chargeLevel}%` }}
          />
        </motion.button>
      )}

      {/* Instructions */}
      <motion.p 
        className="mt-4 text-sm text-muted-foreground text-center"
        animate={{ opacity: gameState === 'playing' && !showResult ? 1 : 0.5 }}
      >
        {isCharging ? (
          <span className={isInSweetSpot ? 'text-primary font-bold' : ''}>
            {isPerfectZone ? '🌟 PERFECT ZONE!' : isInSweetSpot ? '✨ In the zone!' : 'Keep charging...'}
          </span>
        ) : (
          'Hold to charge, release in the zone!'
        )}
      </motion.p>

      {/* Stat bonus indicator */}
      <p className="mt-2 text-xs text-muted-foreground">
        Body stat bonus: +{Math.round(bodyBonus * 10)}% sweet spot size
      </p>

      {/* CSS animations */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
        .gpu-accelerated {
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        .scale-pulse {
          animation: scale-pulse 0.5s ease-in-out infinite;
        }
        @keyframes scale-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
        .perfect-zone-pulse {
          animation: opacity-pulse 0.8s ease-in-out infinite;
        }
        @keyframes opacity-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .charge-pulse {
          animation: charge-scale 0.2s ease-in-out infinite;
        }
        @keyframes charge-scale {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.1); }
        }
        .charging-glow {
          box-shadow: 0 0 30px hsl(var(--primary)), 0 0 60px hsl(var(--primary));
          animation: glow-pulse 0.3s ease-in-out infinite;
        }
        .idle-glow {
          box-shadow: 0 0 15px hsl(var(--primary) / 0.5);
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 30px hsl(var(--primary)); }
          50% { box-shadow: 0 0 60px hsl(var(--primary)); }
        }
        .ring-pulse-1 {
          animation: ring-pulse 0.5s ease-in-out infinite;
        }
        .ring-pulse-2 {
          animation: ring-pulse 0.5s ease-in-out infinite 0.25s;
        }
        @keyframes ring-pulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.3); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};
