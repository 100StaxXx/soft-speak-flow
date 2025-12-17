import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';
import { triggerHaptic } from './gameUtils';
import { playHabitComplete, playXPGain } from '@/utils/soundEffects';

interface Card {
  id: string;
  symbolIndex: number;
  isFlipped: boolean;
  isMatched: boolean;
}

interface GalacticMatchGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
  maxTimer?: number;
  isPractice?: boolean;
}

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
];

// Difficulty configurations
const DIFFICULTY_CONFIG = {
  easy: { cols: 3, rows: 4, pairs: 6, time: 60, matchBonus: 20 },
  medium: { cols: 4, rows: 4, pairs: 8, time: 50, matchBonus: 25 },
  hard: { cols: 4, rows: 5, pairs: 10, time: 45, matchBonus: 30 },
};

// Memoized card back component
const CardBack = memo(() => (
  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 border-2 border-purple-500/50 overflow-hidden">
    {/* Constellation pattern */}
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
    {/* Center glyph */}
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400/30 to-cyan-400/30 flex items-center justify-center">
        <span className="text-xl opacity-50">✦</span>
      </div>
    </div>
    {/* Shimmer effect */}
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
      <span className="text-4xl filter drop-shadow-lg">{symbol.emoji}</span>
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

export const GalacticMatchGame = ({
  companionStats,
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0,
  maxTimer,
  isPractice = false,
}: GalacticMatchGameProps) => {
  const config = DIFFICULTY_CONFIG[difficulty];
  const baseTime = maxTimer || config.time;
  const gameTime = Math.round(baseTime * (1 - questIntervalScale * 0.1));
  
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<string[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(gameTime);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [matchEffects, setMatchEffects] = useState<{ id: string; color: string }[]>([]);
  const [countdown, setCountdown] = useState(3);

  // Initialize cards
  useEffect(() => {
    const symbolIndices = Array.from({ length: config.pairs }, (_, i) => i % COSMIC_SYMBOLS.length);
    const cardPairs = [...symbolIndices, ...symbolIndices];
    
    // Fisher-Yates shuffle
    for (let i = cardPairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cardPairs[i], cardPairs[j]] = [cardPairs[j], cardPairs[i]];
    }

    setCards(cardPairs.map((symbolIndex, i) => ({
      id: `card-${i}`,
      symbolIndex,
      isFlipped: false,
      isMatched: false,
    })));
  }, [config.pairs]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && !gameStarted) {
      setGameStarted(true);
    }
  }, [countdown, gameStarted]);

  // Game timer
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, gameOver]);

  // Check for game completion
  useEffect(() => {
    if (matchedPairs === config.pairs && !gameOver) {
      setGameOver(true);
    }
  }, [matchedPairs, config.pairs, gameOver]);

  // Handle game over
  useEffect(() => {
    if (!gameOver) return;

    const maxScore = config.pairs * config.matchBonus * 3 + gameTime * 2; // Max with perfect combos + time bonus
    const timeBonus = timeLeft * 2;
    const finalScore = score + timeBonus;
    const accuracy = Math.min(100, Math.round((finalScore / maxScore) * 100));

    const result = matchedPairs === config.pairs 
      ? (accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : 'partial')
      : 'fail';

    if (result !== 'fail') {
      playXPGain();
      triggerHaptic('success');
    }

    setTimeout(() => {
      onComplete({ success: result !== 'fail', accuracy, result });
    }, 1000);
  }, [gameOver, score, timeLeft, matchedPairs, config, gameTime, onComplete]);

  // Handle card click
  const handleCardClick = useCallback((cardId: string) => {
    if (isLocked || !gameStarted || gameOver) return;
    
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
      
      const [firstId, secondId] = newFlipped;
      const firstCard = cards.find(c => c.id === firstId)!;
      const secondCard = cards.find(c => c.id === secondId)!;

      if (firstCard.symbolIndex === secondCard.symbolIndex) {
        // Match found!
        const newCombo = combo + 1;
        const comboMultiplier = Math.min(3, 1 + newCombo * 0.5);
        const points = Math.round(config.matchBonus * comboMultiplier);
        
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
        // No match
        setCombo(0);
        triggerHaptic('medium');

        setTimeout(() => {
          setCards(prev => prev.map(c => 
            c.id === firstId || c.id === secondId 
              ? { ...c, isFlipped: false } 
              : c
          ));
          setFlippedCards([]);
          setIsLocked(false);
        }, 800);
      }
    }
  }, [cards, flippedCards, isLocked, gameStarted, gameOver, combo, config.matchBonus]);

  // Timer progress
  const timerProgress = (timeLeft / gameTime) * 100;
  const timerColor = timerProgress > 50 ? 'bg-cyan-500' : timerProgress > 25 ? 'bg-yellow-500' : 'bg-red-500';

  // Calculate card size to fit all cards on screen
  const gridStyle = useMemo(() => {
    const aspectRatio = config.cols / config.rows;
    return {
      gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
      gridTemplateRows: `repeat(${config.rows}, 1fr)`,
      aspectRatio: `${aspectRatio}`,
    };
  }, [config.cols, config.rows]);

  return (
    <div className="flex flex-col items-center gap-4 p-4 select-none touch-none">
      {/* Header with timer and score */}
      <div className="w-full flex items-center justify-between text-sm">
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
        
        {combo > 1 && (
          <motion.div
            initial={{ scale: 0, y: -10 }}
            animate={{ scale: 1, y: 0 }}
            className="px-2 py-0.5 bg-yellow-500/20 rounded-full text-yellow-400 text-xs font-bold"
          >
            {combo}x COMBO!
          </motion.div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Pairs:</span>
          <span className="font-bold">{matchedPairs}/{config.pairs}</span>
        </div>
      </div>

      {/* Timer bar */}
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${timerColor} transition-colors`}
          initial={{ width: '100%' }}
          animate={{ width: `${timerProgress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Card grid */}
      <div 
        className="relative w-full max-w-xs mx-auto"
        style={{ aspectRatio: `${config.cols}/${config.rows}` }}
      >
        {/* Countdown overlay */}
        <AnimatePresence>
          {countdown > 0 && (
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

        {/* Game over overlay */}
        <AnimatePresence>
          {gameOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 backdrop-blur-sm rounded-xl"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-center"
              >
                <div className="text-4xl mb-2">
                  {matchedPairs === config.pairs ? '🎉' : '⏰'}
                </div>
                <div className="text-xl font-bold">
                  {matchedPairs === config.pairs ? 'Complete!' : 'Time Up!'}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {matchedPairs}/{config.pairs} pairs matched
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cards */}
        <div 
          className="grid gap-1.5 w-full h-full"
          style={gridStyle}
        >
          {cards.map((card) => (
            <motion.button
              key={card.id}
              onClick={() => handleCardClick(card.id)}
              disabled={card.isFlipped || card.isMatched || isLocked || !gameStarted}
              className="relative w-full h-full"
              style={{ perspective: '1000px' }}
              whileTap={{ scale: 0.95 }}
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

      {/* Practice indicator */}
      {isPractice && (
        <div className="text-xs text-muted-foreground">
          Practice Round - Get familiar with the mechanics!
        </div>
      )}
    </div>
  );
};

export default GalacticMatchGame;
