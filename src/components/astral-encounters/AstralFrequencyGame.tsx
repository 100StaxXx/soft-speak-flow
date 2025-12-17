import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Star, Zap } from 'lucide-react';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic } from './gameUtils';

interface AstralFrequencyGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
  maxTimer?: number;
  isPractice?: boolean;
}

// Difficulty configuration for Cosmic Dash
const DIFFICULTY_CONFIG = {
  easy: {
    gameTime: 30,
    startSpeed: 1.0,
    maxSpeed: 2.0,
    spawnInterval: 1400,
    obstacleTypes: ['asteroid'] as const,
    collectibleChance: 0.5,
    shieldChance: 0.15,
  },
  medium: {
    gameTime: 35,
    startSpeed: 1.3,
    maxSpeed: 2.5,
    spawnInterval: 1100,
    obstacleTypes: ['asteroid', 'dark_matter'] as const,
    collectibleChance: 0.45,
    shieldChance: 0.12,
  },
  hard: {
    gameTime: 40,
    startSpeed: 1.6,
    maxSpeed: 3.2,
    spawnInterval: 850,
    obstacleTypes: ['asteroid', 'dark_matter', 'storm', 'void'] as const,
    collectibleChance: 0.35,
    shieldChance: 0.08,
  },
};

type ObstacleType = 'asteroid' | 'dark_matter' | 'storm' | 'void';
type CollectibleType = 'stardust' | 'crystal' | 'shield';

interface Obstacle {
  id: string;
  lanes: number[]; // Which lanes are blocked (0, 1, 2)
  y: number; // 0 = bottom (player), 100 = top
  type: ObstacleType;
}

interface Collectible {
  id: string;
  lane: number;
  y: number;
  type: CollectibleType;
  collected: boolean;
}

// Lane positions (percentages)
const LANE_POSITIONS = [20, 50, 80];
const PLAYER_Y = 85;
const COLLISION_THRESHOLD = 12;

// Obstacle visuals
const OBSTACLE_CONFIG: Record<ObstacleType, { emoji: string; color: string; name: string }> = {
  asteroid: { emoji: '🪨', color: '#8b7355', name: 'Asteroid' },
  dark_matter: { emoji: '🌑', color: '#1a1a2e', name: 'Dark Matter' },
  storm: { emoji: '⚡', color: '#fbbf24', name: 'Energy Storm' },
  void: { emoji: '🕳️', color: '#4c1d95', name: 'Void Rift' },
};

// Collectible visuals
const COLLECTIBLE_CONFIG: Record<CollectibleType, { emoji: string; color: string; points: number }> = {
  stardust: { emoji: '✨', color: '#fbbf24', points: 10 },
  crystal: { emoji: '💎', color: '#a855f7', points: 25 },
  shield: { emoji: '🛡️', color: '#22d3ee', points: 0 },
};

