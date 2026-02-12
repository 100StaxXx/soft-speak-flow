import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic, useStaticStars } from './gameUtils';

import { DamageEvent, GAME_DAMAGE_VALUES } from '@/types/battleSystem';
import { ArcadeDifficulty } from '@/types/arcadeDifficulty';

interface OrbMatchGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  onDamage?: (event: DamageEvent) => void;
  tierAttackDamage?: number;
  difficulty?: ArcadeDifficulty;
  questIntervalScale?: number;
  maxTimer?: number;
  isPractice?: boolean;
  compact?: boolean;
}

// Difficulty multipliers for level scaling - balanced for higher base targets
const DIFFICULTY_MULTIPLIERS: Record<ArcadeDifficulty, { targetMod: number; timeMod: number }> = {
  beginner: { targetMod: 0.5, timeMod: 1.5 },  // Half target, 50% more time
  easy: { targetMod: 0.7, timeMod: 1.3 },
  medium: { targetMod: 1.0, timeMod: 1.0 },
  hard: { targetMod: 1.4, timeMod: 0.85 },
  master: { targetMod: 2.0, timeMod: 0.7 },    // Double target, 30% less time
};

// Level configuration - escalating difficulty (5x harder base targets)
const getLevelConfig = (level: number, difficultyMod: { targetMod: number; timeMod: number }) => {
  const baseTarget = 500 + (level - 1) * 300; // 500, 800, 1100, 1400... (5x harder)
  const baseTime = Math.max(30, 60 - (level - 1) * 2.5); // 60s → 30s minimum (more time to compensate)
  const colors = Math.min(6, 4 + Math.floor(level / 4)) as 4 | 5 | 6; // 4 → 6 colors
  const moveTime = Math.max(4, 10 - Math.floor(level / 3)); // 10s → 4s minimum
  const specialSpawnBonus = Math.min(0.3, level * 0.02); // Increased special spawn rate
  
  return {
    targetScore: Math.round(baseTarget * difficultyMod.targetMod),
    timeLimit: Math.round(baseTime * difficultyMod.timeMod),
    colors,
    moveTime,
    specialSpawnBonus,
  };
};

type OrbColor = 'fire' | 'water' | 'earth' | 'light' | 'dark' | 'cosmic';
type SpecialType = 'normal' | 'line_bomb' | 'star' | 'cross_bomb' | 'cosmic_nova';

interface Orb {
  id: string;
  color: OrbColor;
  row: number;
  col: number;
  matched?: boolean;
  special?: SpecialType;
  isNew?: boolean;
}

interface SpecialCreation {
  row: number;
  col: number;
  type: SpecialType;
  color: OrbColor;
}

interface SpecialEffect {
  id: string;
  type: 'beam_horizontal' | 'beam_vertical' | 'cross_beam' | 'color_burst' | 'cosmic_nova';
  row: number;
  col: number;
  color?: string;
}

const GRID_ROWS = 5;
const GRID_COLS = 6;

// Pure function - check if grid has any match
const hasMatchInGrid = (grid: (Orb | null)[][]): boolean => {
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS - 2; col++) {
      const o1 = grid[row][col], o2 = grid[row][col + 1], o3 = grid[row][col + 2];
      if (o1 && o2 && o3 && o1.color === o2.color && o2.color === o3.color) return true;
    }
  }
  for (let col = 0; col < GRID_COLS; col++) {
    for (let row = 0; row < GRID_ROWS - 2; row++) {
      const o1 = grid[row][col], o2 = grid[row + 1][col], o3 = grid[row + 2][col];
      if (o1 && o2 && o3 && o1.color === o2.color && o2.color === o3.color) return true;
    }
  }
  return false;
};

interface MatchExplosion {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
  score: number;
}

interface SwapState {
  orb1: { id: string; row: number; col: number };
  orb2: { id: string; row: number; col: number };
}

const ORB_SHAPES: Record<OrbColor, string> = {
  fire: '●', water: '◆', earth: '■', light: '★', dark: '▲', cosmic: '✦',
};

const ORB_COLORS: Record<OrbColor, { gradient: string; glow: string; inner: string; emoji: string }> = {
  fire: { gradient: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 50%, #ff4757 100%)', glow: 'rgba(255, 107, 107, 0.6)', inner: 'rgba(255, 200, 150, 0.4)', emoji: '🔥' },
  water: { gradient: 'linear-gradient(135deg, #4facfe 0%, #00cec9 50%, #0984e3 100%)', glow: 'rgba(79, 172, 254, 0.6)', inner: 'rgba(200, 240, 255, 0.4)', emoji: '💧' },
  earth: { gradient: 'linear-gradient(135deg, #00b894 0%, #55a630 50%, #2d6a4f 100%)', glow: 'rgba(0, 184, 148, 0.6)', inner: 'rgba(200, 255, 220, 0.4)', emoji: '🌿' },
  light: { gradient: 'linear-gradient(135deg, #ffd93d 0%, #ff9f1c 50%, #f9a825 100%)', glow: 'rgba(255, 217, 61, 0.6)', inner: 'rgba(255, 255, 220, 0.5)', emoji: '✨' },
  dark: { gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 50%, #6366f1 100%)', glow: 'rgba(168, 85, 247, 0.6)', inner: 'rgba(220, 200, 255, 0.4)', emoji: '🌙' },
  cosmic: { gradient: 'linear-gradient(135deg, #f472b6 0%, #ec4899 50%, #e11d48 100%)', glow: 'rgba(244, 114, 182, 0.6)', inner: 'rgba(255, 200, 230, 0.4)', emoji: '💫' },
};

// Simplified Star Background - pure CSS
const StarBackground = memo(({ intensity = 0.7 }: { intensity?: number }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-cyan-500/5" />
    <div className="stars-layer" style={{ opacity: intensity }} />
  </div>
));
StarBackground.displayName = 'StarBackground';

// Optimized explosion - CSS animations
const MatchExplosionEffect = memo(({ explosion, onComplete }: { explosion: MatchExplosion; onComplete: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 400);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div 
      className="absolute pointer-events-none z-50 explosion-effect"
      style={{ 
        left: explosion.x, 
        top: explosion.y, 
        '--explosion-color': explosion.color,
      } as React.CSSProperties}
    >
      <div className="explosion-ring" style={{ borderColor: explosion.color }} />
      <div className="explosion-score" style={{ color: explosion.color }}>+{explosion.score}</div>
    </div>
  );
});
MatchExplosionEffect.displayName = 'MatchExplosionEffect';

// Cascade display
const CascadeMultiplier = memo(({ multiplier }: { multiplier: number }) => (
  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none cascade-popup">
    <span className="text-4xl font-black text-yellow-400 drop-shadow-glow">x{multiplier}!</span>
  </div>
));
CascadeMultiplier.displayName = 'CascadeMultiplier';

// Hint indicator - CSS animation
const HintIndicator = memo(({ orbs, cellSize }: { orbs: { row: number; col: number }[]; cellSize: number }) => (
  <>
    {orbs.map((pos, i) => (
      <div
        key={i}
        className="absolute rounded-full pointer-events-none z-40 hint-pulse"
        style={{
          width: cellSize - 12,
          height: cellSize - 12,
          left: pos.col * cellSize + 6,
          top: pos.row * cellSize + 6,
        }}
      />
    ))}
  </>
));
HintIndicator.displayName = 'HintIndicator';

// Score Progress Ring
const ScoreProgressRing = memo(({ progress, isComplete }: { progress: number; isComplete: boolean }) => {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(1, progress));
  
  return (
    <svg className="absolute -right-1 -top-1" width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
      <circle
        cx="22" cy="22" r={radius} fill="none"
        stroke={isComplete ? '#22c55e' : '#a855f7'}
        strokeWidth="3" strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        className="transition-all duration-200"
        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
      />
    </svg>
  );
});
ScoreProgressRing.displayName = 'ScoreProgressRing';

