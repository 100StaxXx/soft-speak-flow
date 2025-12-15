import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Flame } from 'lucide-react';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic } from './gameUtils';

interface EnergyBeamGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
}

// Wave indicator component
const WaveIndicator = memo(({ wave, totalWaves }: { wave: number; totalWaves: number }) => (
  <div className="flex items-center gap-2 mb-2">
    <span className="text-xs text-muted-foreground">Wave</span>
    <div className="flex gap-1">
      {Array.from({ length: totalWaves }).map((_, i) => (
        <div
          key={i}
          className={`w-6 h-1.5 rounded-full transition-all ${
            i < wave 
              ? 'bg-primary' 
              : i === wave 
                ? 'bg-primary/50 animate-pulse' 
                : 'bg-muted/30'
          }`}
        />
      ))}
    </div>
  </div>
));
WaveIndicator.displayName = 'WaveIndicator';

// Memoized attempt indicator dots
const AttemptDots = memo(({ 
  maxAttempts, 
  attempts, 
  hits,
  currentWave,
  attemptsPerWave
}: { 
  maxAttempts: number; 
  attempts: number; 
  hits: number;
  currentWave: number;
  attemptsPerWave: number;
}) => {
  const waveStart = currentWave * attemptsPerWave;
  const waveEnd = Math.min(waveStart + attemptsPerWave, maxAttempts);
  
  return (
    <div className="flex gap-2 mb-4 flex-wrap justify-center max-w-xs">
      {Array.from({ length: waveEnd - waveStart }).map((_, i) => {
        const attemptIndex = waveStart + i;
        return (
          <div
            key={attemptIndex}
            className={`w-4 h-4 rounded-full border-2 transition-all ${
              attemptIndex < attempts 
                ? attemptIndex < hits 
                  ? 'bg-green-500 border-green-400' 
                  : 'bg-red-500 border-red-400'
                : attemptIndex === attempts
                  ? 'border-primary bg-primary/20 scale-pulse'
                  : 'border-muted bg-muted/20'
            }`}
          />
        );
      })}
    </div>
  );
});
AttemptDots.displayName = 'AttemptDots';

// Premium charge bar component with cosmic visuals and moving sweet spot
const ChargeBar = memo(({ 
  chargeLevel, 
  sweetSpotStart, 
  adjustedSweetSpotSize, 
  isInSweetSpot, 
  isPerfectZone,
  isCharging,
  pulseRing,
  sweetSpotOffset,
}: { 
  chargeLevel: number;
  sweetSpotStart: number;
  adjustedSweetSpotSize: number;
  isInSweetSpot: boolean;
  isPerfectZone: boolean;
  isCharging: boolean;
  pulseRing: boolean;
  sweetSpotOffset: number;
}) => {
  const effectiveSweetSpotStart = Math.max(5, Math.min(90 - adjustedSweetSpotSize, sweetSpotStart + sweetSpotOffset));
  
  return (
    <div className="relative w-full max-w-xs h-20 mb-6">
      {/* Background track with premium glass effect */}
      <div 
        className="absolute inset-0 rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(10,10,30,0.4) 50%, rgba(0,0,0,0.3) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.5), 0 6px 20px rgba(0,0,0,0.3), 0 0 40px rgba(168,85,247,0.08)',
        }}
      >
        {/* Sweet spot zone with cosmic gradient - now animated */}
        <motion.div 
          className="absolute top-1 bottom-1 overflow-hidden rounded-xl"
          animate={{ 
            left: `${effectiveSweetSpotStart}%`,
          }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          style={{ 
            width: `${adjustedSweetSpotSize}%`,
          }}
        >
          {/* Outer zone gradient with glow */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, hsl(var(--primary)/0.35), hsl(var(--primary)/0.6), hsl(var(--primary)/0.35))',
              boxShadow: 'inset 0 0 15px hsl(var(--primary)/0.3)',
            }}
          />
          
          {/* Perfect zone (inner) with pulsing glow */}
          <div 
            className="absolute top-0 bottom-0"
            style={{
              left: '28%',
              width: '44%',
              background: 'linear-gradient(90deg, rgba(250,204,21,0.45), rgba(250,204,21,0.7), rgba(250,204,21,0.45))',
              animation: 'cosmic-breathe 1.5s ease-in-out infinite',
              boxShadow: 'inset 0 0 10px rgba(250,204,21,0.4)',
            }}
          />
          
          {/* Edge markers with glow */}
          <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: 'linear-gradient(to bottom, transparent, hsl(var(--primary)), transparent)', boxShadow: '0 0 8px hsl(var(--primary))' }} />
          <div className="absolute right-0 top-0 bottom-0 w-0.5" style={{ background: 'linear-gradient(to bottom, transparent, hsl(var(--primary)), transparent)', boxShadow: '0 0 8px hsl(var(--primary))' }} />
        </motion.div>
        
        {/* Charge fill with premium animated gradient */}
        <div 
          className="absolute top-1 bottom-1 left-1 rounded-xl transition-all duration-75"
          style={{ 
            width: `calc(${chargeLevel}% - 4px)`,
            background: isPerfectZone 
              ? 'linear-gradient(90deg, #fbbf24, #fcd34d, #fbbf24)'
              : isInSweetSpot 
                ? 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--primary)))'
                : 'linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)',
            backgroundSize: isCharging ? '200% 100%' : '100% 100%',
            animation: isCharging ? 'shimmer 1s linear infinite' : 'none',
            boxShadow: isInSweetSpot 
              ? '0 0 35px hsl(var(--primary)), 0 0 60px hsl(var(--primary)/0.4), inset 0 2px 4px rgba(255,255,255,0.35)' 
              : '0 0 20px rgba(99,102,241,0.6), inset 0 2px 4px rgba(255,255,255,0.2)',
          }}
        />

        {/* Charge indicator line with glow */}
        <div
          className="absolute top-1.5 bottom-1.5 w-1.5 rounded-full gpu-accelerated"
          style={{ 
            left: `${chargeLevel}%`,
            background: 'linear-gradient(180deg, white, rgba(255,255,255,0.85))',
            boxShadow: '0 0 15px white, 0 0 30px white, 0 0 45px rgba(255,255,255,0.5)',
            transform: isCharging ? 'scaleY(1.15)' : 'scaleY(1)',
            transition: 'transform 0.1s',
          }}
        />

        {/* Pulse ring on hit */}
        <AnimatePresence>
          {pulseRing && (
            <motion.div
              className="absolute inset-0 rounded-2xl"
              style={{ border: '3px solid #fbbf24', boxShadow: '0 0 30px #fbbf24' }}
              initial={{ opacity: 1, scale: 1 }}
              animate={{ opacity: 0, scale: 1.15 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Zone labels with better visibility */}
      <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-[10px] font-medium px-1">
        <span className="text-white/50">0%</span>
        <span className="text-primary/90" style={{ textShadow: '0 0 10px hsl(var(--primary)/0.5)' }}>Sweet Spot</span>
        <span className="text-white/50">100%</span>
      </div>
    </div>
  );
});
ChargeBar.displayName = 'ChargeBar';

