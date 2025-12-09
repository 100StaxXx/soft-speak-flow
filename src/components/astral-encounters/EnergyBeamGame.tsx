import { useState, useEffect, useCallback, useRef } from 'react';
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

  const startCharging = useCallback(() => {
    if (gameState !== 'playing' || released) return;
    setIsCharging(true);
    setChargeLevel(0);
    triggerHaptic('light');
    
    chargeRef.current = setInterval(() => {
      setChargeLevel(prev => {
        if (prev >= 100) return 100;
        // Subtle haptic feedback while charging
        if (Math.floor(prev / 20) < Math.floor((prev + 2.5) / 20)) {
          triggerHaptic('light');
        }
        return prev + 2.5 * (1 + questIntervalScale);
      });
    }, 25);
  }, [gameState, released, questIntervalScale]);

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
      setCombo(c => c + 1);
      setMaxCombo(m => Math.max(m, combo + 1));
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
  }, [isCharging, chargeLevel, sweetSpotStart, sweetSpotEnd, adjustedSweetSpotSize, attempts, hits, combo, maxCombo, gameState, onComplete]);

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

      {/* Attempts indicator */}
      <div className="flex gap-3 mb-4">
        {Array.from({ length: maxAttempts }).map((_, i) => (
          <motion.div
            key={i}
            className={`w-4 h-4 rounded-full border-2 ${
              i < attempts 
                ? i < hits 
                  ? 'bg-green-500 border-green-400' 
                  : 'bg-red-500 border-red-400'
                : i === attempts
                  ? 'border-primary bg-primary/20'
                  : 'border-muted bg-muted/20'
            }`}
            animate={i === attempts ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        ))}
      </div>

      {/* Charge bar container */}
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
            <motion.div 
              className="absolute top-0 bottom-0 bg-gradient-to-r from-yellow-400/40 via-yellow-400/60 to-yellow-400/40"
              style={{
                left: '30%',
                width: '40%',
              }}
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
            
            {/* Edge borders */}
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />
            <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-primary" />
          </div>
          
          {/* Charge level fill */}
          <motion.div 
            className={`absolute top-0 bottom-0 left-0 ${
              isPerfectZone ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
              isInSweetSpot ? 'bg-gradient-to-r from-primary to-primary/80' : 
              'bg-gradient-to-r from-accent to-accent/80'
            }`}
            style={{ width: `${chargeLevel}%` }}
            animate={{ 
              boxShadow: isInSweetSpot 
                ? ['0 0 20px hsl(var(--primary))', '0 0 40px hsl(var(--primary))', '0 0 20px hsl(var(--primary))']
                : 'none'
            }}
            transition={{ duration: 0.3, repeat: isInSweetSpot ? Infinity : 0 }}
          />

          {/* Charge indicator line */}
          <motion.div
            className="absolute top-2 bottom-2 w-1 bg-white rounded-full shadow-lg"
            style={{ 
              left: `${chargeLevel}%`,
              boxShadow: '0 0 10px white, 0 0 20px white',
            }}
            animate={{ 
              scaleY: isCharging ? [1, 1.1, 1] : 1,
            }}
            transition={{ repeat: Infinity, duration: 0.2 }}
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
          className="relative w-36 h-36 rounded-full flex items-center justify-center border-4 border-primary/50 overflow-hidden mt-4"
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
          animate={{
            boxShadow: isCharging
              ? [
                  '0 0 30px hsl(var(--primary))',
                  '0 0 60px hsl(var(--primary))',
                  '0 0 30px hsl(var(--primary))',
                ]
              : '0 0 15px hsl(var(--primary) / 0.5)',
          }}
          transition={{ repeat: isCharging ? Infinity : 0, duration: 0.3 }}
        >
          {/* Inner rings animation */}
          <motion.div
            className="absolute inset-4 rounded-full border-2 border-white/30"
            animate={isCharging ? { scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] } : {}}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
          <motion.div
            className="absolute inset-8 rounded-full border-2 border-white/20"
            animate={isCharging ? { scale: [1.3, 1, 1.3], opacity: [0.2, 0.5, 0.2] } : {}}
            transition={{ duration: 0.5, repeat: Infinity, delay: 0.25 }}
          />
          
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

      {/* Shake animation keyframes */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
};