// Urgency Overlay - CSS animation
const UrgencyOverlay = memo(() => (
  <div className="absolute inset-0 pointer-events-none z-30 rounded-2xl urgency-pulse" />
));
UrgencyOverlay.displayName = 'UrgencyOverlay';

// Perfect Banner
const PerfectGameBanner = memo(() => (
  <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none perfect-banner">
    <div className="px-8 py-4 rounded-2xl bg-yellow-500/20 border-2 border-yellow-500/60 shadow-glow-yellow">
      <span className="text-2xl font-black text-yellow-400 drop-shadow-glow">⭐ PERFECT! +50 ⭐</span>
    </div>
  </div>
));
PerfectGameBanner.displayName = 'PerfectGameBanner';

// Shuffle Overlay
const ShuffleOverlay = memo(() => (
  <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/50 rounded-2xl">
    <span className="text-4xl animate-spin">🔀</span>
    <span className="ml-3 text-lg font-bold text-white">Shuffling...</span>
  </div>
));
ShuffleOverlay.displayName = 'ShuffleOverlay';

// Level Complete Overlay
const LevelCompleteOverlay = memo(({ 
  level, 
  levelScore, 
  timeBonus, 
  totalScore,
  onContinue 
}: { 
  level: number; 
  levelScore: number; 
  timeBonus: number; 
  totalScore: number;
  onContinue: () => void;
}) => {
  useEffect(() => {
    const timer = setTimeout(onContinue, 2500);
    return () => clearTimeout(timer);
  }, [onContinue]);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/70 rounded-2xl backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 15 }}
        className="text-center"
      >
        <div className="text-4xl mb-2">🎉</div>
        <h2 className="text-2xl font-black text-yellow-400 mb-1 drop-shadow-glow">
          LEVEL {level} COMPLETE!
        </h2>
        <div className="space-y-1 text-sm">
          <p className="text-white/80">Level Score: <span className="text-green-400 font-bold">+{levelScore}</span></p>
          <p className="text-white/80">Time Bonus: <span className="text-cyan-400 font-bold">+{timeBonus}</span></p>
          <p className="text-white/60 text-xs mt-2">Total: <span className="text-purple-400 font-bold">{totalScore}</span></p>
        </div>
        <motion.div
          className="mt-4 px-4 py-2 bg-purple-500/30 rounded-full border border-purple-400/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <span className="text-sm text-purple-200">Next level starting...</span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
});
LevelCompleteOverlay.displayName = 'LevelCompleteOverlay';

// Level Indicator Badge - compact
const LevelIndicator = memo(({ level, progress, targetScore }: { level: number; progress: number; targetScore: number }) => (
  <div className="absolute left-1 top-1 z-40">
    <div className="flex items-center gap-1.5 px-2 py-1 bg-black/60 rounded-full border border-purple-500/40 backdrop-blur-sm">
      <span className="text-[10px] font-bold text-purple-400">LVL</span>
      <span className="text-base font-black text-white">{level}</span>
      <div className="w-10 h-1 bg-white/10 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-200"
          style={{ width: `${Math.min(100, progress * 100)}%` }}
        />
      </div>
    </div>
  </div>
));
LevelIndicator.displayName = 'LevelIndicator';

// Level Up Animation
const LevelUpBanner = memo(() => (
  <motion.div
    className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
    initial={{ opacity: 0, scale: 0.5 }}
    animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1, 1] }}
    transition={{ duration: 1, times: [0, 0.3, 0.7, 1] }}
  >
    <div className="px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-500/40 to-pink-500/40 border-2 border-purple-400/60 shadow-glow-purple">
      <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-pink-400">
        ⬆️ LEVEL UP! ⬆️
      </span>
    </div>
  </motion.div>
));
LevelUpBanner.displayName = 'LevelUpBanner';

// Special Effect: Beam (horizontal/vertical)
const BeamEffect = memo(({ effect, cellSize, onComplete }: { effect: SpecialEffect; cellSize: number; onComplete: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 400);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const isHorizontal = effect.type === 'beam_horizontal';
  return (
    <motion.div
      className="absolute z-50 pointer-events-none"
      initial={{ opacity: 0, scaleX: isHorizontal ? 0 : 1, scaleY: isHorizontal ? 1 : 0 }}
      animate={{ opacity: 1, scaleX: 1, scaleY: 1 }}
      exit={{ opacity: 0 }}
      style={{
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)',
        height: isHorizontal ? 6 : cellSize * GRID_ROWS,
        width: isHorizontal ? cellSize * GRID_COLS : 6,
        top: isHorizontal ? effect.row * cellSize + cellSize / 2 - 3 : 0,
        left: isHorizontal ? 0 : effect.col * cellSize + cellSize / 2 - 3,
        boxShadow: '0 0 20px rgba(255,255,255,0.8), 0 0 40px rgba(168,85,247,0.6)',
      }}
    />
  );
});
BeamEffect.displayName = 'BeamEffect';

// Special Effect: Cross Beam
const CrossBeamEffect = memo(({ effect, cellSize, onComplete }: { effect: SpecialEffect; cellSize: number; onComplete: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <>
      <motion.div
        className="absolute z-50 pointer-events-none"
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        exit={{ opacity: 0 }}
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.9), transparent)',
          height: 6,
          width: cellSize * GRID_COLS,
          top: effect.row * cellSize + cellSize / 2 - 3,
          left: 0,
          boxShadow: '0 0 20px rgba(255,215,0,0.8)',
        }}
      />
      <motion.div
        className="absolute z-50 pointer-events-none"
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: 1, scaleY: 1 }}
        exit={{ opacity: 0 }}
        style={{
          background: 'linear-gradient(180deg, transparent, rgba(255,215,0,0.9), transparent)',
          height: cellSize * GRID_ROWS,
          width: 6,
          top: 0,
          left: effect.col * cellSize + cellSize / 2 - 3,
          boxShadow: '0 0 20px rgba(255,215,0,0.8)',
        }}
      />
    </>
  );
});
CrossBeamEffect.displayName = 'CrossBeamEffect';

// Special Effect: Color Burst (Star)
const ColorBurstEffect = memo(({ effect, cellSize, onComplete }: { effect: SpecialEffect; cellSize: number; onComplete: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 600);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="absolute z-50 pointer-events-none"
      initial={{ scale: 0, opacity: 1 }}
      animate={{ scale: 4, opacity: 0 }}
      transition={{ duration: 0.6 }}
      style={{
        width: cellSize,
        height: cellSize,
        left: effect.col * cellSize,
        top: effect.row * cellSize,
        background: `radial-gradient(circle, ${effect.color || 'rgba(255,215,0,0.8)'}, transparent)`,
        borderRadius: '50%',
      }}
    />
  );
});
ColorBurstEffect.displayName = 'ColorBurstEffect';