// Wave transition overlay
const WaveTransition = memo(({ wave }: { wave: number }) => (
  <motion.div
    className="absolute inset-0 z-30 flex items-center justify-center bg-background/90 backdrop-blur-sm"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <motion.div
      className="text-center"
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      exit={{ scale: 0, rotate: 180 }}
      transition={{ type: 'spring', stiffness: 200 }}
    >
      <motion.div
        animate={{ 
          scale: [1, 1.2, 1],
          rotate: [0, 5, -5, 0]
        }}
        transition={{ duration: 0.5, repeat: 2 }}
      >
        <Flame className="w-16 h-16 text-orange-500 mx-auto mb-2" />
      </motion.div>
      <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">
        WAVE {wave + 1}
      </p>
      <p className="text-sm text-muted-foreground mt-1">Difficulty increased!</p>
    </motion.div>
  </motion.div>
));
WaveTransition.displayName = 'WaveTransition';

// Power meter component
const PowerMeter = memo(({ hits, maxAttempts, streak }: { hits: number; maxAttempts: number; streak: number }) => {
  const power = (hits / maxAttempts) * 100;
  const isOnFire = streak >= 3;
  
  return (
    <div className="w-full max-w-xs mb-4">
      <div className="flex justify-between text-xs mb-1">
        <span className={`font-medium ${isOnFire ? 'text-orange-400' : 'text-muted-foreground'}`}>
          {isOnFire ? '🔥 FIRE STREAK!' : 'Power'}
        </span>
        <span className="text-primary">{Math.round(power)}%</span>
      </div>
      <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${power}%` }}
          transition={{ type: 'spring', stiffness: 100 }}
          style={{
            background: isOnFire 
              ? 'linear-gradient(90deg, #f97316, #ef4444, #f97316)'
              : 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))',
            boxShadow: isOnFire ? '0 0 20px #f97316' : '0 0 10px hsl(var(--primary))',
          }}
        />
      </div>
    </div>
  );
});
PowerMeter.displayName = 'PowerMeter';

export const EnergyBeamGame = ({ 
  companionStats, 
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0
}: EnergyBeamGameProps) => {
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'complete' | 'wave-transition'>('countdown');
  const [isCharging, setIsCharging] = useState(false);
  const [chargeLevel, setChargeLevel] = useState(0);
  const [released, setReleased] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [hits, setHits] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastHitType, setLastHitType] = useState<'perfect' | 'good' | 'miss' | null>(null);
  const [shake, setShake] = useState(false);
  const [pulseRing, setPulseRing] = useState(false);
  const [currentWave, setCurrentWave] = useState(0);
  const [sweetSpotOffset, setSweetSpotOffset] = useState(0);
  const [chargeSpeedMultiplier, setChargeSpeedMultiplier] = useState(1);
  
  const chargeRef = useRef<NodeJS.Timeout | null>(null);
  const sweetSpotAnimRef = useRef<NodeJS.Timeout | null>(null);
  
  // Extended game settings
  const maxAttempts = 8;
  const totalWaves = 2;
  const attemptsPerWave = 4;

  // Sweet spot calculation based on body stat - shrinks each wave
  const bodyBonus = Math.min(companionStats.body / 100, 1);
  const baseSweetSpotSize = difficulty === 'easy' ? 22 : difficulty === 'medium' ? 18 : 14;
  const waveShrinkFactor = 1 - (currentWave * 0.15); // 15% smaller each wave
  const sweetSpotSize = baseSweetSpotSize * (1 - questIntervalScale * 0.5) * waveShrinkFactor;
  const adjustedSweetSpotSize = sweetSpotSize + (bodyBonus * 6);
  
  // Sweet spot position (randomized each attempt)
  const [sweetSpotStart, setSweetSpotStart] = useState(40);
  
  useEffect(() => {
    const newStart = 25 + Math.random() * 35;
    setSweetSpotStart(newStart);
    // Randomize charge speed for each attempt (±20%)
    setChargeSpeedMultiplier(0.8 + Math.random() * 0.4);
  }, [attempts]);

  // Moving sweet spot animation
  useEffect(() => {
    if (gameState === 'playing' && isCharging) {
      sweetSpotAnimRef.current = setInterval(() => {
        setSweetSpotOffset(prev => {
          const newOffset = prev + (Math.sin(Date.now() / 500) * 0.5);
          return Math.max(-10, Math.min(10, newOffset));
        });
      }, 50);
    }
    return () => {
      if (sweetSpotAnimRef.current) {
        clearInterval(sweetSpotAnimRef.current);
      }
    };
  }, [gameState, isCharging]);

  const effectiveSweetSpotStart = Math.max(5, Math.min(90 - adjustedSweetSpotSize, sweetSpotStart + sweetSpotOffset));
  const sweetSpotEnd = effectiveSweetSpotStart + adjustedSweetSpotSize;

  // Memoized charge speed - increases with wave
  const baseChargeSpeed = useMemo(() => 2.5 * (1 + questIntervalScale), [questIntervalScale]);
  const chargeSpeed = baseChargeSpeed * chargeSpeedMultiplier * (1 + currentWave * 0.15);

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

    const isInSweetSpot = chargeLevel >= effectiveSweetSpotStart && chargeLevel <= sweetSpotEnd;
    const isPerfect = chargeLevel >= effectiveSweetSpotStart + adjustedSweetSpotSize * 0.3 && 
                      chargeLevel <= sweetSpotEnd - adjustedSweetSpotSize * 0.3;
    
    if (isInSweetSpot) {
      setHits(prev => prev + 1);
      setStreak(s => s + 1);
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
      setStreak(0);
      setLastHitType('miss');
      setShake(true);
      triggerHaptic('error');
      setTimeout(() => setShake(false), 300);
    }

    setShowResult(true);
    setSweetSpotOffset(0);
    
    setTimeout(() => {
      setShowResult(false);
      setReleased(false);
      setChargeLevel(0);
      setLastHitType(null);
      
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      // Check for wave transition
      if (newAttempts > 0 && newAttempts % attemptsPerWave === 0 && newAttempts < maxAttempts) {
        setGameState('wave-transition');
        setTimeout(() => {
          setCurrentWave(w => w + 1);
          setGameState('playing');
        }, 1500);
        return;
      }
      
      if (newAttempts >= maxAttempts) {
        setGameState('complete');
        const finalHits = hits + (isInSweetSpot ? 1 : 0);
        const accuracy = Math.round((finalHits / maxAttempts) * 100);
        const comboBonus = Math.min(maxCombo * 3, 15);
        const streakBonus = Math.min(streak * 2, 10);
        const finalAccuracy = Math.min(100, accuracy + comboBonus + streakBonus);
        
        onComplete({
          success: finalHits >= 4,
          accuracy: finalAccuracy,
          result: finalAccuracy >= 90 ? 'perfect' : finalAccuracy >= 70 ? 'good' : finalAccuracy >= 50 ? 'partial' : 'fail'
        });
      }
    }, 800);
  }, [isCharging, chargeLevel, effectiveSweetSpotStart, sweetSpotEnd, adjustedSweetSpotSize, attempts, hits, maxCombo, streak, gameState, onComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chargeRef.current) {
        clearInterval(chargeRef.current);
      }
      if (sweetSpotAnimRef.current) {
        clearInterval(sweetSpotAnimRef.current);
      }
    };
  }, []);

  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
  }, []);

  const isInSweetSpot = chargeLevel >= effectiveSweetSpotStart && chargeLevel <= sweetSpotEnd;
  const isPerfectZone = chargeLevel >= effectiveSweetSpotStart + adjustedSweetSpotSize * 0.3 && 
                        chargeLevel <= sweetSpotEnd - adjustedSweetSpotSize * 0.3;

  return (
    <div className={`flex flex-col items-center relative ${shake ? 'animate-shake' : ''}`}>
      {/* Countdown Overlay */}
      {gameState === 'countdown' && (
        <CountdownOverlay count={3} onComplete={handleCountdownComplete} />
      )}

      {/* Wave Transition Overlay */}
      <AnimatePresence>
        {gameState === 'wave-transition' && (
          <WaveTransition wave={currentWave} />
        )}
      </AnimatePresence>

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

      {/* Wave indicator */}
      <WaveIndicator wave={currentWave} totalWaves={totalWaves} />

      {/* Power meter */}
      <PowerMeter hits={hits} maxAttempts={maxAttempts} streak={streak} />

      {/* Attempts indicator - shows current wave only */}
      <AttemptDots 
        maxAttempts={maxAttempts} 
        attempts={attempts} 
        hits={hits} 
        currentWave={currentWave}
        attemptsPerWave={attemptsPerWave}
      />

      {/* Charge bar - with moving sweet spot */}
      <ChargeBar
        chargeLevel={chargeLevel}
        sweetSpotStart={sweetSpotStart}
        adjustedSweetSpotSize={adjustedSweetSpotSize}
        isInSweetSpot={isInSweetSpot}
        isPerfectZone={isPerfectZone}
        isCharging={isCharging}
        pulseRing={pulseRing}
        sweetSpotOffset={sweetSpotOffset}
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
            {streak >= 3 && lastHitType !== 'miss' && (
              <div className="text-sm text-orange-400 mt-1">🔥 {streak}x Streak!</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium charge button with cosmic styling */}
      {(gameState === 'playing' || gameState === 'wave-transition') && !showResult && (
        <motion.button
          className="relative w-36 h-36 rounded-full flex items-center justify-center overflow-hidden gpu-accelerated touch-target"
          style={{
            background: isCharging 
              ? 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--primary)))'
              : 'linear-gradient(135deg, hsl(var(--primary)/0.92), hsl(var(--accent)/0.92))',
            backgroundSize: isCharging ? '200% 200%' : '100% 100%',
            animation: isCharging ? 'shimmer 1.5s linear infinite' : 'none',
            border: '3px solid rgba(255,255,255,0.25)',
            boxShadow: isCharging 
              ? '0 0 50px hsl(var(--primary)), 0 0 100px hsl(var(--primary)/0.5), 0 0 150px hsl(var(--primary)/0.25), inset 0 2px 0 rgba(255,255,255,0.25)'
              : '0 10px 40px rgba(0,0,0,0.35), 0 0 30px hsl(var(--primary)/0.35), inset 0 2px 0 rgba(255,255,255,0.2)',
            opacity: gameState === 'wave-transition' ? 0.5 : 1,
            pointerEvents: gameState === 'wave-transition' ? 'none' : 'auto',
          }}
          onMouseDown={startCharging}
          onMouseUp={releaseBeam}
          onMouseLeave={releaseBeam}
          onTouchStart={startCharging}
          onTouchEnd={releaseBeam}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
        >
          {/* Inner rings with cosmic effect */}
          <div className={`absolute inset-4 rounded-full border border-white/25 ${isCharging ? 'animate-ring-1' : ''}`} />
          <div className={`absolute inset-7 rounded-full border border-white/20 ${isCharging ? 'animate-ring-2' : ''}`} />
          
          {/* Center icon with enhanced glow */}
          <Zap 
            className="w-14 h-14 text-white relative z-10"
            style={{ 
              filter: isCharging ? 'drop-shadow(0 0 20px white) drop-shadow(0 0 40px hsl(var(--primary)))' : 'drop-shadow(0 0 10px rgba(255,255,255,0.6))',
            }}
          />
          
          {/* Charge level visual inside button */}
          <div 
            className="absolute bottom-0 left-0 right-0 transition-all duration-75"
            style={{ 
              height: `${chargeLevel}%`,
              background: 'linear-gradient(to top, rgba(255,255,255,0.35), rgba(255,255,255,0.15))',
              borderRadius: '0 0 50% 50%',
            }}
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
