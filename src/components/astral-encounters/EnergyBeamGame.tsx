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

// Premium charge bar component with Apple-quality visuals
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
  <div className="relative w-full max-w-xs h-16 mb-6">
    {/* Background track with premium glass effect */}
    <div 
      className="absolute inset-0 rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2)',
      }}
    >
      {/* Sweet spot zone with gradient */}
      <div 
        className="absolute top-0 bottom-0 overflow-hidden"
        style={{ 
          left: `${sweetSpotStart}%`, 
          width: `${adjustedSweetSpotSize}%`,
          borderRadius: 4,
        }}
      >
        {/* Outer zone gradient */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, hsl(var(--primary)/0.3), hsl(var(--primary)/0.5), hsl(var(--primary)/0.3))',
          }}
        />
        
        {/* Perfect zone (inner) with glow */}
        <div 
          className="absolute top-0 bottom-0"
          style={{
            left: '28%',
            width: '44%',
            background: 'linear-gradient(90deg, rgba(250,204,21,0.4), rgba(250,204,21,0.6), rgba(250,204,21,0.4))',
            animation: 'breathe 1.5s ease-in-out infinite',
          }}
        />
        
        {/* Edge markers */}
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-primary to-transparent" />
        <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-primary to-transparent" />
      </div>
      
      {/* Charge fill with premium gradient */}
      <div 
        className="absolute top-0 bottom-0 left-0 rounded-r transition-all duration-75"
        style={{ 
          width: `${chargeLevel}%`,
          background: isPerfectZone 
            ? 'linear-gradient(90deg, #fbbf24, #fcd34d, #fbbf24)'
            : isInSweetSpot 
              ? 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--primary)))'
              : 'linear-gradient(90deg, #6366f1, #8b5cf6, #6366f1)',
          boxShadow: isInSweetSpot 
            ? '0 0 30px hsl(var(--primary)), inset 0 2px 4px rgba(255,255,255,0.3)' 
            : '0 0 15px rgba(99,102,241,0.5)',
        }}
      />

      {/* Charge indicator line */}
      <div
        className="absolute top-1 bottom-1 w-1 rounded-full gpu-accelerated"
        style={{ 
          left: `${chargeLevel}%`,
          background: 'linear-gradient(180deg, white, rgba(255,255,255,0.8))',
          boxShadow: '0 0 12px white, 0 0 24px white',
          transform: isCharging ? 'scaleY(1.1)' : 'scaleY(1)',
          transition: 'transform 0.1s',
        }}
      />

      {/* Pulse ring on hit */}
      <AnimatePresence>
        {pulseRing && (
          <motion.div
            className="absolute inset-0 rounded-2xl"
            style={{ border: '3px solid #fbbf24' }}
            initial={{ opacity: 1, scale: 1 }}
            animate={{ opacity: 0, scale: 1.15 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
        )}
      </AnimatePresence>
    </div>

    {/* Zone labels */}
    <div className="absolute -bottom-5 left-0 right-0 flex justify-between text-[10px] text-white/40 font-medium px-1">
      <span>0%</span>
      <span className="text-primary/80">Sweet Spot</span>
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

      {/* Premium charge button */}
      {gameState === 'playing' && !showResult && (
        <motion.button
          className="relative w-32 h-32 rounded-full flex items-center justify-center overflow-hidden gpu-accelerated touch-target"
          style={{
            background: isCharging 
              ? 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))'
              : 'linear-gradient(135deg, hsl(var(--primary)/0.9), hsl(var(--accent)/0.9))',
            border: '3px solid rgba(255,255,255,0.2)',
            boxShadow: isCharging 
              ? '0 0 40px hsl(var(--primary)), 0 0 80px hsl(var(--primary)/0.5), inset 0 2px 0 rgba(255,255,255,0.2)'
              : '0 8px 32px rgba(0,0,0,0.3), 0 0 20px hsl(var(--primary)/0.3), inset 0 2px 0 rgba(255,255,255,0.15)',
          }}
          onMouseDown={startCharging}
          onMouseUp={releaseBeam}
          onMouseLeave={releaseBeam}
          onTouchStart={startCharging}
          onTouchEnd={releaseBeam}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          {/* Inner rings - CSS driven */}
          <div className={`absolute inset-3 rounded-full border border-white/20 ${isCharging ? 'animate-ring-1' : ''}`} />
          <div className={`absolute inset-6 rounded-full border border-white/15 ${isCharging ? 'animate-ring-2' : ''}`} />
          
          {/* Center icon with glow */}
          <Zap 
            className="w-12 h-12 text-white relative z-10"
            style={{ 
              filter: isCharging ? 'drop-shadow(0 0 15px white)' : 'drop-shadow(0 0 8px rgba(255,255,255,0.5))',
            }}
          />
          
          {/* Charge level visual inside button */}
          <div 
            className="absolute bottom-0 left-0 right-0 bg-white/25 transition-all duration-75"
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
        @keyframes breathe {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
          20%, 40%, 60%, 80% { transform: translateX(3px); }
        }
        .animate-shake { animation: shake 0.3s ease-in-out; }
        .gpu-accelerated {
          transform: translateZ(0);
          backface-visibility: hidden;
          will-change: transform, opacity;
        }
        .touch-target {
          min-height: 44px;
          min-width: 44px;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        .animate-ring-1 {
          animation: ring-pulse 0.4s ease-in-out infinite;
        }
        .animate-ring-2 {
          animation: ring-pulse 0.4s ease-in-out infinite 0.2s;
        }
        @keyframes ring-pulse {
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(1.15); opacity: 0.5; }
        }
        .scale-pulse {
          animation: scale-pulse 0.5s ease-in-out infinite;
        }
        @keyframes scale-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
};
