import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Shield, Zap, Bomb, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { MiniGameResult } from '@/types/astralEncounters';
import { CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic } from './gameUtils';

import { DamageEvent, GAME_DAMAGE_VALUES } from '@/types/battleSystem';

interface EnergyBeamGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  onDamage?: (event: DamageEvent) => void;
  tierAttackDamage?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
  maxTimer?: number;
  isPractice?: boolean;
}

// ENDLESS mode config - no timer, no wave cap
const DIFFICULTY_CONFIG = {
  easy: {
    baseEnemiesPerWave: 8,
    enemyFireRate: 0,
    enemySpeed: 0.3,
    diveChance: 0.02,
    powerUpChance: 0.2,
    enemyIncreasePerWave: 2,
    speedIncreasePerWave: 0.05,
    diveIncreasePerWave: 0.005,
  },
  medium: {
    baseEnemiesPerWave: 10,
    enemyFireRate: 0.003,
    enemySpeed: 0.4,
    diveChance: 0.03,
    powerUpChance: 0.15,
    enemyIncreasePerWave: 2,
    speedIncreasePerWave: 0.06,
    diveIncreasePerWave: 0.006,
  },
  hard: {
    baseEnemiesPerWave: 12,
    enemyFireRate: 0.006,
    enemySpeed: 0.5,
    diveChance: 0.04,
    powerUpChance: 0.12,
    enemyIncreasePerWave: 3,
    speedIncreasePerWave: 0.08,
    diveIncreasePerWave: 0.008,
  },
};

// Enemy types
type EnemyType = 'scout' | 'fighter' | 'cruiser' | 'boss';

interface Enemy {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  points: number;
  isDiving: boolean;
  diveStartX: number;
  divePhase: number;
  formationX: number;
  formationY: number;
}

interface Projectile {
  id: string;
  x: number;
  y: number;
  isEnemy: boolean;
  speed: number;
}

interface PowerUp {
  id: string;
  type: 'shield' | 'rapid' | 'bomb' | 'bonus';
  x: number;
  y: number;
}

interface Explosion {
  id: string;
  x: number;
  y: number;
  size: 'small' | 'large';
}

interface ScorePopup {
  id: string;
  x: number;
  y: number;
  score: number;
  type: string;
}

const ENEMY_CONFIG: Record<EnemyType, { hp: number; points: number; color: string; size: number }> = {
  scout: { hp: 1, points: 10, color: '#22c55e', size: 24 },
  fighter: { hp: 1, points: 25, color: '#3b82f6', size: 28 },
  cruiser: { hp: 2, points: 50, color: '#a855f7', size: 32 },
  boss: { hp: 5, points: 200, color: '#ef4444', size: 40 },
};

// Starfield background
const StarfieldBackground = memo(() => {
  const stars = useMemo(() => 
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      speed: Math.random() * 2 + 1,
      opacity: Math.random() * 0.5 + 0.3,
    })), []
  );
  
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950">
      {stars.map(star => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            width: star.size,
            height: star.size,
            opacity: star.opacity,
          }}
          animate={{
            top: ['0%', '100%'],
          }}
          transition={{
            duration: 8 / star.speed,
            repeat: Infinity,
            ease: 'linear',
            delay: (star.y / 100) * (8 / star.speed),
          }}
        />
      ))}
    </div>
  );
});
StarfieldBackground.displayName = 'StarfieldBackground';

