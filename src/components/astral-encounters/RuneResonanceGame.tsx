import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic, useGameLoop, useParticleSystem } from './gameUtils';

interface RuneResonanceGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
}

interface Rune {
  id: number;
  symbol: string;
  rhythm: number;
  phase: number;
  activated: boolean;
  x: number;
  y: number;
}

const RUNE_SYMBOLS = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ', 'ᛃ'];

// Static positions for runes
const RUNE_POSITIONS = [
  { x: 25, y: 25 }, { x: 75, y: 25 },
  { x: 15, y: 55 }, { x: 50, y: 45 }, { x: 85, y: 55 },
  { x: 30, y: 80 }, { x: 70, y: 80 },
];

// Memoized particle renderer
const ParticleRenderer = memo(({ particles }: { particles: { id: number; x: number; y: number; color: string; life: number; maxLife: number }[] }) => (
  <>
    {particles.map(particle => (
      <div
        key={particle.id}
        className="absolute w-2 h-2 rounded-full pointer-events-none z-20 gpu-accelerated"
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

// Memoized rune component
interface RuneComponentProps {
  rune: Rune;
  intensity: number;
  isAtPeak: boolean;
  isPerfectPeak: boolean;
  timingTolerance: number;
  showFeedback: { id: number; success: boolean; perfect?: boolean } | null;
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
  disabled 
}: RuneComponentProps) => {
  const buttonStyle = useMemo(() => ({
    left: `${rune.x}%`,
    top: `${rune.y}%`,
    background: rune.activated 
      ? 'linear-gradient(135deg, hsl(142, 76%, 46%), hsl(142, 76%, 36%))'
      : `radial-gradient(circle, rgba(168, 85, 247, ${0.15 + intensity * 0.5}) 0%, rgba(168, 85, 247, ${0.05 + intensity * 0.2}) 100%)`,
    boxShadow: rune.activated
      ? '0 0 25px hsl(142, 76%, 46%), 0 0 50px hsl(142, 76%, 46%, 0.5)'
      : isPerfectPeak && !rune.activated
        ? `0 0 ${20 + intensity * 40}px rgba(251, 191, 36, ${intensity}), 0 0 ${10 + intensity * 20}px rgba(168, 85, 247, ${intensity})`
        : `0 0 ${10 + intensity * 30}px rgba(168, 85, 247, ${intensity * 0.8})`,
    border: rune.activated 
      ? '3px solid hsl(142, 76%, 56%)'
      : isPerfectPeak 
        ? `3px solid rgba(251, 191, 36, ${0.5 + intensity * 0.5})`
        : `2px solid rgba(168, 85, 247, ${0.3 + intensity * 0.5})`,
    transform: `translate(-50%, -50%) scale(${0.85 + intensity * 0.25})`,
  }), [rune.activated, rune.x, rune.y, intensity, isPerfectPeak]);

  const textStyle = useMemo(() => ({
    color: rune.activated ? 'white' : `rgba(255, 255, 255, ${0.4 + intensity * 0.6})`,
    textShadow: rune.activated 
      ? '0 0 15px white' 
      : isPerfectPeak
        ? `0 0 ${intensity * 20}px rgba(251, 191, 36, ${intensity})`
        : `0 0 ${intensity * 15}px rgba(168, 85, 247, ${intensity})`,
    filter: isPerfectPeak && !rune.activated ? 'brightness(1.3)' : 'none',
  }), [rune.activated, intensity, isPerfectPeak]);

  return (
    <motion.button
      className="absolute w-16 h-16 rounded-full flex items-center justify-center will-animate gpu-accelerated"
      style={buttonStyle}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.9 }}
    >
      <span className="text-3xl font-bold select-none" style={textStyle}>
        {rune.symbol}
      </span>

      {/* Peak indicator ring - CSS animation */}
      {isAtPeak && !rune.activated && (
        <div className={`absolute inset-0 rounded-full border-2 peak-ring ${isPerfectPeak ? 'border-yellow-400' : 'border-white/60'}`} />
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
          className="absolute inset-0 rounded-full flex items-center justify-center pointer-events-none"
          initial={{ scale: 0.5, opacity: 1 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="text-3xl">
            {showFeedback.success 
              ? showFeedback.perfect ? '🌟' : '✨' 
              : '❌'}
          </span>
        </motion.div>
      )}
    </motion.button>
  );
});
RuneComponent.displayName = 'RuneComponent';

// Memoized connection lines
const ConnectionLines = memo(({ runes }: { runes: Rune[] }) => {
  const activatedRunes = runes.filter(r => r.activated);
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

// Memoized timing legend
const TimingLegend = memo(() => (
  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
    <div className="flex items-center gap-1">
      <div className="w-3 h-3 rounded-full bg-purple-500/50 border border-purple-500" />
      <span>Wait</span>
    </div>
    <div className="flex items-center gap-1">
      <div className="w-3 h-3 rounded-full bg-purple-500 border border-purple-400" style={{ boxShadow: '0 0 8px hsl(271, 91%, 65%)' }} />
      <span>Good</span>
    </div>
    <div className="flex items-center gap-1">
      <div className="w-3 h-3 rounded-full bg-yellow-500 border border-yellow-400" style={{ boxShadow: '0 0 8px #fbbf24' }} />
      <span>Perfect!</span>
    </div>
  </div>
));
TimingLegend.displayName = 'TimingLegend';

export const RuneResonanceGame = ({
  companionStats,
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0,
}: RuneResonanceGameProps) => {
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'complete'>('countdown');
  const [runes, setRunes] = useState<Rune[]>([]);
  const [activatedCount, setActivatedCount] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [showFeedback, setShowFeedback] = useState<{ id: number; success: boolean; perfect?: boolean } | null>(null);
  
  // Use refs for animation state
  const runesRef = useRef<Rune[]>([]);
  const gameStateRef = useRef(gameState);
  
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { runesRef.current = runes; }, [runes]);

  // Use particle system from shared utilities
  const { particles, emit: emitParticles } = useParticleSystem(30);

  // Soul stat bonus
  const statBonus = companionStats.soul;
  const timingTolerance = 0.72 + (statBonus / 100) * 0.08;

  // Memoized difficulty settings
  const settings = useMemo(() => {
    const base = {
      easy: { runes: 3, mistakes: 6, rhythms: [60, 80] },
      medium: { runes: 4, mistakes: 5, rhythms: [60, 80, 100] },
      hard: { runes: 5, mistakes: 4, rhythms: [60, 80, 100, 120] },
    };
    const s = base[difficulty];
    return {
      requiredRunes: s.runes + Math.floor(questIntervalScale),
      maxMistakes: s.mistakes - Math.floor(questIntervalScale),
      rhythms: s.rhythms,
    };
  }, [difficulty, questIntervalScale]);

  // Initialize runes
  useEffect(() => {
    const newRunes: Rune[] = [];
    
    for (let i = 0; i < settings.requiredRunes; i++) {
      newRunes.push({
        id: i,
        symbol: RUNE_SYMBOLS[i % RUNE_SYMBOLS.length],
        rhythm: settings.rhythms[i % settings.rhythms.length],
        phase: Math.random() * Math.PI * 2,
        activated: false,
        x: RUNE_POSITIONS[i % RUNE_POSITIONS.length].x,
        y: RUNE_POSITIONS[i % RUNE_POSITIONS.length].y,
      });
    }
    setRunes(newRunes);
  }, [settings.requiredRunes, settings.rhythms]);

  // Handle countdown complete
  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
  }, []);

  // Optimized animation loop for pulsing runes
  useGameLoop((deltaTime) => {
    if (gameStateRef.current !== 'playing') return;

    setRunes(prev => prev.map(rune => ({
      ...rune,
      phase: (rune.phase + deltaTime * (rune.rhythm / 60) * Math.PI * 2) % (Math.PI * 2),
    })));
  }, gameState === 'playing');

  // Get rune pulse intensity (0-1)
  const getPulseIntensity = useCallback((rune: Rune) => {
    return (Math.sin(rune.phase) + 1) / 2;
  }, []);

  // Check if tap is on rhythm
  const isOnRhythm = useCallback((rune: Rune) => {
    return getPulseIntensity(rune) > timingTolerance;
  }, [getPulseIntensity, timingTolerance]);

  const isPerfectRhythm = useCallback((rune: Rune) => {
    return getPulseIntensity(rune) > 0.92;
  }, [getPulseIntensity]);

  // Handle rune tap
  const handleRuneTap = useCallback((runeId: number) => {
    if (gameState !== 'playing') return;
    
    const rune = runes.find(r => r.id === runeId);
    if (!rune || rune.activated) return;

    const onRhythm = isOnRhythm(rune);
    const isPerfect = isPerfectRhythm(rune);
    
    if (onRhythm) {
      setRunes(prev => prev.map(r => 
        r.id === runeId ? { ...r, activated: true } : r
      ));
      setActivatedCount(c => c + 1);
      setCombo(c => {
        const newCombo = c + 1;
        setMaxCombo(m => Math.max(m, newCombo));
        return newCombo;
      });
      setShowFeedback({ id: runeId, success: true, perfect: isPerfect });
      emitParticles(rune.x, rune.y, isPerfect ? '#fbbf24' : '#a855f7', isPerfect ? 8 : 5);
      triggerHaptic(isPerfect ? 'success' : 'medium');
    } else {
      setMistakes(m => m + 1);
      setCombo(0);
      setShowFeedback({ id: runeId, success: false });
      emitParticles(rune.x, rune.y, '#ef4444', 3);
      triggerHaptic('error');
    }

    setTimeout(() => setShowFeedback(null), 400);
  }, [runes, gameState, emitParticles, isOnRhythm, isPerfectRhythm]);

  // Check game end
  useEffect(() => {
    if (activatedCount >= settings.requiredRunes || mistakes >= settings.maxMistakes) {
      setGameState('complete');
    }
  }, [activatedCount, settings.requiredRunes, mistakes, settings.maxMistakes]);

  // Complete game
  useEffect(() => {
    if (gameState === 'complete') {
      const baseAccuracy = (activatedCount / settings.requiredRunes) * 100;
      const mistakePenalty = (mistakes / settings.maxMistakes) * 25;
      const comboBonus = Math.min(maxCombo * 3, 15);
      const accuracy = Math.max(0, Math.min(100, Math.round(baseAccuracy - mistakePenalty + comboBonus)));
      const result = accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 40 ? 'partial' : 'fail';
      
      setTimeout(() => {
        onComplete({
          success: accuracy >= 50,
          accuracy,
          result,
        });
      }, 500);
    }
  }, [gameState, activatedCount, settings.requiredRunes, mistakes, settings.maxMistakes, maxCombo, onComplete]);

  return (
    <div className="flex flex-col items-center relative">
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
        title="Rune Resonance"
        subtitle="Tap when runes glow brightest!"
        score={activatedCount}
        maxScore={settings.requiredRunes}
        combo={combo}
        showCombo={true}
        primaryStat={{ value: mistakes, label: 'Mistakes', color: 'hsl(0, 84%, 60%)' }}
        secondaryStat={{ value: settings.maxMistakes - mistakes, label: 'Lives', color: 'hsl(142, 76%, 46%)' }}
        isPaused={gameState === 'paused'}
        onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      />

      {/* Rune arena */}
      <div className="relative w-full max-w-xs h-72 bg-gradient-to-b from-purple-950/40 via-slate-900/60 to-background rounded-xl border border-purple-500/30 overflow-hidden shadow-2xl">
        {/* Mystical background - CSS gradients instead of animated elements */}
        <div className="absolute inset-0 pointer-events-none mystical-bg" />

        {/* Ancient pattern overlay */}
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

        {/* Particles - memoized */}
        <ParticleRenderer particles={particles} />

        {/* Runes */}
        <AnimatePresence>
          {runes.map(rune => {
            const intensity = getPulseIntensity(rune);
            const isAtPeak = intensity > timingTolerance;
            const isPerfectPeak = intensity > 0.92;
            
            return (
              <RuneComponent
                key={rune.id}
                rune={rune}
                intensity={intensity}
                isAtPeak={isAtPeak}
                isPerfectPeak={isPerfectPeak}
                timingTolerance={timingTolerance}
                showFeedback={showFeedback}
                onClick={() => handleRuneTap(rune.id)}
                disabled={rune.activated || gameState !== 'playing'}
              />
            );
          })}
        </AnimatePresence>

        {/* Central energy nexus - CSS animation */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full pointer-events-none nexus-pulse" />

        {/* Connection lines when runes are activated */}
        <ConnectionLines runes={runes} />
      </div>

      {/* Instruction */}
      <motion.p 
        className="mt-4 text-sm text-muted-foreground text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        🎵 Each rune pulses at its own rhythm
      </motion.p>

      {/* Timing indicator legend - memoized */}
      <TimingLegend />

      {/* Soul stat bonus */}
      <p className="mt-2 text-xs text-muted-foreground">
        Soul stat bonus: +{Math.round((statBonus / 100) * 8)}% timing window
      </p>

      {/* CSS animations */}
      <style>{`
        .will-animate {
          will-change: transform, opacity;
        }
        .gpu-accelerated {
          transform: translateZ(0);
          backface-visibility: hidden;
        }
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