// Special Effect: Cosmic Nova
const CosmicNovaEffect = memo(({ effect, cellSize, onComplete }: { effect: SpecialEffect; cellSize: number; onComplete: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 700);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <>
      <motion.div
        className="absolute rounded-full z-50 pointer-events-none"
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 5, opacity: 0 }}
        transition={{ duration: 0.7 }}
        style={{
          width: cellSize * 3,
          height: cellSize * 3,
          left: effect.col * cellSize - cellSize,
          top: effect.row * cellSize - cellSize,
          background: 'radial-gradient(circle, rgba(255,255,255,0.9), rgba(168,85,247,0.6), rgba(236,72,153,0.4), transparent)',
        }}
      />
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute z-50 pointer-events-none"
          initial={{ scale: 0, opacity: 1, x: 0, y: 0 }}
          animate={{
            scale: [0, 1, 0.5],
            opacity: [1, 0.8, 0],
            x: Math.cos((i * Math.PI) / 4) * cellSize * 2,
            y: Math.sin((i * Math.PI) / 4) * cellSize * 2,
          }}
          transition={{ duration: 0.5 }}
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: 'white',
            left: effect.col * cellSize + cellSize / 2 - 6,
            top: effect.row * cellSize + cellSize / 2 - 6,
            boxShadow: '0 0 10px rgba(255,255,255,0.8)',
          }}
        />
      ))}
    </>
  );
});
CosmicNovaEffect.displayName = 'CosmicNovaEffect';

// OPTIMIZED Orb Component - CSS transforms only, no Framer layout
const OrbComponent = memo(({ 
  orb, cellSize, isSelected, isDragging, isInPath, isReverting, showAccessibility,
}: { 
  orb: Orb; cellSize: number; isSelected: boolean; isDragging: boolean;
  isInPath: boolean; isReverting?: boolean; showAccessibility?: boolean;
}) => {
  const colorConfig = ORB_COLORS[orb.color];
  const orbSize = cellSize - 8;
  
  // Special orb styling
  const getSpecialStyle = () => {
    switch (orb.special) {
      case 'line_bomb':
        return { border: '3px dashed rgba(255,255,255,0.9)', animation: 'special-pulse 1s infinite', icon: '➖' };
      case 'star':
        return { border: '3px solid gold', animation: 'special-rainbow 1.5s infinite', icon: '★' };
      case 'cross_bomb':
        return { border: '3px double rgba(255,215,0,0.9)', animation: 'special-rotate 2s linear infinite', icon: '✚' };
      case 'cosmic_nova':
        return { border: '4px solid magenta', animation: 'special-nova 0.8s infinite', icon: '✦' };
      default:
        return { border: '2px solid rgba(255,255,255,0.25)', animation: undefined, icon: null };
    }
  };
  
  const specialStyle = getSpecialStyle();
  const x = orb.col * cellSize + (cellSize - orbSize) / 2;
  const y = orb.row * cellSize + (cellSize - orbSize) / 2;
  const scale = orb.matched ? 0 : isSelected ? 1.15 : isInPath ? 1.08 : 1;
  
  return (
    <div
      className={`absolute rounded-full flex items-center justify-center orb-base ${
        isSelected ? 'z-30' : isInPath ? 'z-20' : 'z-10'
      } ${orb.matched ? 'orb-matched' : ''} ${orb.isNew ? 'orb-new' : ''} ${isReverting ? 'orb-revert' : ''}`}
      style={{
        width: orbSize,
        height: orbSize,
        background: colorConfig.gradient,
        border: specialStyle.border,
        transform: `translate(${x}px, ${y}px) scale(${scale})`,
        boxShadow: isSelected || isInPath 
          ? `0 8px 20px rgba(0,0,0,0.4), 0 0 15px ${colorConfig.glow}` 
          : orb.special !== 'normal'
            ? `0 4px 15px rgba(0,0,0,0.4), 0 0 20px ${colorConfig.glow}, 0 0 30px ${orb.special === 'cosmic_nova' ? 'rgba(236,72,153,0.5)' : 'rgba(255,215,0,0.3)'}`
            : `0 4px 10px rgba(0,0,0,0.3), 0 0 10px ${colorConfig.glow}`,
        animation: specialStyle.animation,
        '--start-y': `${-cellSize * 2}px`,
      } as React.CSSProperties}
    >
      <div 
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '60%', height: '60%', top: '10%', left: '20%',
          background: `radial-gradient(circle at 30% 30%, ${colorConfig.inner}, transparent 70%)`,
        }}
      />
      {/* Main content: emoji or shape */}
      <span className="text-base select-none relative z-10 drop-shadow-sm">
        {showAccessibility ? ORB_SHAPES[orb.color] : colorConfig.emoji}
      </span>
      {/* Special orb indicator icon */}
      {specialStyle.icon && (
        <span className="absolute -top-1 -right-1 text-xs bg-black/60 rounded-full w-4 h-4 flex items-center justify-center z-20">
          {specialStyle.icon}
        </span>
      )}
      {(isSelected || isInPath) && (
        <div 
          className="absolute inset-[-3px] rounded-full pointer-events-none selection-ring"
          style={{ borderColor: colorConfig.glow, boxShadow: `0 0 10px ${colorConfig.glow}` }}
        />
      )}
    </div>
  );
});
OrbComponent.displayName = 'OrbComponent';