// Cosmic tunnel background
const CosmicTunnel = memo(({ speed }: { speed: number }) => (
  <div className="absolute inset-0 overflow-hidden rounded-lg">
    {/* Deep space background */}
    <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-purple-950/30 to-slate-950" />
    
    {/* Parallax stars */}
    <div 
      className="absolute inset-0"
      style={{
        backgroundImage: `radial-gradient(1px 1px at 10% 10%, white, transparent),
                          radial-gradient(1px 1px at 30% 25%, white, transparent),
                          radial-gradient(2px 2px at 50% 15%, #a855f7, transparent),
                          radial-gradient(1px 1px at 70% 35%, white, transparent),
                          radial-gradient(1px 1px at 90% 20%, white, transparent),
                          radial-gradient(1px 1px at 20% 60%, white, transparent),
                          radial-gradient(2px 2px at 40% 80%, #22d3ee, transparent),
                          radial-gradient(1px 1px at 60% 70%, white, transparent),
                          radial-gradient(1px 1px at 80% 90%, white, transparent)`,
        animation: `cosmic-scroll ${3 / speed}s linear infinite`,
      }}
    />
    
    {/* Lane dividers */}
    <div className="absolute inset-0">
      <div 
        className="absolute top-0 bottom-0 w-px opacity-30"
        style={{ 
          left: '35%', 
          background: 'linear-gradient(to bottom, transparent, #a855f7, transparent)',
        }} 
      />
      <div 
        className="absolute top-0 bottom-0 w-px opacity-30"
        style={{ 
          left: '65%', 
          background: 'linear-gradient(to bottom, transparent, #a855f7, transparent)',
        }} 
      />
    </div>
    
    {/* Speed lines */}
    {speed > 1.5 && (
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: Math.floor(speed * 3) }).map((_, i) => (
          <div
            key={i}
            className="absolute w-0.5 bg-gradient-to-b from-white/30 to-transparent"
            style={{
              left: `${10 + (i * 15) % 80}%`,
              top: 0,
              height: `${20 + (i * 7) % 30}%`,
              animation: `speed-line ${0.5 / speed}s linear infinite`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
    )}
  </div>
));
CosmicTunnel.displayName = 'CosmicTunnel';

// Player orb component
const PlayerOrb = memo(({ lane, hasShield, isHit }: { lane: number; hasShield: boolean; isHit: boolean }) => (
  <motion.div
    className="absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2"
    animate={{ 
      left: `${LANE_POSITIONS[lane]}%`,
      scale: isHit ? [1, 0.8, 1] : 1,
    }}
    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    style={{ top: `${PLAYER_Y}%` }}
  >
    {/* Shield effect */}
    {hasShield && (
      <motion.div
        className="absolute -inset-2 rounded-full border-2 border-cyan-400"
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.8, 0.4, 0.8],
        }}
        transition={{ duration: 1, repeat: Infinity }}
        style={{ boxShadow: '0 0 20px #22d3ee, inset 0 0 10px #22d3ee50' }}
      />
    )}
    
    {/* Player core */}
    <div 
      className="w-full h-full rounded-full relative"
      style={{
        background: 'linear-gradient(135deg, #a855f7, #6366f1)',
        boxShadow: `0 0 20px #a855f7, 0 0 40px #a855f750, inset 0 0 15px white`,
      }}
    >
      {/* Inner glow */}
      <div className="absolute inset-2 rounded-full bg-white/30" />
      
      {/* Trail effect */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 w-8 h-16 opacity-40"
        style={{
          background: 'linear-gradient(to bottom, #a855f7, transparent)',
          filter: 'blur(4px)',
          transformOrigin: 'center top',
        }}
      />
    </div>
    
    {/* Hit effect */}
    <AnimatePresence>
      {isHit && !hasShield && (
        <motion.div
          className="absolute inset-0 rounded-full bg-red-500"
          initial={{ opacity: 0.8, scale: 1 }}
          animate={{ opacity: 0, scale: 2 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        />
      )}
    </AnimatePresence>
  </motion.div>
));
PlayerOrb.displayName = 'PlayerOrb';

// Obstacle sprite
const ObstacleSprite = memo(({ obstacle, speed }: { obstacle: Obstacle; speed: number }) => {
  const config = OBSTACLE_CONFIG[obstacle.type];
  const isWide = obstacle.lanes.length > 1;
  
  return (
    <>
      {obstacle.lanes.map((lane) => (
        <motion.div
          key={`${obstacle.id}-${lane}`}
          className="absolute w-10 h-10 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
          style={{ 
            left: `${LANE_POSITIONS[lane]}%`,
            top: `${obstacle.y}%`,
          }}
          animate={{ rotate: obstacle.type === 'asteroid' ? [0, 360] : 0 }}
          transition={{ duration: 4 / speed, repeat: Infinity, ease: 'linear' }}
        >
          <span 
            className="text-3xl" 
            style={{ 
              filter: `drop-shadow(0 0 10px ${config.color})`,
              transform: isWide ? 'scale(1.2)' : 'scale(1)',
            }}
          >
            {config.emoji}
          </span>
        </motion.div>
      ))}
    </>
  );
});
ObstacleSprite.displayName = 'ObstacleSprite';

// Collectible sprite
const CollectibleSprite = memo(({ collectible }: { collectible: Collectible }) => {
  const config = COLLECTIBLE_CONFIG[collectible.type];
  
  if (collectible.collected) return null;
  
  return (
    <motion.div
      className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
      style={{ 
        left: `${LANE_POSITIONS[collectible.lane]}%`,
        top: `${collectible.y}%`,
      }}
      animate={{ 
        scale: [1, 1.2, 1],
        rotate: collectible.type === 'crystal' ? [0, 10, -10, 0] : 0,
      }}
      transition={{ duration: 1, repeat: Infinity }}
    >
      <span 
        className="text-2xl" 
        style={{ filter: `drop-shadow(0 0 8px ${config.color})` }}
      >
        {config.emoji}
      </span>
    </motion.div>
  );
});
CollectibleSprite.displayName = 'CollectibleSprite';

// Score popup
const ScorePopup = memo(({ score, x, y }: { score: number; x: number; y: number }) => (
  <motion.div
    className="absolute text-sm font-bold pointer-events-none"
    style={{ left: `${x}%`, top: `${y}%` }}
    initial={{ opacity: 1, y: 0, scale: 1 }}
    animate={{ opacity: 0, y: -30, scale: 1.5 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.5 }}
  >
    <span className="text-yellow-400 drop-shadow-glow">+{score}</span>
  </motion.div>
));
ScorePopup.displayName = 'ScorePopup';

// Lane touch controls
const LaneControls = memo(({ onLaneChange, currentLane }: { onLaneChange: (lane: number) => void; currentLane: number }) => (
  <div className="absolute bottom-4 left-4 right-4 flex justify-between">
    <button
      className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
        currentLane === 0 ? 'bg-purple-500/50' : 'bg-white/10'
      }`}
      onPointerDown={() => onLaneChange(Math.max(0, currentLane - 1))}
    >
      <span className="text-2xl">◀</span>
    </button>
    <button
      className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
        currentLane === 2 ? 'bg-purple-500/50' : 'bg-white/10'
      }`}
      onPointerDown={() => onLaneChange(Math.min(2, currentLane + 1))}
    >
      <span className="text-2xl">▶</span>
    </button>
  </div>
));
LaneControls.displayName = 'LaneControls';