// Player ship component
const PlayerShip = memo(({ x, hasShield, isInvulnerable }: { x: number; hasShield: boolean; isInvulnerable: boolean }) => (
  <div
    className="absolute bottom-16 transition-transform duration-75"
    style={{ left: `${x}%`, transform: 'translateX(-50%)' }}
  >
    {/* Shield effect */}
    {hasShield && (
      <motion.div
        className="absolute -inset-4 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)',
          border: '2px solid rgba(59,130,246,0.5)',
        }}
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
    )}
    
    {/* Invulnerability flash */}
    <motion.div
      animate={isInvulnerable ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
      transition={{ duration: 0.2, repeat: isInvulnerable ? Infinity : 0 }}
    >
      {/* Ship body */}
      <svg width="36" height="40" viewBox="0 0 36 40" className="drop-shadow-lg">
        {/* Engine glow */}
        <ellipse cx="18" cy="38" rx="6" ry="4" fill="#f59e0b" opacity="0.8">
          <animate attributeName="ry" values="3;5;3" dur="0.2s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="18" cy="38" rx="3" ry="2" fill="#fef3c7">
          <animate attributeName="ry" values="2;3;2" dur="0.15s" repeatCount="indefinite" />
        </ellipse>
        
        {/* Main hull */}
        <path
          d="M18 2 L4 36 L18 30 L32 36 Z"
          fill="url(#shipGradient)"
          stroke="#60a5fa"
          strokeWidth="1.5"
        />
        
        {/* Cockpit */}
        <ellipse cx="18" cy="16" rx="4" ry="6" fill="#0ea5e9" opacity="0.8" />
        <ellipse cx="18" cy="14" rx="2" ry="3" fill="#7dd3fc" />
        
        {/* Wing details */}
        <line x1="8" y1="28" x2="14" y2="24" stroke="#3b82f6" strokeWidth="2" />
        <line x1="28" y1="28" x2="22" y2="24" stroke="#3b82f6" strokeWidth="2" />
        
        <defs>
          <linearGradient id="shipGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e40af" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
        </defs>
      </svg>
    </motion.div>
  </div>
));
PlayerShip.displayName = 'PlayerShip';

// Enemy component
const EnemySprite = memo(({ enemy }: { enemy: Enemy }) => {
  const config = ENEMY_CONFIG[enemy.type];
  
  return (
    <motion.div
      className="absolute"
      style={{
        left: `${enemy.x}%`,
        top: `${enemy.y}%`,
        transform: 'translate(-50%, -50%)',
      }}
      animate={enemy.isDiving ? { rotate: [0, 10, -10, 0] } : {}}
      transition={{ duration: 0.3, repeat: enemy.isDiving ? Infinity : 0 }}
    >
      <svg width={config.size} height={config.size} viewBox="0 0 32 32">
        {enemy.type === 'scout' && (
          <>
            <path d="M16 4 L4 28 L16 22 L28 28 Z" fill={config.color} stroke="#fff" strokeWidth="1" />
            <circle cx="16" cy="14" r="4" fill="#1a1a2e" stroke="#fff" strokeWidth="1" />
          </>
        )}
        {enemy.type === 'fighter' && (
          <>
            <path d="M16 2 L2 30 L16 24 L30 30 Z" fill={config.color} stroke="#fff" strokeWidth="1" />
            <path d="M8 20 L2 26 L8 24 Z" fill={config.color} />
            <path d="M24 20 L30 26 L24 24 Z" fill={config.color} />
            <circle cx="16" cy="12" r="5" fill="#1a1a2e" stroke="#fff" strokeWidth="1" />
            <circle cx="16" cy="12" r="2" fill="#ef4444" />
          </>
        )}
        {enemy.type === 'cruiser' && (
          <>
            <rect x="6" y="4" width="20" height="24" rx="4" fill={config.color} stroke="#fff" strokeWidth="1" />
            <rect x="2" y="12" width="6" height="12" rx="2" fill={config.color} />
            <rect x="24" y="12" width="6" height="12" rx="2" fill={config.color} />
            <circle cx="16" cy="12" r="4" fill="#1a1a2e" stroke="#fff" strokeWidth="1" />
            <circle cx="12" cy="22" r="2" fill="#ef4444" />
            <circle cx="20" cy="22" r="2" fill="#ef4444" />
          </>
        )}
        {enemy.type === 'boss' && (
          <>
            <ellipse cx="16" cy="16" rx="14" ry="12" fill={config.color} stroke="#fbbf24" strokeWidth="2" />
            <ellipse cx="10" cy="12" rx="4" ry="5" fill="#1a1a2e" stroke="#fff" strokeWidth="1" />
            <ellipse cx="22" cy="12" rx="4" ry="5" fill="#1a1a2e" stroke="#fff" strokeWidth="1" />
            <circle cx="10" cy="12" r="2" fill="#22c55e" />
            <circle cx="22" cy="12" r="2" fill="#22c55e" />
            <path d="M8 22 Q16 28 24 22" stroke="#fff" strokeWidth="2" fill="none" />
          </>
        )}
      </svg>
      
      {/* HP bar for multi-hit enemies */}
      {enemy.maxHp > 1 && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }}
          />
        </div>
      )}
    </motion.div>
  );
});
EnemySprite.displayName = 'EnemySprite';

