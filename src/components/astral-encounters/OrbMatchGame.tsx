import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic, useStaticStars } from './gameUtils';

import { DamageEvent, GAME_DAMAGE_VALUES } from '@/types/battleSystem';

interface OrbMatchGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  onDamage?: (event: DamageEvent) => void;
  tierAttackDamage?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
  maxTimer?: number;
  isPractice?: boolean;
}

type OrbColor = 'fire' | 'water' | 'earth' | 'light' | 'dark' | 'cosmic';
type SpecialType = 'normal' | 'line_bomb' | 'star' | 'cross_bomb';

interface Orb {
  id: string;
  color: OrbColor;
  row: number;
  col: number;
  matched?: boolean;
  special?: SpecialType;
  isNew?: boolean;
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

// OPTIMIZED Orb Component - CSS transforms only, no Framer layout
const OrbComponent = memo(({ 
  orb, cellSize, isSelected, isDragging, isInPath, isReverting, showAccessibility,
}: { 
  orb: Orb; cellSize: number; isSelected: boolean; isDragging: boolean;
  isInPath: boolean; isReverting?: boolean; showAccessibility?: boolean;
}) => {
  const colorConfig = ORB_COLORS[orb.color];
  const orbSize = cellSize - 8;
  
  const specialBorder = orb.special === 'line_bomb' ? '3px dashed rgba(255,255,255,0.8)' 
    : orb.special === 'star' ? '3px solid gold'
    : orb.special === 'cross_bomb' ? '3px double rgba(255,255,255,0.8)'
    : '2px solid rgba(255,255,255,0.25)';
  
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
        border: specialBorder,
        transform: `translate(${x}px, ${y}px) scale(${scale})`,
        boxShadow: isSelected || isInPath 
          ? `0 8px 20px rgba(0,0,0,0.4), 0 0 15px ${colorConfig.glow}` 
          : `0 4px 10px rgba(0,0,0,0.3), 0 0 10px ${colorConfig.glow}`,
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
      <span className="text-base select-none relative z-10 drop-shadow-sm">
        {showAccessibility ? ORB_SHAPES[orb.color] : colorConfig.emoji}
      </span>
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
  companionStats, onComplete, onDamage, tierAttackDamage, difficulty = 'medium', questIntervalScale = 0, maxTimer, isPractice = false,
}: OrbMatchGameProps) => {
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'complete'>('countdown');
  const [orbs, setOrbs] = useState<Orb[]>([]);
  const [selectedOrb, setSelectedOrb] = useState<Orb | null>(null);
  const [dragPath, setDragPath] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [moveTimeLeft, setMoveTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
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
  
  const gridRef = useRef<HTMLDivElement>(null);
  const moveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hintTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef(false);
  const orbsRef = useRef<Orb[]>(orbs);
  const lastSwapRef = useRef<SwapState | null>(null);
  
  useEffect(() => { orbsRef.current = orbs; }, [orbs]);

  const soulBonus = companionStats.soul / 100;

  const config = useMemo(() => {
    const settings = {
      easy: { colors: 5 as const, moveTime: 6, targetScore: 150, totalTime: 30 },
      medium: { colors: 5 as const, moveTime: 5, targetScore: 200, totalTime: 30 },
      hard: { colors: 6 as const, moveTime: 4, targetScore: 280, totalTime: 30 },
    };
    const s = settings[difficulty];
    const effectiveTotalTime = maxTimer ?? s.totalTime;
    const effectiveTargetScore = isPractice ? Math.floor(s.targetScore * 0.5) : s.targetScore;
    return {
      ...s, totalTime: effectiveTotalTime, targetScore: effectiveTargetScore,
      moveTime: Math.max(3, s.moveTime - questIntervalScale * 0.5 + soulBonus * 1.5),
    };
  }, [difficulty, questIntervalScale, soulBonus, maxTimer, isPractice]);

  const availableColors = useMemo((): OrbColor[] => {
    const allColors: OrbColor[] = ['fire', 'water', 'earth', 'light', 'dark', 'cosmic'];
    return allColors.slice(0, config.colors);
  }, [config.colors]);

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
    // Deal damage to player for no valid moves
    onDamage?.({ target: 'player', amount: GAME_DAMAGE_VALUES.orb_match.noMoves, source: 'no_moves' });
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

  const initializeGrid = useCallback(() => {
    const newOrbs: Orb[] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        newOrbs.push({
          id: `${row}-${col}`,
          color: availableColors[Math.floor(Math.random() * availableColors.length)],
          row, col, special: 'normal',
        });
      }
    }
    setOrbs(newOrbs);
    orbsRef.current = newOrbs;
  }, [availableColors]);