// Main game component
export const AstralFrequencyGame = ({
  companionStats,
  onComplete,
  difficulty = 'medium',
  maxTimer,
  isPractice = false,
}: AstralFrequencyGameProps) => {
  const config = DIFFICULTY_CONFIG[difficulty];
  const effectiveTimer = maxTimer ?? config.gameTime;
  
  // Game state
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'complete'>('countdown');
  const [timeLeft, setTimeLeft] = useState(effectiveTimer);
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  
  // Player state
  const [playerLane, setPlayerLane] = useState(1); // Center lane
  const [hasShield, setHasShield] = useState(false);
  const [isHit, setIsHit] = useState(false);
  const [lives, setLives] = useState(3);
  
  // Game objects
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [collectibles, setCollectibles] = useState<Collectible[]>([]);
  const [speed, setSpeed] = useState(config.startSpeed);
  const [scorePopups, setScorePopups] = useState<{ id: string; score: number; x: number; y: number }[]>([]);
  
  // Refs
  const gameStateRef = useRef(gameState);
  const playerLaneRef = useRef(playerLane);
  const hasShieldRef = useRef(hasShield);
  const lastSpawnRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  
  // Sync refs
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { playerLaneRef.current = playerLane; }, [playerLane]);
  useEffect(() => { hasShieldRef.current = hasShield; }, [hasShield]);
  
  // Stat bonus affects collectible value
  const statBonus = Math.round((companionStats.mind + companionStats.soul) / 2);
  const collectibleMultiplier = 1 + (statBonus / 100);
  
  // Handle countdown complete
  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
  }, []);
  
  // Change lane
  const changeLane = useCallback((newLane: number) => {
    if (gameStateRef.current !== 'playing') return;
    const clampedLane = Math.max(0, Math.min(2, newLane));
    setPlayerLane(clampedLane);
    triggerHaptic('light');
  }, []);
  
  // Handle swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);
  
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    
    // Only process horizontal swipes
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
      if (deltaX > 0) {
        changeLane(playerLaneRef.current + 1);
      } else {
        changeLane(playerLaneRef.current - 1);
      }
    }
    
    touchStartRef.current = null;
  }, [changeLane]);
  
  // Handle keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStateRef.current !== 'playing') return;
      
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        changeLane(playerLaneRef.current - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        changeLane(playerLaneRef.current + 1);
      } else if (e.key === 'Escape') {
        setGameState('paused');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeLane]);
  
  // Add score popup
  const addScorePopup = useCallback((points: number, x: number, y: number) => {
    const id = `popup-${Date.now()}-${Math.random()}`;
    setScorePopups(prev => [...prev, { id, score: points, x, y }]);
    setTimeout(() => {
      setScorePopups(prev => prev.filter(p => p.id !== id));
    }, 500);
  }, []);
  
  // Spawn objects
  const spawnObjects = useCallback((now: number) => {
    if (now - lastSpawnRef.current < config.spawnInterval / speed) return;
    lastSpawnRef.current = now;
    
    const rand = Math.random();
    
    if (rand < config.collectibleChance) {
      // Spawn collectible
      const type: CollectibleType = rand < config.shieldChance ? 'shield' : 
                                     rand < config.shieldChance + 0.15 ? 'crystal' : 'stardust';
      const lane = Math.floor(Math.random() * 3);
      
      setCollectibles(prev => [...prev, {
        id: `col-${now}-${Math.random()}`,
        lane,
        y: -10,
        type,
        collected: false,
      }]);
    } else {
      // Spawn obstacle
      const obstacleTypes = config.obstacleTypes;
      const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
      
      // Determine lanes blocked (sometimes multi-lane obstacles)
      let lanes: number[];
      if (difficulty === 'hard' && Math.random() < 0.3) {
        // Two-lane obstacle - leave one lane open
        const openLane = Math.floor(Math.random() * 3);
        lanes = [0, 1, 2].filter(l => l !== openLane);
      } else {
        lanes = [Math.floor(Math.random() * 3)];
      }
      
      setObstacles(prev => [...prev, {
        id: `obs-${now}-${Math.random()}`,
        lanes,
        y: -10,
        type,
      }]);
    }
  }, [config, speed, difficulty]);
  
  // Main game loop
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    let animationId: number;
    let lastTime = performance.now();
    
    const gameLoop = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      
      if (gameStateRef.current !== 'playing') return;
      
      // Update timer
      setTimeLeft(prev => {
        const newTime = prev - deltaTime;
        if (newTime <= 0) {
          setGameState('complete');
          return 0;
        }
        return newTime;
      });
      
      // Update speed (gradually increase)
      setSpeed(prev => Math.min(config.maxSpeed, prev + deltaTime * 0.02));
      
      // Update distance
      setDistance(prev => prev + deltaTime * speed * 10);
      
      // Spawn new objects
      spawnObjects(currentTime);
      
      // Move obstacles
      setObstacles(prev => {
        const updated = prev
          .map(obs => ({ ...obs, y: obs.y + deltaTime * 60 * speed }))
          .filter(obs => obs.y < 110);
        
        // Check collisions
        updated.forEach(obs => {
          if (Math.abs(obs.y - PLAYER_Y) < COLLISION_THRESHOLD && obs.lanes.includes(playerLaneRef.current)) {
            if (hasShieldRef.current) {
              setHasShield(false);
              triggerHaptic('medium');
              setCombo(0);
            } else {
              setIsHit(true);
              triggerHaptic('error');
              setLives(l => {
                const newLives = l - 1;
                if (newLives <= 0) {
                  setGameState('complete');
                }
                return newLives;
              });
              setCombo(0);
              setScore(s => Math.max(0, s - 25));
              setTimeout(() => setIsHit(false), 300);
            }
            // Mark obstacle as processed by moving it off screen
            obs.y = 200;
          }
        });
        
        return updated.filter(obs => obs.y < 110);
      });
      
      // Move collectibles
      setCollectibles(prev => {
        const updated = prev
          .map(col => ({ ...col, y: col.y + deltaTime * 60 * speed }))
          .filter(col => col.y < 110 && !col.collected);
        
        // Check collection
        updated.forEach(col => {
          if (!col.collected && Math.abs(col.y - PLAYER_Y) < COLLISION_THRESHOLD && col.lane === playerLaneRef.current) {
            col.collected = true;
            
            if (col.type === 'shield') {
              setHasShield(true);
              triggerHaptic('success');
            } else {
              const config = COLLECTIBLE_CONFIG[col.type];
              const points = Math.round(config.points * collectibleMultiplier);
              setScore(s => s + points);
              setCombo(c => {
                const newCombo = c + 1;
                setMaxCombo(m => Math.max(m, newCombo));
                return newCombo;
              });
              addScorePopup(points, LANE_POSITIONS[col.lane], PLAYER_Y - 10);
              triggerHaptic('light');
            }
          }
        });
        
        return updated.filter(col => !col.collected && col.y < 110);
      });
      
      animationId = requestAnimationFrame(gameLoop);
    };
    
    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [gameState, config, spawnObjects, collectibleMultiplier, addScorePopup, speed]);
  
  // Calculate final result
  const calculateResult = useCallback((): MiniGameResult => {
    const distanceBonus = Math.floor(distance / 10);
    const comboBonus = maxCombo * 5;
    const finalScore = score + distanceBonus + comboBonus;
    
    // Accuracy based on survival and collection
    const survivalRatio = lives / 3;
    const accuracy = Math.min(100, Math.round((finalScore / 300) * 100 * survivalRatio));
    
    let result: MiniGameResult['result'];
    if (accuracy >= 90) result = 'perfect';
    else if (accuracy >= 70) result = 'good';
    else if (accuracy >= 40) result = 'partial';
    else result = 'fail';
    
    return {
      success: result !== 'fail',
      accuracy,
      result,
    };
  }, [score, distance, maxCombo, lives]);
  
  // Handle game complete
  useEffect(() => {
    if (gameState === 'complete') {
      const result = calculateResult();
      setTimeout(() => onComplete(result), 500);
    }
  }, [gameState, calculateResult, onComplete]);
  
  return (
    <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center p-4 z-50">
      <style>{`
        @keyframes cosmic-scroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(100%); }
        }
        @keyframes speed-line {
          0% { transform: translateY(-100%); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(400%); opacity: 0; }
        }
      `}</style>
      
      <GameHUD
        title="Cosmic Dash"
        subtitle={isPractice ? 'Practice Mode' : undefined}
        score={score}
        timeLeft={Math.ceil(timeLeft)}
        totalTime={effectiveTimer}
        combo={combo}
        showCombo={combo > 1}
      />
      
      {/* Lives indicator */}
      <div className="absolute top-4 right-4 flex gap-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className={`w-6 h-6 rounded-full flex items-center justify-center ${
              i < lives ? 'bg-red-500/80' : 'bg-gray-700/50'
            }`}
          >
            <span className="text-sm">❤️</span>
          </div>
        ))}
      </div>
      
      {/* Shield indicator */}
      {hasShield && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-cyan-500/20 px-3 py-1 rounded-full">
          <Shield className="w-4 h-4 text-cyan-400" />
          <span className="text-cyan-400 text-sm font-bold">SHIELD</span>
        </div>
      )}
      
      {/* Speed indicator */}
      <div className="absolute top-16 left-4 flex items-center gap-2">
        <Zap className={`w-4 h-4 ${speed > 2 ? 'text-yellow-400' : 'text-muted-foreground'}`} />
        <span className="text-xs text-muted-foreground">{speed.toFixed(1)}x</span>
      </div>
      
      {/* Distance */}
      <div className="absolute top-16 right-4 flex items-center gap-2">
        <Star className="w-4 h-4 text-purple-400" />
        <span className="text-xs text-purple-400">{Math.floor(distance)}m</span>
      </div>
      
      {/* Main game area */}
      <div
        ref={containerRef}
        className="relative w-full max-w-sm h-[70vh] max-h-[600px] rounded-xl overflow-hidden border-2 border-purple-500/30"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <CosmicTunnel speed={speed} />
        
        {/* Game objects */}
        {obstacles.map(obs => (
          <ObstacleSprite key={obs.id} obstacle={obs} speed={speed} />
        ))}
        
        {collectibles.map(col => (
          <CollectibleSprite key={col.id} collectible={col} />
        ))}
        
        {/* Player */}
        <PlayerOrb lane={playerLane} hasShield={hasShield} isHit={isHit} />
        
        {/* Score popups */}
        <AnimatePresence>
          {scorePopups.map(popup => (
            <ScorePopup key={popup.id} {...popup} />
          ))}
        </AnimatePresence>
        
        {/* Lane touch controls */}
        <LaneControls onLaneChange={changeLane} currentLane={playerLane} />
      </div>
      
      {/* Instructions */}
      <div className="mt-4 text-center text-muted-foreground text-xs">
        <p>Swipe or tap arrows to change lanes</p>
        <p>Collect ✨ stardust • Avoid 🪨 obstacles</p>
      </div>
      
      {/* Overlays */}
      {gameState === 'countdown' && (
        <CountdownOverlay 
          count={3}
          onComplete={handleCountdownComplete} 
        />
      )}
      
      {gameState === 'paused' && (
        <PauseOverlay
          onResume={() => setGameState('playing')}
        />
      )}
    </div>
  );
};

export default AstralFrequencyGame;