// Projectile component
const ProjectileSprite = memo(({ projectile }: { projectile: Projectile }) => (
  <motion.div
    className="absolute w-1 h-4 rounded-full"
    style={{
      left: `${projectile.x}%`,
      top: `${projectile.y}%`,
      transform: 'translate(-50%, -50%)',
      background: projectile.isEnemy
        ? 'linear-gradient(180deg, #ef4444, #fca5a5)'
        : 'linear-gradient(0deg, #3b82f6, #93c5fd)',
      boxShadow: projectile.isEnemy
        ? '0 0 8px #ef4444'
        : '0 0 8px #3b82f6',
    }}
  />
));
ProjectileSprite.displayName = 'ProjectileSprite';

// Power-up component
const PowerUpSprite = memo(({ powerUp }: { powerUp: PowerUp }) => {
  const config = {
    shield: { icon: Shield, color: '#3b82f6', bg: 'rgba(59,130,246,0.3)' },
    rapid: { icon: Zap, color: '#f59e0b', bg: 'rgba(245,158,11,0.3)' },
    bomb: { icon: Bomb, color: '#ef4444', bg: 'rgba(239,68,68,0.3)' },
    bonus: { icon: Star, color: '#fbbf24', bg: 'rgba(251,191,36,0.3)' },
  }[powerUp.type];
  
  const Icon = config.icon;
  
  return (
    <motion.div
      className="absolute"
      style={{
        left: `${powerUp.x}%`,
        top: `${powerUp.y}%`,
        transform: 'translate(-50%, -50%)',
      }}
      animate={{ rotate: 360, scale: [1, 1.1, 1] }}
      transition={{ rotate: { duration: 2, repeat: Infinity, ease: 'linear' }, scale: { duration: 0.5, repeat: Infinity } }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center"
        style={{
          background: config.bg,
          border: `2px solid ${config.color}`,
          boxShadow: `0 0 15px ${config.color}`,
        }}
      >
        <Icon className="w-4 h-4" style={{ color: config.color }} />
      </div>
    </motion.div>
  );
});
PowerUpSprite.displayName = 'PowerUpSprite';

// Explosion effect
const ExplosionEffect = memo(({ explosion }: { explosion: Explosion }) => (
  <motion.div
    className="absolute pointer-events-none"
    style={{
      left: `${explosion.x}%`,
      top: `${explosion.y}%`,
      transform: 'translate(-50%, -50%)',
    }}
    initial={{ scale: 0, opacity: 1 }}
    animate={{ scale: explosion.size === 'large' ? 3 : 1.5, opacity: 0 }}
    transition={{ duration: 0.4 }}
  >
    <div
      className="w-8 h-8 rounded-full"
      style={{
        background: 'radial-gradient(circle, #fbbf24 0%, #f59e0b 30%, #ef4444 60%, transparent 100%)',
      }}
    />
  </motion.div>
));
ExplosionEffect.displayName = 'ExplosionEffect';

// Score popup
const ScorePopupComponent = memo(({ popup }: { popup: ScorePopup }) => (
  <motion.div
    className={`absolute pointer-events-none font-bold text-sm z-30 ${
      popup.score < 0 ? 'text-red-400' : popup.type === 'bonus' ? 'text-yellow-400' : 'text-green-400'
    }`}
    style={{ left: `${popup.x}%`, top: `${popup.y}%`, transform: 'translate(-50%, -50%)' }}
    initial={{ opacity: 1, y: 0, scale: 1.2 }}
    animate={{ opacity: 0, y: -20, scale: 1 }}
    transition={{ duration: 0.6 }}
  >
    {popup.score > 0 ? `+${popup.score}` : popup.score}
  </motion.div>
));
ScorePopupComponent.displayName = 'ScorePopupComponent';

// Wave transition - no max waves shown
const WaveTransition = memo(({ wave }: { wave: number }) => (
  <motion.div
    className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <motion.div
      className="text-center"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 200 }}
    >
      <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
        WAVE {wave}
      </p>
      <p className="text-sm text-muted-foreground mt-2">Enemies incoming!</p>
    </motion.div>
  </motion.div>
));
WaveTransition.displayName = 'WaveTransition';