  const startRound = useCallback(() => {
    initializeGrid();
    setMoveTimeLeft(config.moveTime);
    setSelectedOrb(null);
    setDragPath([]);
    setHint(null);
    isDraggingRef.current = false;
  }, [initializeGrid, config.moveTime]);

  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
    setTimeLeft(config.totalTime);
    startRound();
  }, [config.totalTime, startRound]);

  const resetHintTimer = useCallback(() => {
    setHint(null);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => {
      const validMove = findValidMove(orbsRef.current);
      if (validMove) { setHint(validMove); triggerHaptic('light'); }
    }, 4000);
  }, [findValidMove]);

  const findMatches = useCallback((currentOrbs: Orb[]): { matched: Set<string>; matchGroups: { ids: string[]; size: number; color: OrbColor; centerRow: number; centerCol: number }[] } => {
    const matchedIds = new Set<string>();
    const matchGroups: { ids: string[]; size: number; color: OrbColor; centerRow: number; centerCol: number }[] = [];
    const grid: (Orb | null)[][] = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));
    currentOrbs.forEach(orb => { grid[orb.row][orb.col] = orb; });

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
            if (orb) { matchedIds.add(orb.id); group.push(orb.id); }
          }
          matchGroups.push({ ids: group, size: matchLength, color: startOrb.color, centerRow: row, centerCol: col + Math.floor(matchLength / 2) });
        }
        col += Math.max(1, matchLength);
      }
    }

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
            if (orb) matchedIds.add(orb.id);
          }
          if (group.length > 0) {
            matchGroups.push({ ids: group, size: matchLength, color: startOrb.color, centerRow: row + Math.floor(matchLength / 2), centerCol: col });
          }
        }
        row += Math.max(1, matchLength);
      }
    }
    return { matched: matchedIds, matchGroups };
  }, []);

  const dropAndFill = useCallback((currentOrbs: Orb[]): Orb[] => {
    const grid: (Orb | null)[][] = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));
    currentOrbs.forEach(orb => { if (!orb.matched) grid[orb.row][orb.col] = orb; });

    for (let col = 0; col < GRID_COLS; col++) {
      let emptyRow = GRID_ROWS - 1;
      for (let row = GRID_ROWS - 1; row >= 0; row--) {
        if (grid[row][col]) {
          if (row !== emptyRow) { grid[emptyRow][col] = grid[row][col]; grid[row][col] = null; }
          emptyRow--;
        }
      }
      for (let row = emptyRow; row >= 0; row--) {
        grid[row][col] = {
          id: `${row}-${col}-${Date.now()}-${Math.random()}`,
          color: availableColors[Math.floor(Math.random() * availableColors.length)],
          row, col, special: 'normal', isNew: true,
        };
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
      const { matched, matchGroups } = findMatches(orbsToProcess);
      
      if (matched.size >= 3) {
        currentCascade++;
        setCascadeLevel(currentCascade);
        if (currentCascade > 1) { setShowCascade(true); setTimeout(() => setShowCascade(false), 500); }

        const newExplosions: MatchExplosion[] = matchGroups.map(group => {
          const baseScore = group.size * 10;
          const cascadeMultiplier = 1 + (currentCascade - 1) * 0.5;
          const groupScore = Math.round(baseScore * cascadeMultiplier);
          totalScore += groupScore;
          
          // Deal damage to adversary based on match size
          const damageAmount = group.size >= 5 
            ? GAME_DAMAGE_VALUES.orb_match.match5 
            : group.size >= 4 
              ? GAME_DAMAGE_VALUES.orb_match.match4 
              : GAME_DAMAGE_VALUES.orb_match.match3;
          onDamage?.({ target: 'adversary', amount: damageAmount, source: `match_${group.size}` });
          
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
        
        matched.size >= 5 ? triggerHaptic('heavy') : triggerHaptic('success');
        
        await new Promise(resolve => setTimeout(resolve, 200));
        orbsToProcess = dropAndFill(orbsToProcess);
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
      setMoveTimeLeft(config.moveTime);
      resetHintTimer();
      setTimeout(() => {
        const validMove = findValidMove(orbsRef.current);
        if (!validMove && gameState === 'playing') shuffleBoard();
      }, 200);
    }
    setCascadeLevel(0);
    return currentCascade;
  }, [findMatches, dropAndFill, config.moveTime, cellSize, resetHintTimer, findValidMove, gameState, shuffleBoard]);

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
    if (gameState !== 'playing' || moveTimeLeft <= 0) return;
    moveTimerRef.current = setInterval(() => {
      setMoveTimeLeft(prev => {
        if (prev <= 0.15) { if (isDraggingRef.current) handleDragEnd(); return 0; }
        return prev - 0.15;
      });
    }, 150);
    return () => { if (moveTimerRef.current) clearInterval(moveTimerRef.current); };
  }, [gameState, moveTimeLeft, handleDragEnd]);

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

  useEffect(() => {
    if (gameState === 'complete') {
      const isPerfect = score >= config.targetScore && timeLeft > 5;
      const finalScore = isPerfect ? score + 50 : score;
      if (isPerfect) { setShowPerfect(true); triggerHaptic('heavy'); }
      const passed = finalScore >= config.targetScore;
      const comboBonus = Math.min(maxCombo * 2, 15);
      const accuracy = passed 
        ? Math.round(Math.min(100, 70 + ((finalScore - config.targetScore) / config.targetScore) * 30 + comboBonus))
        : Math.round(Math.min(50, (finalScore / config.targetScore) * 50));
      const result = passed && accuracy >= 90 ? 'perfect' : passed && accuracy >= 70 ? 'good' : passed ? 'partial' : 'fail';
      setTimeout(() => onComplete({ success: passed, accuracy, result }), isPerfect ? 1200 : 400);
    }
  }, [gameState, score, config.targetScore, maxCombo, timeLeft, onComplete]);

  const removeExplosion = useCallback((id: string) => setExplosions(prev => prev.filter(e => e.id !== id)), []);
  const scoreProgress = score / config.targetScore;
  const isUrgent = timeLeft <= 5 && gameState === 'playing';

  return (
    <div className="flex flex-col items-center relative">
      {gameState === 'countdown' && <CountdownOverlay count={3} onComplete={handleCountdownComplete} />}
      <AnimatePresence>{gameState === 'paused' && <PauseOverlay onResume={() => setGameState('playing')} />}</AnimatePresence>

      <GameHUD
        title="Orb Match" subtitle={`Target: ${config.targetScore} pts`}
        timeLeft={timeLeft} totalTime={config.totalTime} combo={combo} showCombo={true}
        primaryStat={{ value: score, label: `${score}/${config.targetScore}`, color: score >= config.targetScore ? '#22c55e' : '#a855f7' }}
        secondaryStat={{ value: Math.round(scoreProgress * 100), label: `${Math.min(100, Math.round(scoreProgress * 100))}%`, color: '#22d3ee' }}
        isPaused={gameState === 'paused'} onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      />

      <div className="relative w-full max-w-xs mb-2">
        <div className="absolute right-0 top-0">
          <ScoreProgressRing progress={scoreProgress} isComplete={score >= config.targetScore} />
        </div>
        {gameState === 'playing' && (
          <div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${moveTimeLeft < 2 ? 'animate-pulse' : ''}`}
                style={{ 
                  width: `${(moveTimeLeft / config.moveTime) * 100}%`,
                  background: moveTimeLeft < 2 ? 'linear-gradient(90deg, #ef4444, #f87171)' : 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))',
                }}
              />
            </div>
            <p className="text-xs text-center text-muted-foreground mt-1">Move: {moveTimeLeft.toFixed(1)}s</p>
          </div>
        )}
      </div>

      <button className="text-xs text-muted-foreground mb-2 underline" onClick={() => setShowAccessibility(!showAccessibility)}>
        {showAccessibility ? 'Show Emojis' : 'Show Shapes'}
      </button>

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

        {showCascade && cascadeLevel > 1 && <CascadeMultiplier multiplier={cascadeLevel} />}
        {isUrgent && <UrgencyOverlay />}
        {isShuffling && <ShuffleOverlay />}
        {showPerfect && <PerfectGameBanner />}
      </div>

      <div className="flex flex-wrap justify-center gap-3 mt-4 text-xs">
        {availableColors.slice(0, 4).map(color => (
          <div key={color} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/10">
            <span className="text-sm">{showAccessibility ? ORB_SHAPES[color] : ORB_COLORS[color].emoji}</span>
            <span className="capitalize text-white/60 font-medium">{color}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-white/40 mt-3 text-center font-medium">Drag to swap • Match 3+ • Chain combos!</p>

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
      `}</style>
    </div>
  );
};
