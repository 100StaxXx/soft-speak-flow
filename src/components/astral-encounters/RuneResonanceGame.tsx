import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic, useGameLoop, useParticleSystem } from './gameUtils';

import { DamageEvent, GAME_DAMAGE_VALUES } from '@/types/battleSystem';

interface RuneResonanceGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  onDamage?: (event: DamageEvent) => void;
  tierAttackDamage?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
  maxTimer?: number;
  isPractice?: boolean;
}

interface Rune {
  id: number;
  symbol: string;
  rhythm: number;
  phase: number;
  activated: boolean;
  x: number;
  y: number;
  isDecoy: boolean;
}

const RUNE_SYMBOLS = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ', 'ᛃ'];
const DECOY_SYMBOLS = ['☠', '✕', '⚠'];

const RUNE_POSITIONS = [
  { x: 25, y: 25 }, { x: 75, y: 25 },
  { x: 15, y: 55 }, { x: 50, y: 45 }, { x: 85, y: 55 },
  { x: 30, y: 80 }, { x: 70, y: 80 },
];

// ENDLESS mode config - no timer, mistakes = lives
const DIFFICULTY_CONFIG = {
  easy: {
    baseRunes: 4,
    maxMistakes: 5,
    rhythms: [55, 70],
    baseDecoyCount: 0,
    runeIncreasePerRound: 1,
    decoyIncreasePerRound: 0.5,
    maxRunes: 7,
    maxDecoys: 3,
  },
  medium: {
    baseRunes: 4,
    maxMistakes: 4,
    rhythms: [60, 80],
    baseDecoyCount: 1,
    runeIncreasePerRound: 1,
    decoyIncreasePerRound: 0.5,
    maxRunes: 7,
    maxDecoys: 4,
  },
  hard: {
    baseRunes: 5,
    maxMistakes: 3,
    rhythms: [70, 90],
    baseDecoyCount: 1,
    runeIncreasePerRound: 1,
    decoyIncreasePerRound: 0.75,
    maxRunes: 7,
    maxDecoys: 5,
  },
};

// Particle renderer
const ParticleRenderer = memo(({ particles }: { particles: { id: number; x: number; y: number; color: string; life: number; maxLife: number }[] }) => (
  <>
    {particles.map(particle => (
      <div
        key={particle.id}
        className="absolute w-2 h-2 rounded-full pointer-events-none z-20"
        style={{
          left: `${particle.x}%`,
          top: `${particle.y}%`,
          backgroundColor: particle.color,
          boxShadow: `0 0 8px ${particle.color}`,
          opacity: particle.life / particle.maxLife,
          transform: `translate(-50%, -50%) translateY(${-30 * (1 - particle.life / particle.maxLife)}px)`,
        }}
      />
    ))}
  </>
));
ParticleRenderer.displayName = 'ParticleRenderer';

// Stunned overlay
const StunnedOverlay = memo(({ stunned }: { stunned: boolean }) => {
  if (!stunned) return null;
  
  return (
    <motion.div
      className="absolute inset-0 z-40 bg-red-900/30 flex items-center justify-center pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="text-4xl"
        animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 0.3, repeat: 3 }}
      >
        💫
      </motion.div>
    </motion.div>
  );
});
StunnedOverlay.displayName = 'StunnedOverlay';

// Rune component
interface RuneComponentProps {
  rune: Rune;
  intensity: number;
  isAtPeak: boolean;
  isPerfectPeak: boolean;
  showFeedback: { id: number; success: boolean; perfect?: boolean; points?: number } | null;
  onClick: () => void;
  disabled: boolean;
}