// Lives display
const LivesDisplay = memo(({ lives }: { lives: number }) => (
  <div className="flex items-center gap-1">
    {Array.from({ length: 3 }).map((_, i) => (
      <Heart
        key={i}
        className={`w-5 h-5 ${i < lives ? 'text-red-500 fill-red-500' : 'text-slate-600'}`}
      />
    ))}
  </div>
));
LivesDisplay.displayName = 'LivesDisplay';

// Generate enemy formation - scales with wave number
const generateEnemies = (wave: number, config: typeof DIFFICULTY_CONFIG['easy']): Enemy[] => {
  const enemies: Enemy[] = [];
  const enemyCount = config.baseEnemiesPerWave + (wave - 1) * config.enemyIncreasePerWave;
  const rows = Math.min(3 + Math.floor(wave / 3), 5);
  const cols = Math.ceil(enemyCount / rows);
  
  let count = 0;
  for (let row = 0; row < rows && count < enemyCount; row++) {
    for (let col = 0; col < cols && count < enemyCount; col++) {
      const x = 15 + (col * 70) / (cols - 1 || 1);
      const y = 8 + row * 10;
      
      // Enemy type based on row and wave
      let type: EnemyType = 'scout';
      if (wave >= 3 && row === 0) type = 'cruiser';
      else if (wave >= 2 && row <= 1) type = 'fighter';
      
      // Add boss every 5 waves
      if (wave % 5 === 0 && row === 0 && col === Math.floor(cols / 2)) {
        type = 'boss';
      }
      
      const enemyConfig = ENEMY_CONFIG[type];
      
      enemies.push({
        id: `enemy-${wave}-${row}-${col}`,
        type,
        x,
        y,
        hp: enemyConfig.hp,
        maxHp: enemyConfig.hp,
        points: enemyConfig.points,
        isDiving: false,
        diveStartX: x,
        divePhase: 0,
        formationX: x,
        formationY: y,
      });
      
      count++;
    }
  }
  
  return enemies;
};