// Main Game Component
export const OrbMatchGame = ({
  companionStats, onComplete, onDamage, tierAttackDamage, difficulty = 'medium', questIntervalScale = 0, maxTimer, isPractice = false, compact = false,
}: OrbMatchGameProps) => {
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'levelComplete' | 'complete'>('countdown');
  const [orbs, setOrbs] = useState<Orb[]>([]);
  const [selectedOrb, setSelectedOrb] = useState<Orb | null>(null);
  const [dragPath, setDragPath] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [moveTimeLeft, setMoveTimeLeft] = useState(0);
  const [score, setScore] = useState(0); // Current level score
  const [totalScore, setTotalScore] = useState(0); // Cumulative score across all levels
  const [level, setLevel] = useState(1);
  const [levelsCompleted, setLevelsCompleted] = useState(0);
  const [lastLevelScore, setLastLevelScore] = useState(0); // For level complete display
  const [lastTimeBonus, setLastTimeBonus] = useState(0); // For level complete display
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [cascadeLevel, setCascadeLevel] = useState(0);
  const [showCascade, setShowCascade] = useState(false);
  const [explosions, setExplosions] = useState<MatchExplosion[]>([]);
  const [hint, setHint] = useState<{ row: number; col: number }[] | null>(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [showPerfect, setShowPerfect] = useState(false);
  const [revertingOrbs, setRevertingOrbs] = useState<Set<string>>(new Set());
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [specialEffects, setSpecialEffects] = useState<SpecialEffect[]>([]);
  
  const gridRef = useRef<HTMLDivElement>(null);
  const moveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hintTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef(false);
  const orbsRef = useRef<Orb[]>(orbs);
  const lastSwapRef = useRef<SwapState | null>(null);
  
  useEffect(() => { orbsRef.current = orbs; }, [orbs]);

  const soulBonus = companionStats.soul / 100;
  const difficultyMod = DIFFICULTY_MULTIPLIERS[difficulty];

  // Level-based config
  const levelConfig = useMemo(() => {
    const cfg = getLevelConfig(level, difficultyMod);
    return {
      ...cfg,
      moveTime: Math.max(3, cfg.moveTime - questIntervalScale * 0.5 + soulBonus * 1.5),
    };
  }, [level, difficultyMod, questIntervalScale, soulBonus]);
  const effectiveTimeLimit = maxTimer ?? levelConfig.timeLimit;

  const availableColors = useMemo((): OrbColor[] => {
    const allColors: OrbColor[] = ['fire', 'water', 'earth', 'light', 'dark', 'cosmic'];
    return allColors.slice(0, levelConfig.colors);
  }, [levelConfig.colors]);

  const cellSize = useMemo(() => 280 / GRID_COLS, []);

  const findValidMove = useCallback((currentOrbs: Orb[]): { row: number; col: number }[] | null => {
    const grid: (Orb | null)[][] = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));
    currentOrbs.forEach(orb => { grid[orb.row][orb.col] = orb; });

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const orb = grid[row][col];
        if (!orb) continue;
        if (col < GRID_COLS - 1 && grid[row][col + 1]) {
          const testGrid = grid.map(r => [...r]);
          testGrid[row][col] = grid[row][col + 1];
          testGrid[row][col + 1] = orb;
          if (hasMatchInGrid(testGrid)) return [{ row, col }, { row, col: col + 1 }];
        }
        if (row < GRID_ROWS - 1 && grid[row + 1][col]) {
          const testGrid = grid.map(r => [...r]);
          testGrid[row][col] = grid[row + 1][col];
          testGrid[row + 1][col] = orb;
          if (hasMatchInGrid(testGrid)) return [{ row, col }, { row: row + 1, col }];
        }
      }
    }
    return null;
  }, []);

  const shuffleBoard = useCallback(() => {
    setIsShuffling(true);
    triggerHaptic('medium');
    // Deal tier-based damage to player for no valid moves
    onDamage?.({ target: 'player', amount: tierAttackDamage || 15, source: 'no_moves' });
    setTimeout(() => {
      setOrbs(currentOrbs => {
        const colors = currentOrbs.map(o => o.color);
        for (let i = colors.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [colors[i], colors[j]] = [colors[j], colors[i]];
        }
        return currentOrbs.map((orb, idx) => ({ ...orb, color: colors[idx] }));
      });
      setIsShuffling(false);
    }, 600);
  }, [onDamage]);

  const initializeGrid = useCallback((colorsOverride?: OrbColor[]) => {
    const colors = colorsOverride || availableColors;
    const newOrbs: Orb[] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        newOrbs.push({
          id: `${row}-${col}`,
          color: colors[Math.floor(Math.random() * colors.length)],
          row, col, special: 'normal',
        });
      }
    }
    setOrbs(newOrbs);
    orbsRef.current = newOrbs;
  }, [availableColors]);

  const startRound = useCallback(() => {
    initializeGrid();
    setMoveTimeLeft(levelConfig.moveTime);
    setSelectedOrb(null);
    setDragPath([]);
    setHint(null);
    isDraggingRef.current = false;
  }, [initializeGrid, levelConfig.moveTime]);

  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
    setTimeLeft(effectiveTimeLimit);
    startRound();
  }, [effectiveTimeLimit, startRound]);

  const resetHintTimer = useCallback(() => {
    setHint(null);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => {
      const validMove = findValidMove(orbsRef.current);
      if (validMove) { setHint(validMove); triggerHaptic('light'); }
    }, 4000);
  }, [findValidMove]);

  // Activate a special orb and return affected orbs - MUST be defined before findMatches
  const activateSpecial = useCallback((orb: Orb, grid: (Orb | null)[][], currentOrbs: Orb[]): {
    affectedIds: string[];
    bonusDamage: number;
    effectType: SpecialEffect['type'];
  } | null => {
    switch (orb.special) {
      case 'line_bomb': {
        const isHorizontal = orb.col % 2 === 0;
        const affected: string[] = [];
        if (isHorizontal) {
          for (let c = 0; c < GRID_COLS; c++) {
            const o = grid[orb.row][c];
            if (o) affected.push(o.id);
          }
        } else {
          for (let r = 0; r < GRID_ROWS; r++) {
            const o = grid[r][orb.col];
            if (o) affected.push(o.id);
          }
        }
        return {
          affectedIds: affected,
          bonusDamage: GAME_DAMAGE_VALUES.orb_match.specialActivation,
          effectType: isHorizontal ? 'beam_horizontal' : 'beam_vertical'
        };
      }
      case 'cross_bomb': {
        const affected: string[] = [];
        for (let c = 0; c < GRID_COLS; c++) {
          const o = grid[orb.row][c];
          if (o) affected.push(o.id);
        }
        for (let r = 0; r < GRID_ROWS; r++) {
          const o = grid[r][orb.col];
          if (o && !affected.includes(o.id)) affected.push(o.id);
        }
        return {
          affectedIds: affected,
          bonusDamage: GAME_DAMAGE_VALUES.orb_match.specialActivation,
          effectType: 'cross_beam'
        };
      }
      case 'star': {
        const affected = currentOrbs.filter(o => o.color === orb.color).map(o => o.id);
        return {
          affectedIds: affected,
          bonusDamage: GAME_DAMAGE_VALUES.orb_match.specialActivation,
          effectType: 'color_burst'
        };
      }
      case 'cosmic_nova': {
        const affected: string[] = [];
        for (let r = Math.max(0, orb.row - 1); r <= Math.min(GRID_ROWS - 1, orb.row + 1); r++) {
          for (let c = Math.max(0, orb.col - 1); c <= Math.min(GRID_COLS - 1, orb.col + 1); c++) {
            const o = grid[r][c];
            if (o) affected.push(o.id);
          }
        }
        return {
          affectedIds: affected,
          bonusDamage: GAME_DAMAGE_VALUES.orb_match.specialActivation,
          effectType: 'cosmic_nova'
        };
      }
      default:
        return null;
    }
  }, []);

  const findMatches = useCallback((currentOrbs: Orb[]): { 
    matched: Set<string>; 
    matchGroups: { ids: string[]; size: number; color: OrbColor; centerRow: number; centerCol: number; isHorizontal: boolean }[];
    specialsToCreate: SpecialCreation[];
    specialsActivated: { orb: Orb; affectedIds: string[]; bonusDamage: number; effectType: SpecialEffect['type'] }[];
  } => {
    const matchedIds = new Set<string>();
    const matchGroups: { ids: string[]; size: number; color: OrbColor; centerRow: number; centerCol: number; isHorizontal: boolean }[] = [];
    const specialsToCreate: SpecialCreation[] = [];
    const specialsActivated: { orb: Orb; affectedIds: string[]; bonusDamage: number; effectType: SpecialEffect['type'] }[] = [];
    
    const grid: (Orb | null)[][] = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));
    currentOrbs.forEach(orb => { grid[orb.row][orb.col] = orb; });

    const matchPositions = new Map<string, { row: number; col: number; color: OrbColor }>();

    // Horizontal matches
    for (let row = 0; row < GRID_ROWS; row++) {
      let col = 0;
      while (col < GRID_COLS) {
        const startOrb = grid[row][col];
        if (!startOrb) { col++; continue; }
        let matchLength = 1;
        while (col + matchLength < GRID_COLS && grid[row][col + matchLength]?.color === startOrb.color) matchLength++;
        if (matchLength >= 3) {
          const group: string[] = [];
          for (let i = 0; i < matchLength; i++) {
            const orb = grid[row][col + i];
            if (orb) { 
              matchedIds.add(orb.id); 
              group.push(orb.id);
              matchPositions.set(`${row}-${col + i}`, { row, col: col + i, color: startOrb.color });
            }
          }
          const centerCol = col + Math.floor(matchLength / 2);
          matchGroups.push({ ids: group, size: matchLength, color: startOrb.color, centerRow: row, centerCol, isHorizontal: true });
          
          if (matchLength === 4) {
            specialsToCreate.push({ row, col: centerCol, type: 'line_bomb', color: startOrb.color });
          } else if (matchLength >= 5) {
            specialsToCreate.push({ row, col: centerCol, type: 'cross_bomb', color: startOrb.color });
          }
        }
        col += Math.max(1, matchLength);
      }
    }

    // Vertical matches
    for (let col = 0; col < GRID_COLS; col++) {
      let row = 0;
      while (row < GRID_ROWS) {
        const startOrb = grid[row][col];
        if (!startOrb) { row++; continue; }
        let matchLength = 1;
        while (row + matchLength < GRID_ROWS && grid[row + matchLength][col]?.color === startOrb.color) matchLength++;
        if (matchLength >= 3) {
          const group: string[] = [];
          for (let i = 0; i < matchLength; i++) {
            const orb = grid[row + i][col];
            if (orb && !matchedIds.has(orb.id)) group.push(orb.id);
            if (orb) {
              matchedIds.add(orb.id);
              matchPositions.set(`${row + i}-${col}`, { row: row + i, col, color: startOrb.color });
            }
          }
          const centerRow = row + Math.floor(matchLength / 2);
          if (group.length > 0) {
            matchGroups.push({ ids: group, size: matchLength, color: startOrb.color, centerRow, centerCol: col, isHorizontal: false });
          }
          
          if (matchLength === 4) {
            specialsToCreate.push({ row: centerRow, col, type: 'line_bomb', color: startOrb.color });
          } else if (matchLength >= 5) {
            specialsToCreate.push({ row: centerRow, col, type: 'cross_bomb', color: startOrb.color });
          }
        }
        row += Math.max(1, matchLength);
      }
    }

    // Detect T/L shapes for star creation
    for (const [, pos] of matchPositions) {
      const hasHorizontalNeighbors = 
        (matchPositions.has(`${pos.row}-${pos.col - 1}`) && matchPositions.get(`${pos.row}-${pos.col - 1}`)?.color === pos.color) ||
        (matchPositions.has(`${pos.row}-${pos.col + 1}`) && matchPositions.get(`${pos.row}-${pos.col + 1}`)?.color === pos.color);
      const hasVerticalNeighbors = 
        (matchPositions.has(`${pos.row - 1}-${pos.col}`) && matchPositions.get(`${pos.row - 1}-${pos.col}`)?.color === pos.color) ||
        (matchPositions.has(`${pos.row + 1}-${pos.col}`) && matchPositions.get(`${pos.row + 1}-${pos.col}`)?.color === pos.color);
      
      if (hasHorizontalNeighbors && hasVerticalNeighbors) {
        const existingStarAtPos = specialsToCreate.find(s => s.row === pos.row && s.col === pos.col && s.type === 'star');
        if (!existingStarAtPos) {
          const existingIdx = specialsToCreate.findIndex(s => s.row === pos.row && s.col === pos.col);
          if (existingIdx >= 0) {
            specialsToCreate[existingIdx] = { row: pos.row, col: pos.col, type: 'star', color: pos.color };
          } else {
            specialsToCreate.push({ row: pos.row, col: pos.col, type: 'star', color: pos.color });
          }
        }
      }
    }

    // Check for special orbs being matched and activate them
    for (const id of matchedIds) {
      const orb = currentOrbs.find(o => o.id === id);
      if (orb && orb.special && orb.special !== 'normal') {
        const activation = activateSpecial(orb, grid, currentOrbs);
        if (activation) {
          specialsActivated.push({ orb, ...activation });
          activation.affectedIds.forEach(aid => matchedIds.add(aid));
        }
      }
    }

    // Check for two specials being matched together (cosmic nova)
    const specialOrbs = Array.from(matchedIds)
      .map(id => currentOrbs.find(o => o.id === id))
      .filter(o => o && o.special && o.special !== 'normal') as Orb[];
    
    if (specialOrbs.length >= 2) {
      const first = specialOrbs[0];
      const cosmicAffected: string[] = [];
      for (const sp of specialOrbs) {
        for (let r = Math.max(0, sp.row - 1); r <= Math.min(GRID_ROWS - 1, sp.row + 1); r++) {
          for (let c = Math.max(0, sp.col - 1); c <= Math.min(GRID_COLS - 1, sp.col + 1); c++) {
            const o = grid[r][c];
            if (o) cosmicAffected.push(o.id);
          }
        }
      }
      specialsActivated.push({
        orb: first,
        affectedIds: cosmicAffected,
        bonusDamage: GAME_DAMAGE_VALUES.orb_match.specialActivation,
        effectType: 'cosmic_nova'
      });
      cosmicAffected.forEach(id => matchedIds.add(id));
    }

    return { matched: matchedIds, matchGroups, specialsToCreate, specialsActivated };
  }, [activateSpecial]);

  const dropAndFill = useCallback((currentOrbs: Orb[], specialsToCreate: SpecialCreation[] = []): Orb[] => {
    const grid: (Orb | null)[][] = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));
    currentOrbs.forEach(orb => { if (!orb.matched) grid[orb.row][orb.col] = orb; });

    // Group specials by column for proper placement
    const specialsByCol = new Map<number, SpecialCreation[]>();
    specialsToCreate.forEach(s => {
      const existing = specialsByCol.get(s.col) || [];
      existing.push(s);
      specialsByCol.set(s.col, existing);
    });

    for (let col = 0; col < GRID_COLS; col++) {
      let emptyRow = GRID_ROWS - 1;
      for (let row = GRID_ROWS - 1; row >= 0; row--) {
        if (grid[row][col]) {
          if (row !== emptyRow) { 
            grid[emptyRow][col] = grid[row][col]; 
            grid[row][col] = null; 
          }
          emptyRow--;
        }
      }
      
      // Get specials for this column
      const colSpecials = specialsByCol.get(col) || [];
      let specialIndex = 0;
      
      for (let row = emptyRow; row >= 0; row--) {
        // Create special orb if available for this column
        const special = colSpecials[specialIndex];
        const isSpecialOrb = special && specialIndex < colSpecials.length;
        
        grid[row][col] = {
          id: `${row}-${col}-${Date.now()}-${Math.random()}`,
          color: isSpecialOrb ? special.color : availableColors[Math.floor(Math.random() * availableColors.length)],
          row, col, 
          special: isSpecialOrb ? special.type : 'normal', 
          isNew: true,
        };
        
        if (isSpecialOrb) specialIndex++;
      }
    }

    const newOrbs: Orb[] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const orb = grid[row][col];
        if (orb) newOrbs.push({ ...orb, row, col });
      }
    }
    return newOrbs;
  }, [availableColors]);

  const revertSwap = useCallback((swap: SwapState) => {
    triggerHaptic('error');
    setRevertingOrbs(new Set([swap.orb1.id, swap.orb2.id]));
    setOrbs(currentOrbs => currentOrbs.map(orb => {
      if (orb.id === swap.orb1.id) return { ...orb, row: swap.orb1.row, col: swap.orb1.col };
      if (orb.id === swap.orb2.id) return { ...orb, row: swap.orb2.row, col: swap.orb2.col };
      return orb;
    }));
    setTimeout(() => setRevertingOrbs(new Set()), 200);
  }, []);

  const processMatches = useCallback(async (currentOrbs: Orb[]): Promise<number> => {
    let orbsToProcess = currentOrbs;
    let currentCascade = 0;
    let totalScore = 0;

    const processNextCascade = async (): Promise<void> => {
      const { matched, matchGroups, specialsToCreate, specialsActivated } = findMatches(orbsToProcess);
      
      if (matched.size >= 3) {
        currentCascade++;
        setCascadeLevel(currentCascade);
        if (currentCascade > 1) { setShowCascade(true); setTimeout(() => setShowCascade(false), 500); }

        // Process special activations - add visual effects and deal bonus damage
        for (const activation of specialsActivated) {
          const newEffect: SpecialEffect = {
            id: `effect-${Date.now()}-${Math.random()}`,
            type: activation.effectType,
            row: activation.orb.row,
            col: activation.orb.col,
            color: ORB_COLORS[activation.orb.color].glow,
          };
          setSpecialEffects(prev => [...prev, newEffect]);
          
          // Deal bonus damage for special
          onDamage?.({ 
            target: 'adversary', 
            amount: activation.bonusDamage, 
            source: `special_${activation.orb.special}`,
            isCritical: true 
          });
          
          totalScore += activation.bonusDamage * 5; // Bonus score for specials
          triggerHaptic('heavy');
        }

        const newExplosions: MatchExplosion[] = matchGroups.map(group => {
          const baseScore = group.size * 10;
          const cascadeMultiplier = 1 + (currentCascade - 1) * 0.5;
          const groupScore = Math.round(baseScore * cascadeMultiplier);
          totalScore += groupScore;
          
          // Note: Per-match damage removed - only special activations deal damage now
          
          return {
            id: `exp-${Date.now()}-${Math.random()}`,
            x: group.centerCol * cellSize + cellSize / 2,
            y: group.centerRow * cellSize + cellSize / 2,
            color: ORB_COLORS[group.color].glow, size: group.size, score: groupScore,
          };
        });
        setExplosions(prev => [...prev, ...newExplosions]);
        
        orbsToProcess = orbsToProcess.map(orb => matched.has(orb.id) ? { ...orb, matched: true } : orb);
        setOrbs([...orbsToProcess]);
        orbsRef.current = [...orbsToProcess];
        
        if (matched.size >= 5 || specialsActivated.length > 0) {
          triggerHaptic('heavy');
        } else {
          triggerHaptic('success');
        }
        
        await new Promise(resolve => setTimeout(resolve, specialsActivated.length > 0 ? 350 : 200));
        orbsToProcess = dropAndFill(orbsToProcess, specialsToCreate);
        setOrbs([...orbsToProcess]);
        orbsRef.current = [...orbsToProcess];
        
        await new Promise(resolve => setTimeout(resolve, 180));
        await processNextCascade();
      }
    };

    await processNextCascade();

    if (currentCascade > 0) {
      setScore(s => s + totalScore);
      setCombo(c => { const newCombo = c + currentCascade; setMaxCombo(m => Math.max(m, newCombo)); return newCombo; });
      setMoveTimeLeft(levelConfig.moveTime);
      resetHintTimer();
      setTimeout(() => {
        const validMove = findValidMove(orbsRef.current);
        if (!validMove && gameState === 'playing') shuffleBoard();
      }, 200);
    }
    setCascadeLevel(0);
    return currentCascade;
  }, [findMatches, dropAndFill, levelConfig.moveTime, cellSize, resetHintTimer, findValidMove, gameState, shuffleBoard, onDamage]);

  const getCellFromPosition = useCallback((clientX: number, clientY: number): { row: number; col: number } | null => {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const col = Math.floor((clientX - rect.left) / (rect.width / GRID_COLS));
    const row = Math.floor((clientY - rect.top) / (rect.height / GRID_ROWS));
    return (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) ? { row, col } : null;
  }, []);

  const swapOrbs = useCallback((orb1: Orb, orb2: Orb) => {
    lastSwapRef.current = { orb1: { id: orb1.id, row: orb1.row, col: orb1.col }, orb2: { id: orb2.id, row: orb2.row, col: orb2.col } };
    setOrbs(currentOrbs => {
      const newOrbs = currentOrbs.map(orb => {
        if (orb.id === orb1.id) return { ...orb, row: orb2.row, col: orb2.col };
        if (orb.id === orb2.id) return { ...orb, row: orb1.row, col: orb1.col };
        return orb;
      });
      orbsRef.current = newOrbs;
      return newOrbs;
    });
  }, []);

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    if (gameState !== 'playing' || moveTimeLeft <= 0 || isShuffling) return;
    const cell = getCellFromPosition(clientX, clientY);
    if (!cell) return;
    const orb = orbs.find(o => o.row === cell.row && o.col === cell.col);
    if (orb) {
      setSelectedOrb(orb); setDragPath([orb.id]); isDraggingRef.current = true;
      triggerHaptic('light'); setHint(null);
    }
  }, [gameState, moveTimeLeft, isShuffling, getCellFromPosition, orbs]);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDraggingRef.current || !selectedOrb || gameState !== 'playing') return;
    const cell = getCellFromPosition(clientX, clientY);
    if (!cell) return;
    const currentOrb = orbs.find(o => o.id === selectedOrb.id);
    if (!currentOrb) return;
    const rowDiff = Math.abs(cell.row - currentOrb.row);
    const colDiff = Math.abs(cell.col - currentOrb.col);
    if ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) {
      const targetOrb = orbs.find(o => o.row === cell.row && o.col === cell.col);
      if (targetOrb && targetOrb.id !== selectedOrb.id) {
        swapOrbs(currentOrb, targetOrb);
        setDragPath(prev => [...prev, targetOrb.id]);
        triggerHaptic('light');
        setSelectedOrb({ ...currentOrb, row: cell.row, col: cell.col });
      }
    }
  }, [selectedOrb, gameState, getCellFromPosition, orbs, swapOrbs]);

  const handleDragEnd = useCallback(async () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (dragPath.length > 1) {
      if (moveTimerRef.current) { clearInterval(moveTimerRef.current); moveTimerRef.current = null; }
      const matchCount = await processMatches(orbsRef.current);
      if (matchCount === 0 && lastSwapRef.current) revertSwap(lastSwapRef.current);
      lastSwapRef.current = null;
    }
    setSelectedOrb(null); setDragPath([]); resetHintTimer();
  }, [dragPath, processMatches, revertSwap, resetHintTimer]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => handleDragStart(e.clientX, e.clientY), [handleDragStart]);
  const handleMouseMove = useCallback((e: React.MouseEvent) => handleDragMove(e.clientX, e.clientY), [handleDragMove]);
  const handleMouseUp = useCallback(() => handleDragEnd(), [handleDragEnd]);
  const handleTouchStart = useCallback((e: React.TouchEvent) => { e.preventDefault(); handleDragStart(e.touches[0].clientX, e.touches[0].clientY); }, [handleDragStart]);
  const handleTouchMove = useCallback((e: React.TouchEvent) => { e.preventDefault(); handleDragMove(e.touches[0].clientX, e.touches[0].clientY); }, [handleDragMove]);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => { e.preventDefault(); handleDragEnd(); }, [handleDragEnd]);

  // Move timer - 150ms interval (smoother than 100ms with less overhead)
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    // If move timer is at 0 and not dragging, reset it to allow new moves
    if (moveTimeLeft <= 0 && !isDraggingRef.current) {
      setMoveTimeLeft(levelConfig.moveTime);
      return;
    }
    
    if (moveTimeLeft <= 0) return;
    
    moveTimerRef.current = setInterval(() => {
      setMoveTimeLeft(prev => {
        if (prev <= 0.15) { 
          if (isDraggingRef.current) handleDragEnd(); 
          return 0; 
        }
        return prev - 0.15;
      });
    }, 150);
    return () => { if (moveTimerRef.current) clearInterval(moveTimerRef.current); };
  }, [gameState, moveTimeLeft, handleDragEnd, levelConfig.moveTime]);

  // Game timer
  useEffect(() => {
    if (gameState !== 'playing') return;
    const timer = setInterval(() => {
      setTimeLeft(prev => { if (prev <= 1) { setGameState('complete'); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'playing') resetHintTimer();
    return () => { if (hintTimerRef.current) clearTimeout(hintTimerRef.current); };
  }, [gameState, resetHintTimer]);

  // Check for level completion (score target reached)
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (score >= levelConfig.targetScore) {
      // Level complete!
      const timeBonus = timeLeft * 5;
      const levelScoreWithBonus = score + timeBonus;
      
      // Store for display
      setLastLevelScore(score);
      setLastTimeBonus(timeBonus);
      setTotalScore(prev => prev + levelScoreWithBonus);
      setLevelsCompleted(prev => prev + 1);

      if (isPractice) {
        setGameState('complete');
        return;
      }
      
      // Deal milestone damage
      onDamage?.({ target: 'adversary', amount: GAME_DAMAGE_VALUES.orb_match.scoreTarget, source: 'level_complete' });
      
      triggerHaptic('heavy');
      setGameState('levelComplete');
    }
  }, [score, levelConfig.targetScore, gameState, timeLeft, onDamage, isPractice]);

  // Handle advancing to next level
  const advanceToNextLevel = useCallback(() => {
    const nextLevel = level + 1;
    setLevel(nextLevel);
    setScore(0);
    setCombo(0);
    setShowLevelUp(true);
    setTimeout(() => setShowLevelUp(false), 1000);
    
    // Get next level config and colors
    const nextLevelCfg = getLevelConfig(nextLevel, difficultyMod);
    const allColors: OrbColor[] = ['fire', 'water', 'earth', 'light', 'dark', 'cosmic'];
    const nextLevelColors = allColors.slice(0, nextLevelCfg.colors);
    
    setTimeLeft(maxTimer ?? nextLevelCfg.timeLimit);
    initializeGrid(nextLevelColors);
    setMoveTimeLeft(nextLevelCfg.moveTime);
    setGameState('playing');
  }, [level, difficultyMod, initializeGrid, maxTimer]);

  // Game over logic
  useEffect(() => {
    if (gameState === 'complete') {
      const finalScore = totalScore + score; // Include any partial level score
      const passed = levelsCompleted >= 1;
      
      if (levelsCompleted >= 3) { setShowPerfect(true); triggerHaptic('heavy'); }
      
      const comboBonus = Math.min(maxCombo * 2, 15);
      const levelBonus = levelsCompleted * 5;
      const accuracy = passed 
        ? Math.round(Math.min(100, 50 + levelBonus + comboBonus))
        : Math.round(Math.min(50, (score / levelConfig.targetScore) * 50));
      const result: 'perfect' | 'good' | 'fail' = levelsCompleted >= 5 ? 'perfect' : passed ? 'good' : 'fail';
      
      setTimeout(() => onComplete({ 
        success: passed, 
        accuracy, 
        result, 
        highScoreValue: finalScore,
        gameStats: {
          score: finalScore,
          level,
          levelsCompleted,
          maxCombo,
          time: timeLeft,
          timeBonus: lastTimeBonus,
        },
      }), levelsCompleted >= 3 ? 1200 : 400);
    }
  }, [gameState, score, totalScore, levelsCompleted, level, levelConfig.targetScore, maxCombo, timeLeft, lastTimeBonus, onComplete]);

  const removeExplosion = useCallback((id: string) => setExplosions(prev => prev.filter(e => e.id !== id)), []);
  const removeSpecialEffect = useCallback((id: string) => setSpecialEffects(prev => prev.filter(e => e.id !== id)), []);
  const scoreProgress = score / levelConfig.targetScore;
  const isUrgent = timeLeft <= 5 && gameState === 'playing';

  return (
    <div className="flex flex-col items-center relative flex-1 min-h-0">
      {gameState === 'countdown' && <CountdownOverlay count={3} onComplete={handleCountdownComplete} />}
      <AnimatePresence>{gameState === 'paused' && <PauseOverlay onResume={() => setGameState('playing')} />}</AnimatePresence>
      <AnimatePresence>
        {gameState === 'levelComplete' && (
          <LevelCompleteOverlay 
            level={level}
            levelScore={lastLevelScore}
            timeBonus={lastTimeBonus}
            totalScore={totalScore}
            onContinue={advanceToNextLevel}
          />
        )}
      </AnimatePresence>

      <GameHUD
        title={`Starburst - Level ${level}`} subtitle={`Target: ${levelConfig.targetScore} pts`}
        timeLeft={timeLeft} totalTime={effectiveTimeLimit} combo={combo} showCombo={true}
        primaryStat={{ value: score, label: `${score}/${levelConfig.targetScore}`, color: score >= levelConfig.targetScore ? '#22c55e' : '#a855f7' }}
        secondaryStat={{ value: levelsCompleted, label: `${levelsCompleted} cleared`, color: '#22d3ee' }}
        isPaused={gameState === 'paused'} onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
        compact={compact}
      />

      <div className="relative w-full max-w-xs mb-2">
        <LevelIndicator level={level} progress={scoreProgress} targetScore={levelConfig.targetScore} />
        <div className="absolute right-0 top-0">
          <ScoreProgressRing progress={scoreProgress} isComplete={score >= levelConfig.targetScore} />
        </div>
        {gameState === 'playing' && (
          <div className="pt-8">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${moveTimeLeft < 2 ? 'animate-pulse' : ''}`}
                style={{ 
                  width: `${(moveTimeLeft / levelConfig.moveTime) * 100}%`,
                  background: moveTimeLeft < 2 ? 'linear-gradient(90deg, #ef4444, #f87171)' : 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))',
                }}
              />
            </div>
            <p className="text-xs text-center text-muted-foreground mt-1">Move: {moveTimeLeft.toFixed(1)}s</p>
          </div>
        )}
      </div>

      {!compact && (
        <button className="text-xs text-muted-foreground mb-2 underline" onClick={() => setShowAccessibility(!showAccessibility)}>
          {showAccessibility ? 'Show Emojis' : 'Show Shapes'}
        </button>
      )}

      <div
        ref={gridRef}
        className="relative w-full max-w-xs rounded-2xl overflow-hidden cursor-pointer touch-none game-container"
        style={{ aspectRatio: `${GRID_COLS}/${GRID_ROWS}`, maxWidth: 300 }}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
      >
        <StarBackground />
        
        {/* Grid lines */}
        <div className="absolute inset-0 pointer-events-none grid-lines" />

        {hint && <HintIndicator orbs={hint} cellSize={cellSize} />}

        {orbs.map(orb => (
          <OrbComponent
            key={orb.id} orb={orb} cellSize={cellSize}
            isSelected={selectedOrb?.id === orb.id} isDragging={isDraggingRef.current}
            isInPath={dragPath.includes(orb.id)} isReverting={revertingOrbs.has(orb.id)}
            showAccessibility={showAccessibility}
          />
        ))}

        {explosions.map(explosion => (
          <MatchExplosionEffect key={explosion.id} explosion={explosion} onComplete={() => removeExplosion(explosion.id)} />
        ))}

        {/* Special ability effects */}
        <AnimatePresence>
          {specialEffects.map(effect => {
            switch (effect.type) {
              case 'beam_horizontal':
              case 'beam_vertical':
                return <BeamEffect key={effect.id} effect={effect} cellSize={cellSize} onComplete={() => removeSpecialEffect(effect.id)} />;
              case 'cross_beam':
                return <CrossBeamEffect key={effect.id} effect={effect} cellSize={cellSize} onComplete={() => removeSpecialEffect(effect.id)} />;
              case 'color_burst':
                return <ColorBurstEffect key={effect.id} effect={effect} cellSize={cellSize} onComplete={() => removeSpecialEffect(effect.id)} />;
              case 'cosmic_nova':
                return <CosmicNovaEffect key={effect.id} effect={effect} cellSize={cellSize} onComplete={() => removeSpecialEffect(effect.id)} />;
              default:
                return null;
            }
          })}
        </AnimatePresence>

        {showCascade && cascadeLevel > 1 && <CascadeMultiplier multiplier={cascadeLevel} />}
        {isUrgent && <UrgencyOverlay />}
        {isShuffling && <ShuffleOverlay />}
        {showPerfect && <PerfectGameBanner />}
        <AnimatePresence>{showLevelUp && <LevelUpBanner />}</AnimatePresence>
      </div>

      {!compact && (
        <>
          <div className="flex flex-wrap justify-center gap-3 mt-4 text-xs">
            {availableColors.slice(0, 4).map(color => (
              <div key={color} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/10">
                <span className="text-sm">{showAccessibility ? ORB_SHAPES[color] : ORB_COLORS[color].emoji}</span>
                <span className="capitalize text-white/60 font-medium">{color}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/40 mt-3 text-center font-medium">Match 4+ for specials • T/L shapes = ★ Star • Match specials for big damage!</p>
        </>
      )}

      <style>{`
        .orb-base {
          transition: transform 120ms ease-out, box-shadow 100ms ease-out;
          will-change: transform;
        }
        .orb-matched {
          animation: orb-pop 180ms ease-out forwards;
        }
        .orb-new {
          animation: orb-drop 200ms ease-out;
        }
        .orb-revert {
          animation: orb-shake 150ms ease-out;
        }
        @keyframes orb-pop {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
          100% { transform: scale(0); opacity: 0; }
        }
        @keyframes orb-drop {
          0% { transform: translateY(var(--start-y, -80px)) scale(0.8); opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes orb-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .selection-ring {
          border: 2px solid;
          animation: ring-pulse 400ms ease-in-out infinite;
        }
        @keyframes ring-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .hint-pulse {
          border: 3px solid rgba(255, 215, 0, 0.8);
          box-shadow: 0 0 12px rgba(255, 215, 0, 0.6);
          animation: hint-glow 800ms ease-in-out infinite;
        }
        @keyframes hint-glow {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        .explosion-effect {
          transform: translate(-50%, -50%);
        }
        .explosion-ring {
          position: absolute;
          width: 50px; height: 50px;
          left: -25px; top: -25px;
          border: 3px solid;
          border-radius: 50%;
          animation: ring-expand 350ms ease-out forwards;
        }
        @keyframes ring-expand {
          0% { transform: scale(0); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
        .explosion-score {
          position: absolute;
          font-size: 16px; font-weight: 800;
          text-shadow: 0 0 8px currentColor, 0 2px 4px rgba(0,0,0,0.5);
          animation: score-float 400ms ease-out forwards;
        }
        @keyframes score-float {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-40px); opacity: 0; }
        }
        .cascade-popup {
          animation: cascade-pop 500ms ease-out forwards;
        }
        @keyframes cascade-pop {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          30% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
        }
        .urgency-pulse {
          box-shadow: inset 0 0 40px rgba(239, 68, 68, 0.4);
          border: 2px solid rgba(239, 68, 68, 0.5);
          animation: urgency 400ms ease-in-out infinite;
        }
        @keyframes urgency {
          0%, 100% { box-shadow: inset 0 0 40px rgba(239, 68, 68, 0.3); }
          50% { box-shadow: inset 0 0 60px rgba(239, 68, 68, 0.5); }
        }
        .perfect-banner {
          animation: banner-pop 300ms ease-out;
        }
        @keyframes banner-pop {
          0% { transform: scale(0) rotate(-10deg); opacity: 0; }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        .game-container {
          background: linear-gradient(145deg, rgba(0,0,0,0.85) 0%, rgba(15,15,35,0.95) 50%, rgba(25,15,45,0.9) 100%);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 20px 40px -12px rgba(0,0,0,0.6);
        }
        .grid-lines {
          background-image: 
            linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: calc(100% / 6) calc(100% / 5);
        }
        .stars-layer {
          position: absolute; inset: 0;
          background-image: radial-gradient(1px 1px at 10% 20%, white, transparent),
            radial-gradient(1px 1px at 30% 60%, white, transparent),
            radial-gradient(1px 1px at 50% 30%, white, transparent),
            radial-gradient(1px 1px at 70% 80%, white, transparent),
            radial-gradient(1px 1px at 90% 40%, white, transparent);
        }
        .drop-shadow-glow { text-shadow: 0 0 20px rgba(250,204,21,0.8); }
        .shadow-glow-yellow { box-shadow: 0 0 40px rgba(250,204,21,0.4); }
        .shadow-glow-purple { box-shadow: 0 0 40px rgba(168,85,247,0.4); }
        
        /* Special orb animations */
        @keyframes special-pulse {
          0%, 100% { box-shadow: 0 0 10px rgba(255,255,255,0.5); }
          50% { box-shadow: 0 0 25px rgba(255,255,255,0.9), 0 0 35px rgba(255,255,255,0.4); }
        }
        @keyframes special-rainbow {
          0% { border-color: gold; box-shadow: 0 0 15px gold; }
          33% { border-color: #ff6b6b; box-shadow: 0 0 15px #ff6b6b; }
          66% { border-color: #4facfe; box-shadow: 0 0 15px #4facfe; }
          100% { border-color: gold; box-shadow: 0 0 15px gold; }
        }
        @keyframes special-rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes special-nova {
          0%, 100% { box-shadow: 0 0 15px rgba(236,72,153,0.6), 0 0 30px rgba(168,85,247,0.3); }
          50% { box-shadow: 0 0 30px rgba(236,72,153,0.9), 0 0 50px rgba(168,85,247,0.6); }
        }
      `}</style>
    </div>
  );
};