const RuneComponent = memo(({ 
  rune, 
  intensity, 
  isAtPeak, 
  isPerfectPeak, 
  showFeedback,
  onClick, 
  disabled,
}: RuneComponentProps) => {
  const buttonStyle = useMemo(() => {
    if (rune.isDecoy) {
      return {
        left: `${rune.x}%`,
        top: `${rune.y}%`,
        background: `radial-gradient(circle, rgba(239, 68, 68, ${0.15 + intensity * 0.4}) 0%, rgba(127, 29, 29, ${0.2 + intensity * 0.3}) 100%)`,
        boxShadow: `0 0 ${10 + intensity * 25}px rgba(239, 68, 68, ${intensity * 0.6})`,
        border: `2px solid rgba(239, 68, 68, ${0.3 + intensity * 0.5})`,
        transform: `translate(-50%, -50%) scale(${0.85 + intensity * 0.2})`,
      };
    }
    
    return {
      left: `${rune.x}%`,
      top: `${rune.y}%`,
      background: rune.activated 
        ? 'linear-gradient(135deg, hsl(142, 76%, 46%), hsl(142, 76%, 36%))'
        : `radial-gradient(circle, rgba(168, 85, 247, ${0.15 + intensity * 0.5}) 0%, rgba(168, 85, 247, ${0.05 + intensity * 0.2}) 100%)`,
      boxShadow: rune.activated
        ? '0 0 25px hsl(142, 76%, 46%), 0 0 50px hsl(142, 76%, 46%, 0.5)'
        : isPerfectPeak && !rune.activated
          ? `0 0 ${20 + intensity * 40}px rgba(251, 191, 36, ${intensity})`
          : `0 0 ${10 + intensity * 30}px rgba(168, 85, 247, ${intensity * 0.8})`,
      border: rune.activated 
        ? '3px solid hsl(142, 76%, 56%)'
        : isPerfectPeak 
          ? `3px solid rgba(251, 191, 36, ${0.5 + intensity * 0.5})`
          : `2px solid rgba(168, 85, 247, ${0.3 + intensity * 0.5})`,
      transform: `translate(-50%, -50%) scale(${0.85 + intensity * 0.25})`,
    };
  }, [rune.activated, rune.x, rune.y, rune.isDecoy, intensity, isPerfectPeak]);

  const textStyle = useMemo(() => ({
    color: rune.isDecoy 
      ? `rgba(239, 68, 68, ${0.6 + intensity * 0.4})`
      : rune.activated 
        ? 'white' 
        : `rgba(255, 255, 255, ${0.4 + intensity * 0.6})`,
    textShadow: rune.isDecoy
      ? `0 0 ${intensity * 15}px rgba(239, 68, 68, ${intensity})`
      : rune.activated 
        ? '0 0 15px white' 
        : isPerfectPeak
          ? `0 0 ${intensity * 20}px rgba(251, 191, 36, ${intensity})`
          : `0 0 ${intensity * 15}px rgba(168, 85, 247, ${intensity})`,
    filter: isPerfectPeak && !rune.activated ? 'brightness(1.3)' : 'none',
  }), [rune.activated, rune.isDecoy, intensity, isPerfectPeak]);

  return (
    <motion.button
      className="absolute w-16 h-16 rounded-full flex items-center justify-center"
      style={buttonStyle}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.9 }}
    >
      <span className="text-3xl font-bold select-none" style={textStyle}>
        {rune.symbol}
      </span>

      {/* Peak indicator ring */}
      {isAtPeak && !rune.activated && !rune.isDecoy && (
        <div className={`absolute inset-0 rounded-full border-2 peak-ring ${isPerfectPeak ? 'border-yellow-400' : 'border-white/60'}`} />
      )}

      {/* Decoy warning pulse */}
      {rune.isDecoy && isAtPeak && (
        <div className="absolute inset-0 rounded-full border-2 border-red-500 peak-ring" />
      )}

      {/* Activated checkmark */}
      {rune.activated && (
        <motion.div
          className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-white"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <span className="text-xs">✓</span>
        </motion.div>
      )}

      {/* Feedback */}
      {showFeedback?.id === rune.id && (
        <motion.div
          className="absolute inset-0 rounded-full flex flex-col items-center justify-center pointer-events-none"
          initial={{ scale: 0.5, opacity: 1 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="text-3xl">
            {showFeedback.success 
              ? showFeedback.perfect ? '🌟' : '✨' 
              : '❌'}
          </span>
          {showFeedback.points && (
            <span className={`text-sm font-bold ${showFeedback.points > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {showFeedback.points > 0 ? '+' : ''}{showFeedback.points}
            </span>
          )}
        </motion.div>
      )}
    </motion.button>
  );
});
RuneComponent.displayName = 'RuneComponent';

// Connection lines
const ConnectionLines = memo(({ runes }: { runes: Rune[] }) => {
  const activatedRunes = runes.filter(r => r.activated && !r.isDecoy);
  if (activatedRunes.length < 2) return null;

  return (
    <svg className="absolute inset-0 pointer-events-none z-0 w-full h-full">
      {activatedRunes.map((rune, i) => {
        const nextActivated = activatedRunes[i + 1];
        if (!nextActivated) return null;
        return (
          <motion.line
            key={`line-${rune.id}-${nextActivated.id}`}
            x1={`${rune.x}%`}
            y1={`${rune.y}%`}
            x2={`${nextActivated.x}%`}
            y2={`${nextActivated.y}%`}
            stroke="hsl(142, 76%, 46%)"
            strokeWidth="2"
            strokeOpacity="0.4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3 }}
          />
        );
      })}
    </svg>
  );
});
ConnectionLines.displayName = 'ConnectionLines';

// Timing legend
const TimingLegend = memo(() => (
  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
    <div className="flex items-center gap-1">
      <div className="w-3 h-3 rounded-full bg-purple-500/50 border border-purple-500" />
      <span>Wait</span>
    </div>
    <div className="flex items-center gap-1">
      <div className="w-3 h-3 rounded-full bg-yellow-500 border border-yellow-400" style={{ boxShadow: '0 0 8px #fbbf24' }} />
      <span>Tap Now!</span>
    </div>
    <div className="flex items-center gap-1">
      <div className="w-3 h-3 rounded-full bg-red-500/50 border border-red-500" />
      <span>Avoid ☠</span>
    </div>
  </div>
));
TimingLegend.displayName = 'TimingLegend';

// Lives display
const LivesDisplay = memo(({ lives, maxLives }: { lives: number; maxLives: number }) => (
  <div className="flex gap-1">
    {Array.from({ length: maxLives }).map((_, i) => (
      <span key={i} className={`text-lg ${i < lives ? 'opacity-100' : 'opacity-30'}`}>
        ❤️
      </span>
    ))}
  </div>
));
LivesDisplay.displayName = 'LivesDisplay';

// Generate runes for a round
const generateRunes = (round: number, config: typeof DIFFICULTY_CONFIG['easy']): Rune[] => {
  const newRunes: Rune[] = [];
  
  const runeCount = Math.min(config.maxRunes, config.baseRunes + Math.floor((round - 1) * config.runeIncreasePerRound));
  const decoyCount = Math.min(config.maxDecoys, Math.floor(config.baseDecoyCount + (round - 1) * config.decoyIncreasePerRound));
  
  // Generate regular runes
  for (let i = 0; i < runeCount; i++) {
    newRunes.push({
      id: i,
      symbol: RUNE_SYMBOLS[i % RUNE_SYMBOLS.length],
      rhythm: config.rhythms[i % config.rhythms.length],
      phase: Math.random() * Math.PI * 2,
      activated: false,
      x: RUNE_POSITIONS[i % RUNE_POSITIONS.length].x,
      y: RUNE_POSITIONS[i % RUNE_POSITIONS.length].y,
      isDecoy: false,
    });
  }
  
  // Generate decoys
  for (let i = 0; i < decoyCount; i++) {
    const decoyId = runeCount + i;
    const posIndex = (runeCount + i) % RUNE_POSITIONS.length;
    const offsetX = RUNE_POSITIONS[posIndex].x + (Math.random() - 0.5) * 20;
    const offsetY = RUNE_POSITIONS[posIndex].y + (Math.random() - 0.5) * 15;
    
    newRunes.push({
      id: decoyId,
      symbol: DECOY_SYMBOLS[i % DECOY_SYMBOLS.length],
      rhythm: config.rhythms[0] * 0.8,
      phase: Math.random() * Math.PI * 2,
      activated: false,
      x: Math.max(10, Math.min(90, offsetX)),
      y: Math.max(15, Math.min(85, offsetY)),
      isDecoy: true,
    });
  }
  
  return newRunes;
};

export const RuneResonanceGame = ({
  companionStats,
  onComplete,
  onDamage,
  tierAttackDamage = 15,
  difficulty = 'medium',
  questIntervalScale = 0,
  isPractice = false,
}: RuneResonanceGameProps) => {
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'complete'>('countdown');
  const [runes, setRunes] = useState<Rune[]>([]);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [round, setRound] = useState(1);
  const [showFeedback, setShowFeedback] = useState<{ id: number; success: boolean; perfect?: boolean; points?: number } | null>(null);
  const [stunned, setStunned] = useState(false);
  
  const runesRef = useRef<Rune[]>([]);
  const gameStateRef = useRef(gameState);
  
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { runesRef.current = runes; }, [runes]);

  const { particles, emit: emitParticles } = useParticleSystem(30);

  const statBonus = companionStats.soul;
  const baseTimingTolerance = 0.72 + (statBonus / 100) * 0.08;

  const settings = useMemo(() => {
    const base = DIFFICULTY_CONFIG[difficulty];
    return {
      ...base,
      maxMistakes: Math.max(2, base.maxMistakes - Math.floor(questIntervalScale)),
    };
  }, [difficulty, questIntervalScale]);

  const livesRemaining = settings.maxMistakes - mistakes;

  // Initialize first round
  useEffect(() => {
    setRunes(generateRunes(1, settings));
  }, [settings]);

  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
  }, []);

  // Animation loop
  useGameLoop(() => {
    if (gameStateRef.current !== 'playing') return;

    setRunes(prev => prev.map(rune => ({
      ...rune,
      phase: (rune.phase + 0.016 * (rune.rhythm / 60) * Math.PI * 2) % (Math.PI * 2),
    })));
  }, gameState === 'playing');

  const getPulseIntensity = useCallback((rune: Rune) => {
    return (Math.sin(rune.phase) + 1) / 2;
  }, []);

  const isOnRhythm = useCallback((rune: Rune) => {
    return getPulseIntensity(rune) > baseTimingTolerance;
  }, [getPulseIntensity, baseTimingTolerance]);

  const isPerfectRhythm = useCallback((rune: Rune) => {
    return getPulseIntensity(rune) > 0.92;
  }, [getPulseIntensity]);

  // Handle rune tap
  const handleRuneTap = useCallback((runeId: number) => {
    if (gameState !== 'playing' || stunned) return;
    
    const rune = runes.find(r => r.id === runeId);
    if (!rune || rune.activated) return;

    // Handle decoy tap
    if (rune.isDecoy) {
      setMistakes(m => {
        const newMistakes = m + 1;
        if (newMistakes >= settings.maxMistakes) {
          setGameState('complete');
        }
        return newMistakes;
      });
      setCombo(0);
      setScore(s => Math.max(0, s - 50));
      setShowFeedback({ id: runeId, success: false, points: -50 });
      emitParticles(rune.x, rune.y, '#ef4444', 8);
      triggerHaptic('error');
      
      // Player takes damage for tapping decoy
      onDamage?.({ target: 'player', amount: tierAttackDamage, source: 'decoy_tap' });
      
      setStunned(true);
      setTimeout(() => setStunned(false), 1500);
      
      setTimeout(() => setShowFeedback(null), 400);
      return;
    }

    const onRhythm = isOnRhythm(rune);
    const isPerfect = isPerfectRhythm(rune);
    
    if (onRhythm) {
      let points = isPerfect ? 150 : 100;
      points += combo * 10;
      // Round bonus
      points += (round - 1) * 20;
      
      // Deal damage to adversary based on hit quality
      const damageAmount = isPerfect 
        ? GAME_DAMAGE_VALUES.rune_resonance.perfectHit 
        : GAME_DAMAGE_VALUES.rune_resonance.goodHit;
      onDamage?.({ target: 'adversary', amount: damageAmount, source: isPerfect ? 'perfect_hit' : 'good_hit' });
      
      setRunes(prev => prev.map(r => 
        r.id === runeId ? { ...r, activated: true } : r
      ));
      setScore(s => s + points);
      setCombo(c => {
        const newCombo = c + 1;
        setMaxCombo(m => Math.max(m, newCombo));
        return newCombo;
      });
      setShowFeedback({ id: runeId, success: true, perfect: isPerfect, points });
      emitParticles(rune.x, rune.y, isPerfect ? '#fbbf24' : '#a855f7', isPerfect ? 8 : 5);
      triggerHaptic(isPerfect ? 'success' : 'medium');
    } else {
      setMistakes(m => {
        const newMistakes = m + 1;
        if (newMistakes >= settings.maxMistakes) {
          setGameState('complete');
        }
        return newMistakes;
      });
      setCombo(0);
      setScore(s => Math.max(0, s - 25));
      setShowFeedback({ id: runeId, success: false, points: -25 });
      emitParticles(rune.x, rune.y, '#ef4444', 3);
      triggerHaptic('error');
      
      // Player takes damage for mistimed tap
      onDamage?.({ target: 'player', amount: tierAttackDamage, source: 'miss' });
    }

    setTimeout(() => setShowFeedback(null), 400);
  }, [runes, gameState, stunned, combo, round, emitParticles, isOnRhythm, isPerfectRhythm, settings.maxMistakes]);

  // Check round completion - spawn next round if all activated
  const activatedCount = runes.filter(r => r.activated && !r.isDecoy).length;
  const requiredRunes = runes.filter(r => !r.isDecoy).length;
  
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (activatedCount < requiredRunes) return;
    
    // Round complete! Spawn next round
    const nextRound = round + 1;
    
    // Practice mode: end after completing 2 rounds
    if (isPractice && nextRound > 2) {
      setGameState('complete');
      return;
    }
    
    setRound(nextRound);
    
    // Add round clear bonus
    setScore(s => s + 100 * round);
    
    // Generate new runes for next round
    setTimeout(() => {
      setRunes(generateRunes(nextRound, settings));
    }, 500);
  }, [activatedCount, requiredRunes, round, settings, gameState, isPractice]);

  // Complete game - calculate result based on rounds completed
  useEffect(() => {
    if (gameState !== 'complete') return;
    
    const roundsCompleted = round - 1 + (activatedCount / Math.max(1, requiredRunes));
    
    // Accuracy based on rounds completed
    const roundThresholds = { easy: 5, medium: 4, hard: 3 };
    const threshold = roundThresholds[difficulty];
    const accuracy = Math.min(100, Math.round((roundsCompleted / threshold) * 100));
    
    const result = accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 40 ? 'partial' : 'fail';
    
    setTimeout(() => {
      onComplete({
        success: roundsCompleted >= 1,
        accuracy,
        result,
      });
    }, 500);
  }, [gameState, round, activatedCount, requiredRunes, difficulty, onComplete]);

  return (
    <div className="flex flex-col items-center relative">
      {gameState === 'countdown' && (
        <CountdownOverlay count={3} onComplete={handleCountdownComplete} />
      )}

      <AnimatePresence>
        {gameState === 'paused' && (
          <PauseOverlay onResume={() => setGameState('playing')} />
        )}
      </AnimatePresence>

      {gameState === 'playing' && (
        <div className="w-full max-w-xs mb-1">
          <div className="flex justify-between items-center text-sm px-1 mb-2">
            <span className="text-purple-400 font-bold">Round {round}</span>
            <LivesDisplay lives={livesRemaining} maxLives={settings.maxMistakes} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground px-1">
            <span>🎯 Score: {score}</span>
            <span>✨ {activatedCount}/{requiredRunes} Runes</span>
          </div>
        </div>
      )}

      <GameHUD
        title="Rune Resonance"
        subtitle="Tap runes when they glow brightest!"
        score={activatedCount}
        maxScore={requiredRunes}
        combo={combo}
        showCombo={true}
        primaryStat={{ value: round, label: 'Round', color: 'hsl(271, 91%, 65%)' }}
        secondaryStat={{ value: livesRemaining, label: 'Lives', color: 'hsl(142, 76%, 46%)' }}
        isPaused={gameState === 'paused'}
        onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      />

      <div className="relative w-full max-w-xs h-72 bg-gradient-to-b from-purple-950/40 via-slate-900/60 to-background rounded-xl border border-purple-500/30 overflow-hidden shadow-2xl">
        <div className="absolute inset-0 pointer-events-none mystical-bg" />

        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <svg width="100%" height="100%" className="text-purple-500">
            <pattern id="runePattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="1" fill="currentColor" />
              <line x1="0" y1="20" x2="40" y2="20" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
              <line x1="20" y1="0" x2="20" y2="40" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#runePattern)" />
          </svg>
        </div>

        <AnimatePresence>
          <StunnedOverlay stunned={stunned} />
        </AnimatePresence>

        <ParticleRenderer particles={particles} />

        <AnimatePresence>
          {runes.map(rune => {
            const intensity = getPulseIntensity(rune);
            const isAtPeak = intensity > baseTimingTolerance;
            const isPerfectPeak = intensity > 0.92;
            
            return (
              <RuneComponent
                key={rune.id}
                rune={rune}
                intensity={intensity}
                isAtPeak={isAtPeak}
                isPerfectPeak={isPerfectPeak}
                showFeedback={showFeedback}
                onClick={() => handleRuneTap(rune.id)}
                disabled={rune.activated || gameState !== 'playing' || stunned}
              />
            );
          })}
        </AnimatePresence>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full pointer-events-none nexus-pulse" />

        <ConnectionLines runes={runes} />
      </div>

      <motion.p 
        className="mt-4 text-sm text-muted-foreground text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        🎵 Tap runes when they glow brightest! Avoid ☠ traps!
      </motion.p>

      <TimingLegend />

      <div className="mt-2 text-xs text-muted-foreground">
        <span>Soul bonus: +{Math.round((statBonus / 100) * 8)}% timing window</span>
      </div>

      <style>{`
        .mystical-bg {
          background: 
            radial-gradient(circle at 50% 30%, hsl(271, 91%, 65%, 0.15), transparent 60%),
            radial-gradient(circle at 30% 70%, hsl(271, 91%, 65%, 0.1), transparent 50%),
            radial-gradient(circle at 70% 70%, hsl(271, 91%, 65%, 0.1), transparent 50%);
        }
        .nexus-pulse {
          background: radial-gradient(circle, hsl(271, 91%, 65%, 0.4) 0%, transparent 70%);
          animation: nexus-pulse 2.5s ease-in-out infinite;
        }
        @keyframes nexus-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
          50% { transform: translate(-50%, -50%) scale(1.6); opacity: 0.6; }
        }
        .peak-ring {
          animation: peak-expand 0.4s ease-out infinite;
        }
        @keyframes peak-expand {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
};