export function EnergyBeamGame({
  companionStats,
  onComplete,
  onDamage,
  tierAttackDamage = 15,
  difficulty = 'medium',
  questIntervalScale = 1,
  isPractice = false,
}: EnergyBeamGameProps) {
  const config = DIFFICULTY_CONFIG[difficulty];
  
  // Game state - NO TIMER
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'wave-transition' | 'complete'>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [lives, setLives] = useState(3);
  
  // Player state
  const [playerX, setPlayerX] = useState(50);
  const [hasShield, setHasShield] = useState(false);
  const [rapidFire, setRapidFire] = useState(false);
  const [isInvulnerable, setIsInvulnerable] = useState(false);
  
  // Game objects
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
  
  // Refs
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const lastFireTime = useRef(0);
  const formationDirection = useRef(1);
  const formationOffset = useRef(0);
  const touchStartX = useRef<number | null>(null);
  const animationFrameRef = useRef<number>();
  const lastUpdateTime = useRef(0);
  const isWaveTransitioning = useRef(false);
  
  // Stats tracking
  const statsRef = useRef({
    enemiesDestroyed: 0,
    shotsHit: 0,
    shotsFired: 0,
    wavesCompleted: 0,
    powerUpsCollected: 0,
  });
  
  // Current wave difficulty (scales with wave)
  const currentConfig = useMemo(() => ({
    enemySpeed: config.enemySpeed + (wave - 1) * config.speedIncreasePerWave,
    diveChance: config.diveChance + (wave - 1) * config.diveIncreasePerWave,
    enemyFireRate: config.enemyFireRate + (wave - 1) * 0.001,
    powerUpChance: config.powerUpChance,
  }), [config, wave]);
  
  // Initialize first wave - only run if not in wave transition
  useEffect(() => {
    if (gameState === 'playing' && enemies.length === 0 && !isWaveTransitioning.current) {
      setEnemies(generateEnemies(wave, config));
    }
  }, [gameState, wave, config, enemies.length]);
  
  // Countdown timer
  useEffect(() => {
    if (gameState !== 'countdown') return;
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setGameState('playing');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [gameState]);
  
  // Fire projectile
  const fireProjectile = useCallback(() => {
    const now = Date.now();
    const fireDelay = rapidFire ? 100 : 180;
    
    if (now - lastFireTime.current < fireDelay) return;
    lastFireTime.current = now;
    
    statsRef.current.shotsFired++;
    
    setProjectiles(prev => [...prev, {
      id: `p-${now}`,
      x: playerX,
      y: 82,
      isEnemy: false,
      speed: 3,
    }]);
  }, [playerX, rapidFire]);
  
  // Handle keyboard input
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const keysPressed = new Set<string>();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.add(e.key.toLowerCase());
      
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        fireProjectile();
      }
      if (e.key === 'Escape') {
        setGameState('paused');
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.key.toLowerCase());
    };
    
    const movePlayer = () => {
      if (keysPressed.has('arrowleft') || keysPressed.has('a')) {
        setPlayerX(prev => Math.max(5, prev - 2));
      }
      if (keysPressed.has('arrowright') || keysPressed.has('d')) {
        setPlayerX(prev => Math.min(95, prev + 2));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    const moveInterval = setInterval(movePlayer, 16);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearInterval(moveInterval);
    };
  }, [gameState, fireProjectile]);
  
  // Touch controls
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!gameAreaRef.current || touchStartX.current === null) return;
    
    const rect = gameAreaRef.current.getBoundingClientRect();
    const touchX = e.touches[0].clientX;
    const relativeX = ((touchX - rect.left) / rect.width) * 100;
    
    setPlayerX(Math.max(5, Math.min(95, relativeX)));
  }, []);
  
  const handleMoveLeft = useCallback(() => {
    setPlayerX(prev => Math.max(5, prev - 8));
  }, []);
  
  const handleMoveRight = useCallback(() => {
    setPlayerX(prev => Math.min(95, prev + 8));
  }, []);
  
  // Main game loop
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const gameLoop = (timestamp: number) => {
      const deltaTime = timestamp - lastUpdateTime.current;
      if (deltaTime < 16) {
        animationFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }
      lastUpdateTime.current = timestamp;
      
      // Auto-fire
      fireProjectile();
      
      // Update formation movement
      formationOffset.current += currentConfig.enemySpeed * formationDirection.current * 0.3;
      if (Math.abs(formationOffset.current) > 12) {
        formationDirection.current *= -1;
      }
      
      // Update enemies
      setEnemies(prev => prev.map(enemy => {
        if (enemy.isDiving) {
          // Diving behavior - swooping attack
          enemy.divePhase += 0.05;
          const newY = enemy.formationY + Math.sin(enemy.divePhase) * 50 + enemy.divePhase * 15;
          const newX = enemy.diveStartX + Math.sin(enemy.divePhase * 2) * 20;
          
          // Return to formation after dive
          if (newY > 90) {
            return {
              ...enemy,
              isDiving: false,
              divePhase: 0,
              x: enemy.formationX + formationOffset.current,
              y: enemy.formationY,
            };
          }
          
          return { ...enemy, x: Math.max(5, Math.min(95, newX)), y: newY };
        }
        
        // Normal formation movement
        const newX = enemy.formationX + formationOffset.current;
        
        // Random dive attack
        if (Math.random() < currentConfig.diveChance * 0.1 && !enemy.isDiving) {
          return { ...enemy, isDiving: true, diveStartX: newX, divePhase: 0 };
        }
        
        // Enemy shooting
        if (currentConfig.enemyFireRate > 0 && Math.random() < currentConfig.enemyFireRate) {
          setProjectiles(p => [...p, {
            id: `ep-${Date.now()}-${enemy.id}`,
            x: newX,
            y: enemy.y + 3,
            isEnemy: true,
            speed: 1.5,
          }]);
        }
        
        return { ...enemy, x: newX };
      }));
      
      // Update projectiles
      setProjectiles(prev => {
        const updated: Projectile[] = [];
        
        prev.forEach(proj => {
          const newY = proj.y + (proj.isEnemy ? proj.speed : -proj.speed);
          
          if (newY < 0 || newY > 100) return;
          
          // Check player projectile hitting enemies
          if (!proj.isEnemy) {
            let hitEnemy = false;
            
            setEnemies(enemies => enemies.map(enemy => {
              if (hitEnemy) return enemy;
              
              const dx = Math.abs(proj.x - enemy.x);
              const dy = Math.abs(newY - enemy.y);
              const hitRadius = ENEMY_CONFIG[enemy.type].size / 8;
              
              if (dx < hitRadius && dy < hitRadius) {
                hitEnemy = true;
                statsRef.current.shotsHit++;
                
                const newHp = enemy.hp - 1;
                
                if (newHp <= 0) {
                  // Enemy destroyed
                  statsRef.current.enemiesDestroyed++;
                  const points = enemy.isDiving ? enemy.points * 2 : enemy.points;
                  setScore(s => s + points);
                  triggerHaptic('light');
                  
                  // Deal damage to adversary only for boss kills (milestone-based)
                  if (enemy.type === 'boss') {
                    onDamage?.({ target: 'adversary', amount: GAME_DAMAGE_VALUES.energy_beam.bossKill, source: 'boss_kill' });
                  }
                  // Note: Regular enemy kills no longer deal damage - wave completion handles it
                  
                  // Add explosion
                  setExplosions(e => [...e, {
                    id: `exp-${Date.now()}-${enemy.id}`,
                    x: enemy.x,
                    y: enemy.y,
                    size: enemy.type === 'boss' ? 'large' : 'small',
                  }]);
                  
                  // Add score popup
                  setScorePopups(p => [...p, {
                    id: `sp-${Date.now()}`,
                    x: enemy.x,
                    y: enemy.y,
                    score: points,
                    type: 'normal',
                  }]);
                  
                  // Spawn power-up
                  if (Math.random() < currentConfig.powerUpChance) {
                    const types: PowerUp['type'][] = ['shield', 'rapid', 'bomb', 'bonus'];
                    setPowerUps(p => [...p, {
                      id: `pu-${Date.now()}`,
                      type: types[Math.floor(Math.random() * types.length)],
                      x: enemy.x,
                      y: enemy.y,
                    }]);
                  }
                  
                  return { ...enemy, hp: 0 };
                }
                
                return { ...enemy, hp: newHp };
              }
              
              return enemy;
            }).filter(e => e.hp > 0));
            
            if (hitEnemy) return;
          }
          
          // Check enemy projectile hitting player
          if (proj.isEnemy && !isInvulnerable) {
            const dx = Math.abs(proj.x - playerX);
            const dy = Math.abs(newY - 85);
            
            if (dx < 4 && dy < 4) {
              if (hasShield) {
                setHasShield(false);
                triggerHaptic('medium');
              } else {
                // Player takes damage from enemy projectile
                onDamage?.({ target: 'player', amount: tierAttackDamage, source: 'player_hit' });
                
                setLives(l => {
                  const newLives = l - 1;
                  if (newLives <= 0) {
                    setGameState('complete');
                  }
                  return newLives;
                });
                setIsInvulnerable(true);
                setTimeout(() => setIsInvulnerable(false), 2000);
                triggerHaptic('heavy');
              }
              return;
            }
          }
          
          updated.push({ ...proj, y: newY });
        });
        
        return updated;
      });
      
      // Update power-ups
      setPowerUps(prev => {
        const updated: PowerUp[] = [];
        
        prev.forEach(pu => {
          const newY = pu.y + 0.5;
          
          if (newY > 100) return;
          
          // Check collision with player
          const dx = Math.abs(pu.x - playerX);
          const dy = Math.abs(newY - 85);
          
          if (dx < 6 && dy < 6) {
            statsRef.current.powerUpsCollected++;
            triggerHaptic('medium');
            
            switch (pu.type) {
              case 'shield':
                setHasShield(true);
                break;
              case 'rapid':
                setRapidFire(true);
                setTimeout(() => setRapidFire(false), 5000);
                break;
              case 'bomb':
                // Clear all enemies on screen
                setEnemies(enemies => {
                  enemies.forEach(e => {
                    setScore(s => s + e.points);
                    statsRef.current.enemiesDestroyed++;
                    setExplosions(ex => [...ex, {
                      id: `exp-bomb-${e.id}`,
                      x: e.x,
                      y: e.y,
                      size: 'small',
                    }]);
                  });
                  return [];
                });
                break;
              case 'bonus':
                setScore(s => s + 200);
                setScorePopups(p => [...p, {
                  id: `sp-bonus-${Date.now()}`,
                  x: pu.x,
                  y: pu.y,
                  score: 200,
                  type: 'bonus',
                }]);
                break;
            }
            
            return;
          }
          
          updated.push({ ...pu, y: newY });
        });
        
        return updated;
      });
      
      // Check enemy collision with player
      if (!isInvulnerable) {
        setEnemies(prev => {
          prev.forEach(enemy => {
            const dx = Math.abs(enemy.x - playerX);
            const dy = Math.abs(enemy.y - 85);
            
            if (dx < 5 && dy < 5) {
              if (hasShield) {
                setHasShield(false);
              } else {
                setLives(l => {
                  const newLives = l - 1;
                  if (newLives <= 0) {
                    setGameState('complete');
                  }
                  return newLives;
                });
                setIsInvulnerable(true);
                setTimeout(() => setIsInvulnerable(false), 2000);
              }
              triggerHaptic('heavy');
            }
          });
          return prev;
        });
      }
      
      // Clean up old explosions and popups
      setExplosions(prev => prev.slice(-10));
      setScorePopups(prev => prev.slice(-10));
      
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };
    
    animationFrameRef.current = requestAnimationFrame(gameLoop);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState, playerX, currentConfig, fireProjectile, hasShield, isInvulnerable]);
  
  // Check wave completion - ENDLESS, always spawn next wave
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (enemies.length > 0) return;
    if (isWaveTransitioning.current) return; // Prevent double-triggering
    
    isWaveTransitioning.current = true; // Lock transition
    
    const stats = statsRef.current;
    stats.wavesCompleted++;
    
    // Practice mode: end after completing 2 waves
    if (isPractice && stats.wavesCompleted >= 2) {
      isWaveTransitioning.current = false;
      setGameState('complete');
      return;
    }
    
    // Wave clear bonus
    setScore(s => s + 100 + wave * 50);
    
    // MILESTONE DAMAGE: Deal damage for completing the wave
    onDamage?.({ target: 'adversary', amount: GAME_DAMAGE_VALUES.energy_beam.waveComplete, source: 'wave_complete' });
    
    setGameState('wave-transition');
    
    setTimeout(() => {
      setWave(prevWave => {
        const nextWave = prevWave + 1;
        setEnemies(generateEnemies(nextWave, config));
        return nextWave;
      });
      setGameState('playing');
      isWaveTransitioning.current = false; // Unlock after complete
    }, 2000);
  }, [enemies.length, wave, config, gameState, isPractice]);
  
  // Determine result based on performance
  const getResult = useCallback((wavesCleared: number, hasLives: boolean): 'perfect' | 'good' | 'partial' | 'fail' => {
    if (!hasLives) {
      if (wavesCleared >= 5) return 'perfect';
      if (wavesCleared >= 3) return 'good';
      if (wavesCleared >= 1) return 'partial';
      return 'fail';
    }
    return 'perfect';
  }, []);
  
  // Complete game - calculate result based on waves cleared
  useEffect(() => {
    if (gameState !== 'complete') return;
    
    const stats = statsRef.current;
    const wavesCleared = stats.wavesCompleted;
    
    // Accuracy based on waves cleared
    const waveThresholds = { easy: 4, medium: 3, hard: 2 };
    const threshold = waveThresholds[difficulty];
    const accuracy = Math.min(100, Math.round((wavesCleared / threshold) * 100));
    
    const result = getResult(wavesCleared, lives > 0);
    
    const timer = setTimeout(() => {
      onComplete({
        success: wavesCleared >= 1,
        accuracy,
        result,
        highScoreValue: wavesCleared, // Waves completed for high score
      });
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [gameState, lives, difficulty, onComplete, getResult]);
  
  return (
    <div className="relative w-full h-full min-h-[500px] flex flex-col items-center overflow-hidden select-none">
      <StarfieldBackground />
      
      {/* HUD - No timer, show wave without max */}
      <div className="absolute top-0 left-0 right-0 z-30 p-3">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-2xl font-black text-white" style={{ textShadow: '0 0 10px rgba(59,130,246,0.5)' }}>
              {score.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">SCORE</div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-bold text-cyan-400">WAVE {wave}</div>
            <div className="text-xs text-muted-foreground">Endless Mode</div>
          </div>
          
          <LivesDisplay lives={lives} />
        </div>
        
        {/* Power-up indicators */}
        <div className="flex gap-2 mt-2">
          {hasShield && (
            <div className="px-2 py-1 bg-blue-500/30 rounded text-xs text-blue-400 flex items-center gap-1">
              <Shield className="w-3 h-3" /> SHIELD
            </div>
          )}
          {rapidFire && (
            <div className="px-2 py-1 bg-amber-500/30 rounded text-xs text-amber-400 flex items-center gap-1">
              <Zap className="w-3 h-3" /> RAPID
            </div>
          )}
        </div>
      </div>
      
      {/* Game area */}
      <div
        ref={gameAreaRef}
        className="relative w-full h-full"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onClick={fireProjectile}
      >
        {/* Enemies */}
        {enemies.map(enemy => (
          <EnemySprite key={enemy.id} enemy={enemy} />
        ))}
        
        {/* Projectiles */}
        {projectiles.map(proj => (
          <ProjectileSprite key={proj.id} projectile={proj} />
        ))}
        
        {/* Power-ups */}
        {powerUps.map(pu => (
          <PowerUpSprite key={pu.id} powerUp={pu} />
        ))}
        
        {/* Explosions */}
        <AnimatePresence>
          {explosions.map(exp => (
            <ExplosionEffect key={exp.id} explosion={exp} />
          ))}
        </AnimatePresence>
        
        {/* Score popups */}
        <AnimatePresence>
          {scorePopups.map(popup => (
            <ScorePopupComponent key={popup.id} popup={popup} />
          ))}
        </AnimatePresence>
        
        {/* Player */}
        {gameState === 'playing' && (
          <PlayerShip x={playerX} hasShield={hasShield} isInvulnerable={isInvulnerable} />
        )}
      </div>
      
      {/* Touch controls */}
      {gameState === 'playing' && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-between px-4 z-20">
          <button
            className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-600 flex items-center justify-center active:bg-slate-700"
            onTouchStart={handleMoveLeft}
          >
            <ChevronLeft className="w-8 h-8 text-white" />
          </button>
          <button
            className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-600 flex items-center justify-center active:bg-slate-700"
            onTouchStart={handleMoveRight}
          >
            <ChevronRight className="w-8 h-8 text-white" />
          </button>
        </div>
      )}
      
      {/* Overlays */}
      <AnimatePresence>
        {gameState === 'countdown' && (
          <CountdownOverlay count={countdown} onComplete={() => {}} />
        )}
        {gameState === 'wave-transition' && (
          <WaveTransition wave={wave + 1} />
        )}
        {gameState === 'paused' && (
          <PauseOverlay onResume={() => setGameState('playing')} />
        )}
      </AnimatePresence>
    </div>
  );
}
