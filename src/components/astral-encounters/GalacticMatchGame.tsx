import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';
import { triggerHaptic } from './gameUtils';
import { playHabitComplete, playXPGain, playMissionComplete } from '@/utils/soundEffects';
import { Heart } from 'lucide-react';

interface Card {
  id: string;
  symbolIndex: number;
  isFlipped: boolean;
  isMatched: boolean;
}

import { DamageEvent, GAME_DAMAGE_VALUES } from '@/types/battleSystem';
import { ArcadeDifficulty } from '@/types/arcadeDifficulty';

interface GalacticMatchGameProps {
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

// Difficulty config for lives and reveal time
const DIFFICULTY_CONFIG: Record<ArcadeDifficulty, { startLives: number; revealTimeMultiplier: number; startPairs: number }> = {
  beginner: { startLives: 5, revealTimeMultiplier: 1.8, startPairs: 2 },
  easy: { startLives: 4, revealTimeMultiplier: 1.5, startPairs: 2 },
  medium: { startLives: 3, revealTimeMultiplier: 1.2, startPairs: 2 },
  hard: { startLives: 2, revealTimeMultiplier: 1.0, startPairs: 3 },
  master: { startLives: 1, revealTimeMultiplier: 0.75, startPairs: 4 },
};

const MAX_LIVES_BY_DIFFICULTY: Record<ArcadeDifficulty, number> = {
  beginner: 5,
  easy: 4,
  medium: 3,
  hard: 2,
  master: 1,
};

// Cosmic symbols with colors
const COSMIC_SYMBOLS = [
  { emoji: '⭐', name: 'Star', color: 'hsl(45, 93%, 58%)' },
  { emoji: '🌙', name: 'Moon', color: 'hsl(210, 20%, 75%)' },
  { emoji: '☀️', name: 'Sun', color: 'hsl(35, 100%, 55%)' },
  { emoji: '🪐', name: 'Planet', color: 'hsl(271, 60%, 55%)' },
  { emoji: '🌊', name: 'Nebula', color: 'hsl(190, 90%, 55%)' },
  { emoji: '💫', name: 'Comet', color: 'hsl(330, 80%, 65%)' },
  { emoji: '🔮', name: 'Crystal', color: 'hsl(270, 70%, 60%)' },
  { emoji: '⚡', name: 'Energy', color: 'hsl(50, 100%, 50%)' },
  { emoji: '🌟', name: 'Supernova', color: 'hsl(40, 100%, 65%)' },
  { emoji: '🌀', name: 'Vortex', color: 'hsl(200, 80%, 55%)' },
  { emoji: '🔥', name: 'Flame', color: 'hsl(15, 90%, 55%)' },
  { emoji: '❄️', name: 'Frost', color: 'hsl(195, 80%, 70%)' },
  { emoji: '🌸', name: 'Blossom', color: 'hsl(330, 70%, 70%)' },
  { emoji: '💎', name: 'Diamond', color: 'hsl(195, 100%, 75%)' },
  { emoji: '🍀', name: 'Clover', color: 'hsl(120, 60%, 50%)' },
];

const MAX_XP = 150;

// Get level configuration
// Before 3 pairs: 1 puzzle each
// At 3+ pairs: 2 puzzles each (round 1 and round 2)
const getLevelConfig = (level: number, round: number = 1, startPairs: number = 2, revealTimeMultiplier: number = 1.0) => {
  // Calculate pairs based on level progression:
  // Level 1 = startPairs (e.g., 2)
  // Level 2 = startPairs + 1 (e.g., 3) - this is where 2 rounds start if startPairs < 3
  // After reaching 3 pairs, each pair count has 2 rounds
  
  let pairs: number;
  if (startPairs >= 3) {
    // Hard/Master: starts at 3+ pairs, so always 2 rounds per pair count
    // Level 1 = startPairs, Level 2 = startPairs (round 2), Level 3 = startPairs+1, etc.
    pairs = startPairs + Math.floor((level - 1) / 2);
  } else {
    // Beginner/Easy/Medium: starts at 2 pairs
    // Level 1 = 2 pairs (single round)
    // Level 2-3 = 3 pairs (2 rounds)
    // Level 4-5 = 4 pairs (2 rounds), etc.
    if (level === 1) {
      pairs = startPairs; // 2 pairs, single round
    } else {
      // For level 2+, calculate based on 2 rounds per pair count starting at 3 pairs
      pairs = 3 + Math.floor((level - 2) / 2);
    }
  }
  
  pairs = Math.min(pairs, 15); // Cap at 15 pairs
  const totalCards = pairs * 2;
  
  // Calculate optimal grid layout
  let cols: number, rows: number;
  if (totalCards <= 4) { cols = 2; rows = 2; }
  else if (totalCards <= 6) { cols = 3; rows = 2; }
  else if (totalCards <= 8) { cols = 4; rows = 2; }
  else if (totalCards <= 10) { cols = 5; rows = 2; }
  else if (totalCards <= 12) { cols = 4; rows = 3; }
  else if (totalCards <= 16) { cols = 4; rows = 4; }
  else if (totalCards <= 20) { cols = 5; rows = 4; }
  else if (totalCards <= 24) { cols = 6; rows = 4; }
  else if (totalCards <= 30) { cols = 6; rows = 5; }
  else { cols = 6; rows = 5; } // Max grid
  
  // Reveal time scales with cards: 3s base + 0.5s per pair, max 10s, modified by difficulty
  const baseRevealTime = Math.min(3 + (pairs - 2) * 0.5, 10);
  const revealTime = baseRevealTime * revealTimeMultiplier;
  
  return { pairs, cols, rows, revealTime, totalCards };
};

// Memoized card back component
const CardBack = memo(() => (
  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 border-2 border-purple-500/50 overflow-hidden">
    <div className="absolute inset-0 opacity-30">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
          style={{
            left: `${20 + i * 15}%`,
            top: `${30 + (i % 2) * 40}%`,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400/30 to-cyan-400/30 flex items-center justify-center">
        <span className="text-xl opacity-50">✦</span>
      </div>
    </div>
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse" />
  </div>
));
CardBack.displayName = 'CardBack';

// Memoized card face component
const CardFace = memo(({ symbolIndex }: { symbolIndex: number }) => {
  const symbol = COSMIC_SYMBOLS[symbolIndex];
  return (
    <div 
      className="absolute inset-0 rounded-xl border-2 overflow-hidden flex items-center justify-center"
      style={{ 
        background: `radial-gradient(circle at center, ${symbol.color}20, hsl(var(--background)))`,
        borderColor: `${symbol.color}60`,
        boxShadow: `0 0 20px ${symbol.color}30, inset 0 0 20px ${symbol.color}10`,
      }}
    >
      <span className="text-3xl sm:text-4xl filter drop-shadow-lg">{symbol.emoji}</span>
    </div>
  );
});
CardFace.displayName = 'CardFace';

// Match effect particles
const MatchEffect = memo(({ color }: { color: string }) => (
  <motion.div 
    className="absolute inset-0 pointer-events-none"
    initial={{ opacity: 1 }}
    animate={{ opacity: 0 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.5 }}
  >
    {[...Array(8)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-2 h-2 rounded-full"
        style={{ 
          backgroundColor: color,
          left: '50%',
          top: '50%',
        }}
        initial={{ scale: 0, x: '-50%', y: '-50%' }}
        animate={{
          scale: [0, 1, 0],
          x: `${Math.cos(i * Math.PI / 4) * 40 - 50}%`,
          y: `${Math.sin(i * Math.PI / 4) * 40 - 50}%`,
        }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    ))}
  </motion.div>
));
MatchEffect.displayName = 'MatchEffect';

type GamePhase = 'countdown' | 'revealing' | 'hiding' | 'playing' | 'levelComplete' | 'gameOver';

export const GalacticMatchGame = ({
  companionStats,
  onComplete,
  onDamage,
  tierAttackDamage = 15,
  difficulty = 'medium',
  questIntervalScale = 0,
  maxTimer,
  isPractice = false,
  compact = false,
}: GalacticMatchGameProps) => {
  const diffConfig = DIFFICULTY_CONFIG[difficulty];
  const maxLives = MAX_LIVES_BY_DIFFICULTY[difficulty];
  const [level, setLevel] = useState(1);
  const [round, setRound] = useState(1); // Track round within pair count (1 or 2)
  const [lives, setLives] = useState(diffConfig.startLives);
  const [phase, setPhase] = useState<GamePhase>('countdown');
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<string[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [matchEffects, setMatchEffects] = useState<{ id: string; color: string }[]>([]);
  const [countdown, setCountdown] = useState(3);
  const [revealCountdown, setRevealCountdown] = useState(0);
  const [mistakesThisLevel, setMistakesThisLevel] = useState(0);
  
  const config = useMemo(() => getLevelConfig(level, round, diffConfig.startPairs, diffConfig.revealTimeMultiplier), [level, round, diffConfig]);

  // Initialize/shuffle cards for current level
  const initializeCards = useCallback((startFlipped: boolean = false) => {
    const symbolIndices = Array.from({ length: config.pairs }, (_, i) => i % COSMIC_SYMBOLS.length);
    const cardPairs = [...symbolIndices, ...symbolIndices];
    
    // Fisher-Yates shuffle
    for (let i = cardPairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cardPairs[i], cardPairs[j]] = [cardPairs[j], cardPairs[i]];
    }

    setCards(cardPairs.map((symbolIndex, i) => ({
      id: `card-${level}-${i}`,
      symbolIndex,
      isFlipped: startFlipped,
      isMatched: false,
    })));
    setFlippedCards([]);
    setMatchedPairs(0);
    setCombo(0);
  }, [config.pairs, level]);

  // Initialize cards only for first level (subsequent levels handled by phase transitions)
  useEffect(() => {
    if (level === 1) {
      initializeCards();
    }
  }, []);

  // Countdown timer (initial 3-2-1)
  useEffect(() => {
    if (phase !== 'countdown') return;
    
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      // Start reveal phase - initialize cards with flipped state
      initializeCards(true);
      setPhase('revealing');
      setRevealCountdown(Math.ceil(config.revealTime));
    }
  }, [countdown, phase, config.revealTime, initializeCards]);

  // Reveal countdown
  useEffect(() => {
    if (phase !== 'revealing') return;
    
    if (revealCountdown > 0) {
      const timer = setTimeout(() => setRevealCountdown(revealCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      // Hide all unmatched cards and start playing (keep matched cards visible)
      setPhase('hiding');
      setTimeout(() => {
        setCards(prev => prev.map(c => ({ 
          ...c, 
          isFlipped: c.isMatched // Only matched cards stay flipped
        })));
        setTimeout(() => setPhase('playing'), 400);
      }, 200);
    }
  }, [revealCountdown, phase]);

  // Handle level complete
  useEffect(() => {
    if (phase !== 'playing') return;
    
    if (matchedPairs === config.pairs) {
      playMissionComplete();
      triggerHaptic('success');
      setPhase('levelComplete');
      
      // MILESTONE DAMAGE: Deal damage only on level complete
      const perfectLevel = mistakesThisLevel === 0;
      const damageAmount = perfectLevel 
        ? (GAME_DAMAGE_VALUES.galactic_match.perfectLevel as number)
        : (GAME_DAMAGE_VALUES.galactic_match.levelComplete as number);
      onDamage?.({ target: 'adversary', amount: damageAmount, source: perfectLevel ? 'perfect_level' : 'level_complete' });
      
      // Add level completion bonus
      const levelBonus = 15 * level;
      const scoreWithBonus = score + levelBonus;
      setScore(scoreWithBonus);
      
      // Move to next level/round after delay
      setTimeout(() => {
        // In practice mode, end after completing 2 levels
        if (isPractice && level >= 2) {
          onComplete({ 
            success: true, 
            accuracy: 100, 
            result: 'good',
            highScoreValue: level,
            gameStats: {
              level,
              score: scoreWithBonus,
              maxCombo: combo,
            },
          });
          return;
        }
        
        // Determine if we should repeat this pair count or advance
        const currentPairs = config.pairs;
        const shouldRepeat = currentPairs >= 3 && round === 1;
        
        let nextLevel: number;
        let nextRound: number;
        let nextConfig;
        
        if (shouldRepeat) {
          // Same pair count, round 2
          nextLevel = level + 1;
          nextRound = 2;
          nextConfig = getLevelConfig(nextLevel, nextRound, diffConfig.startPairs, diffConfig.revealTimeMultiplier);
        } else {
          // Move to next pair count, round 1
          nextLevel = level + 1;
          nextRound = 1;
          nextConfig = getLevelConfig(nextLevel, nextRound, diffConfig.startPairs, diffConfig.revealTimeMultiplier);
        }
        
        // Generate new shuffled cards for next level, starting flipped for memorization
        const symbolIndices = Array.from({ length: nextConfig.pairs }, (_, i) => i % COSMIC_SYMBOLS.length);
        const cardPairs = [...symbolIndices, ...symbolIndices];
        for (let i = cardPairs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [cardPairs[i], cardPairs[j]] = [cardPairs[j], cardPairs[i]];
        }
        
        setCards(cardPairs.map((symbolIndex, i) => ({
          id: `card-${nextLevel}-${i}`,
          symbolIndex,
          isFlipped: true, // Start flipped for memorization
          isMatched: false,
        })));
        setFlippedCards([]);
        setMatchedPairs(0);
        setMistakesThisLevel(0);
        setCombo(0);
        
        setLevel(nextLevel);
        setRound(nextRound);
        setPhase('revealing');
        setRevealCountdown(Math.ceil(nextConfig.revealTime));
      }, 1500);
    }
  }, [matchedPairs, config.pairs, phase, level, round, isPractice, onComplete, mistakesThisLevel, onDamage, diffConfig, score, combo]);

  // Handle game over
  useEffect(() => {
    if (phase !== 'gameOver') return;

    const maxPossibleScore = 500; // Reasonable estimate for accuracy calc
    const accuracy = Math.min(100, Math.round((score / maxPossibleScore) * 100));
    const cappedXP = Math.min(score, MAX_XP);

    const result: 'perfect' | 'good' | 'fail' = level >= 3 
      ? (level >= 6 ? 'perfect' : 'good')
      : 'fail';

    if (result !== 'fail') {
      playXPGain();
      triggerHaptic('success');
    }

    setTimeout(() => {
      onComplete({ 
        success: result !== 'fail', 
        accuracy: Math.min(accuracy, 100), 
        result,
        highScoreValue: level,
        gameStats: {
          level,
          score,
          maxCombo: combo,
        },
      });
    }, 1500);
  }, [phase, score, level, onComplete, combo]);

  // Handle card click
  const handleCardClick = useCallback((cardId: string) => {
    if (isLocked || phase !== 'playing') return;
    
    const card = cards.find(c => c.id === cardId);
    if (!card || card.isFlipped || card.isMatched) return;

    triggerHaptic('light');

    // Flip the card
    setCards(prev => prev.map(c => 
      c.id === cardId ? { ...c, isFlipped: true } : c
    ));

    const newFlipped = [...flippedCards, cardId];
    setFlippedCards(newFlipped);

    // Check for match when 2 cards are flipped
    if (newFlipped.length === 2) {
      setIsLocked(true);
      setTotalAttempts(prev => prev + 1);
      
      const [firstId, secondId] = newFlipped;
      const firstCard = cards.find(c => c.id === firstId)!;
      const secondCard = cards.find(c => c.id === secondId)!;

      if (firstCard.symbolIndex === secondCard.symbolIndex) {
        // Match found! (No per-match damage anymore - only on level complete)
        const newCombo = combo + 1;
        const comboMultiplier = Math.min(3, 1 + newCombo * 0.5);
        const basePoints = 10 + level * 2;
        const points = Math.round(basePoints * comboMultiplier);
        
        playHabitComplete();
        triggerHaptic('success');

        setCombo(newCombo);
        setScore(prev => prev + points);
        setMatchedPairs(prev => prev + 1);

        // Add match effect
        const color = COSMIC_SYMBOLS[firstCard.symbolIndex].color;
        setMatchEffects(prev => [...prev, { id: firstId, color }, { id: secondId, color }]);

        setTimeout(() => {
          setCards(prev => prev.map(c => 
            c.id === firstId || c.id === secondId 
              ? { ...c, isMatched: true } 
              : c
          ));
          setMatchEffects(prev => prev.filter(e => e.id !== firstId && e.id !== secondId));
          setFlippedCards([]);
          setIsLocked(false);
        }, 400);
      } else {
        // No match - lose a life and show all cards again!
        const newLives = lives - 1;
        setLives(newLives);
        setCombo(0);
        setMistakesThisLevel(prev => prev + 1);
        triggerHaptic('error');
        
        // Player takes damage from adversary attack
        onDamage?.({ target: 'player', amount: tierAttackDamage, source: 'wrong_match' });

        // Check for game over first
        if (newLives <= 0) {
          setTimeout(() => {
            setCards(prev => prev.map(c => 
              c.id === firstId || c.id === secondId 
                ? { ...c, isFlipped: false } 
                : c
            ));
            setFlippedCards([]);
            setIsLocked(false);
            setPhase('gameOver');
          }, 800);
        } else {
          // Show all unmatched cards again for re-memorization
          setTimeout(() => {
            // Flip all unmatched cards face-up (keep matched ones as matched)
            setCards(prev => prev.map(c => ({
              ...c,
              isFlipped: c.isMatched || true, // Show all cards
            })));
            setFlippedCards([]);
            
            // Calculate reveal time based on remaining cards
            const unmatchedCount = cards.filter(c => !c.isMatched).length;
            const revealTime = Math.min(1.5 + (unmatchedCount / 4) * 0.5, 3); // 1.5-3 seconds
            
            setRevealCountdown(Math.ceil(revealTime));
            setPhase('revealing');
            setIsLocked(false);
          }, 800);
        }
      }
    }
  }, [cards, flippedCards, isLocked, phase, combo, lives, level, onDamage, tierAttackDamage]);

  // Grid style
  const gridStyle = useMemo(() => ({
    gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
    gridTemplateRows: `repeat(${config.rows}, 1fr)`,
  }), [config.cols, config.rows]);

  return (
    <div className={`flex flex-col items-center flex-1 min-h-0 ${compact ? 'gap-1 p-1' : 'gap-2 p-3'} select-none touch-none`}>
      {/* Header with level, lives, and score - compact mode support */}
      <div className="w-full flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          {!compact && <span className="text-muted-foreground text-[10px]">Level</span>}
          <motion.span 
            key={`${level}-${round}`}
            initial={{ scale: 1.5, color: 'hsl(var(--primary))' }}
            animate={{ scale: 1, color: 'hsl(var(--foreground))' }}
            className={`font-bold ${compact ? 'text-sm' : 'text-base'}`}
          >
            {compact ? `Lv${level}` : level}
          </motion.span>
          {/* Show round indicator when there are 2 rounds per pair count (3+ pairs) */}
          {config.pairs >= 3 && (
            <span className="text-muted-foreground text-[10px] ml-0.5">
              ({round}/2)
            </span>
          )}
        </div>

        {/* Lives - compact */}
        <div className="flex items-center gap-0.5">
          {[...Array(maxLives)].map((_, i) => (
            <motion.div
              key={i}
              initial={false}
              animate={{ 
                scale: i < lives ? 1 : 0.8,
                opacity: i < lives ? 1 : 0.3,
              }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <Heart 
                className={`w-4 h-4 ${i < lives ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`}
              />
            </motion.div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Score:</span>
          <motion.span 
            key={score}
            initial={{ scale: 1.3, color: 'hsl(var(--primary))' }}
            animate={{ scale: 1, color: 'hsl(var(--foreground))' }}
            className="font-bold"
          >
            {score}
          </motion.span>
        </div>
      </div>

      {/* Combo indicator - compact */}
      <AnimatePresence>
        {combo > 1 && phase === 'playing' && (
          <motion.div
            initial={{ scale: 0, y: -10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            className="px-2 py-0.5 bg-yellow-500/20 rounded-full text-yellow-400 text-xs font-bold"
          >
            🔥 {combo}x COMBO!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pairs progress - compact */}
      <div className="w-full flex items-center gap-1.5">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${(matchedPairs / config.pairs) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground">{matchedPairs}/{config.pairs}</span>
      </div>

      {/* Card grid */}
      <div 
        className="relative w-full max-w-sm mx-auto"
        style={{ aspectRatio: `${config.cols}/${config.rows}` }}
      >
        {/* Initial Countdown overlay */}
        <AnimatePresence>
          {phase === 'countdown' && countdown > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl"
            >
              <motion.span
                key={countdown}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 2, opacity: 0 }}
                className="text-6xl font-bold text-primary"
              >
                {countdown}
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reveal phase overlay - positioned above the grid */}
        <AnimatePresence>
          {phase === 'revealing' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-x-0 -top-12 z-20 flex flex-col items-center"
            >
              <motion.div
                className="px-4 py-2 bg-cyan-500/90 rounded-full text-white font-bold shadow-lg"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                MEMORIZE! {revealCountdown}s
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hiding transition */}
        <AnimatePresence>
          {phase === 'hiding' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                className="text-4xl font-bold text-primary"
              >
                GO!
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Level complete overlay */}
        <AnimatePresence>
          {phase === 'levelComplete' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-center"
              >
                <motion.div 
                  className="text-5xl mb-2"
                  animate={{ rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  🎉
                </motion.div>
                <div className="text-2xl font-bold text-primary">Level {level} Complete!</div>
                <div className="text-sm text-muted-foreground mt-1">+{15 * level} bonus points</div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game over overlay - Enhanced defeat screen */}
        <AnimatePresence>
          {phase === 'gameOver' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-20 flex items-center justify-center rounded-xl overflow-hidden"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(30, 20, 50, 0.95) 0%, rgba(15, 10, 30, 0.98) 100%)',
              }}
            >
              {/* Falling ember particles */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {Array.from({ length: 8 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1.5 h-1.5 rounded-full"
                    style={{
                      left: `${10 + i * 12}%`,
                      top: '-5%',
                      background: 'radial-gradient(circle, rgba(168, 85, 247, 0.8), rgba(100, 50, 150, 0.4))',
                      boxShadow: '0 0 4px rgba(168, 85, 247, 0.5)',
                    }}
                    animate={{
                      y: ['0%', '120%'],
                      opacity: [0, 0.7, 0],
                    }}
                    transition={{
                      duration: 3 + i * 0.3,
                      delay: i * 0.4,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                  />
                ))}
              </div>
              
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-center px-4 relative z-10"
              >
                {/* Icon with glow */}
                <motion.div 
                  className="relative inline-block mb-3"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <div className="absolute inset-0 blur-xl bg-purple-500/30 rounded-full" />
                  <div className="text-4xl relative z-10">{level >= 3 ? '🌟' : '💫'}</div>
                </motion.div>
                
                {/* Title with gradient */}
                <motion.h3 
                  className="text-xl font-black bg-gradient-to-r from-slate-300 via-purple-300 to-slate-400 bg-clip-text text-transparent mb-1"
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  {level >= 5 ? 'Amazing Run!' : level >= 3 ? 'Good Effort!' : 'The Void Prevails'}
                </motion.h3>
                
                {/* Encouraging message */}
                <motion.p 
                  className="text-sm text-purple-300/70 mb-3 italic"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  {level >= 3 
                    ? 'Your memory grows stronger each time' 
                    : 'Every attempt brings you closer to mastery'}
                </motion.p>
                
                {/* Stats */}
                <motion.div 
                  className="space-y-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="text-lg font-bold text-purple-400">
                    Reached Level {level}
                  </div>
                  <div className="text-sm text-slate-400">
                    Final Score: {Math.min(score, MAX_XP)} XP
                  </div>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cards */}
        <div 
          className="grid gap-1 sm:gap-1.5 w-full h-full"
          style={gridStyle}
        >
          {cards.map((card) => (
            <motion.button
              key={card.id}
              onClick={() => handleCardClick(card.id)}
              disabled={card.isFlipped || card.isMatched || isLocked || phase !== 'playing'}
              className="relative w-full h-full"
              style={{ perspective: '1000px' }}
              whileTap={phase === 'playing' ? { scale: 0.95 } : undefined}
            >
              <motion.div
                className="absolute inset-0 preserve-3d"
                initial={false}
                animate={{ 
                  rotateY: card.isFlipped || card.isMatched ? 180 : 0,
                  opacity: card.isMatched ? 0.3 : 1,
                  scale: card.isMatched ? 0.9 : 1,
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* Card back */}
                <div 
                  className="absolute inset-0"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <CardBack />
                </div>
                
                {/* Card face */}
                <div 
                  className="absolute inset-0"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <CardFace symbolIndex={card.symbolIndex} />
                </div>
              </motion.div>

              {/* Match effect */}
              <AnimatePresence>
                {matchEffects.find(e => e.id === card.id) && (
                  <MatchEffect color={matchEffects.find(e => e.id === card.id)!.color} />
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Practice indicator - hidden in compact */}
      {isPractice && !compact && (
        <div className="text-xs text-muted-foreground">
          Practice Round - Get familiar with the mechanics!
        </div>
      )}
    </div>
  );
};

export default GalacticMatchGame;
