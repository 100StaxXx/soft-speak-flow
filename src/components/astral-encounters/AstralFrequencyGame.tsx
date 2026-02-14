import { useState, useEffect, useCallback, useRef, memo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';
import { CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic } from './gameUtils';

import { DamageEvent, GAME_DAMAGE_VALUES } from '@/types/battleSystem';
import { ArcadeDifficulty } from '@/types/arcadeDifficulty';

interface AstralFrequencyGameProps {
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

// Difficulty configuration - NO TIMER, endless until lives = 0
// UNLIMITED progressive speed - no cap, gets faster forever
const DIFFICULTY_CONFIG = {
  beginner: {
    startSpeed: 16,
    spawnInterval: 1.2,
    obstacleChance: 0.45,
    speedIncrement: 0.15,
  },
  easy: {
    startSpeed: 22,
    spawnInterval: 0.9,
    obstacleChance: 0.55,
    speedIncrement: 0.25,
  },
  medium: {
    startSpeed: 28,
    spawnInterval: 0.7,
    obstacleChance: 0.6,
    speedIncrement: 0.35,
  },
  hard: {
    startSpeed: 35,
    spawnInterval: 0.5,
    obstacleChance: 0.65,
    speedIncrement: 0.45,
  },
  master: {
    startSpeed: 45,
    spawnInterval: 0.35,
    obstacleChance: 0.72,
    speedIncrement: 0.6,
  },
};

const LANE_POSITIONS = [-2.5, 0, 2.5];

// 3D Tunnel component
const Tunnel = memo(({ speed }: { speed: number }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.z += delta * 0.1 * (speed / 15);
    }
  });

  return (
    <group>
      {/* Tunnel walls */}
      <mesh ref={meshRef} position={[0, 0, -50]}>
        <cylinderGeometry args={[8, 8, 120, 32, 1, true]} />
        <meshBasicMaterial 
          color="#1a0a2e" 
          side={THREE.BackSide}
          transparent
          opacity={0.9}
        />
      </mesh>
      
      {/* Glowing grid lines on tunnel */}
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={i} position={[0, 0, -50]} rotation={[0, 0, (i * Math.PI * 2) / 12]}>
          <boxGeometry args={[0.05, 120, 0.05]} />
          <meshBasicMaterial color="#a855f7" transparent opacity={0.3} />
        </mesh>
      ))}
      
      {/* Lane markers */}
      {LANE_POSITIONS.map((x, i) => (
        <mesh key={`lane-${i}`} position={[x, -3, 0]}>
          <boxGeometry args={[0.1, 0.1, 200]} />
          <meshBasicMaterial color="#6366f1" transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  );
});
Tunnel.displayName = 'Tunnel';

// Scrolling floor
const ScrollingFloor = memo(({ speed }: { speed: number }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const offsetRef = useRef(0);

  useFrame((_, delta) => {
    if (meshRef.current) {
      offsetRef.current += delta * speed * 0.5;
      (meshRef.current.material as THREE.MeshBasicMaterial).map!.offset.y = offsetRef.current;
    }
  });

  // Create grid texture
  const texture = new THREE.DataTexture(
    new Uint8Array([100, 50, 150, 255, 50, 25, 100, 255, 50, 25, 100, 255, 100, 50, 150, 255]),
    2, 2
  );
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 100);
  texture.needsUpdate = true;

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, -50]}>
      <planeGeometry args={[8, 150]} />
      <meshBasicMaterial map={texture} transparent opacity={0.5} />
    </mesh>
  );
});
ScrollingFloor.displayName = 'ScrollingFloor';

// 3D Player orb
const Player = memo(({ lane, hasShield }: { lane: number; hasShield: boolean }) => {
  const groupRef = useRef<THREE.Group>(null);
  const targetX = useRef(LANE_POSITIONS[lane]);
  
  useEffect(() => {
    targetX.current = LANE_POSITIONS[lane];
  }, [lane]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      // Smooth lane transition
      groupRef.current.position.x += (targetX.current - groupRef.current.position.x) * 10 * delta;
      groupRef.current.rotation.z += delta * 2;
    }
  });

  return (
    <group ref={groupRef} position={[LANE_POSITIONS[1], -1.5, 5]}>
      {/* Main orb */}
      <mesh>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshBasicMaterial color="#a855f7" />
      </mesh>
      
      {/* Glow */}
      <mesh>
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.3} />
      </mesh>
      
      {/* Shield effect */}
      {hasShield && (
        <mesh>
          <sphereGeometry args={[0.9, 16, 16]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.4} wireframe />
        </mesh>
      )}
      
      {/* Trail */}
      <mesh position={[0, 0, -1]}>
        <coneGeometry args={[0.3, 2, 8]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.4} />
      </mesh>
    </group>
  );
});
Player.displayName = 'Player';

// Obstacle component - LARGER and more obvious
interface ObstacleProps {
  id: string;
  lane: number;
  z: number;
  type: 'asteroid' | 'crystal' | 'shield';
  onCollect?: () => void;
  onHit?: () => void;
}

const Obstacle = memo(({ lane, z, type }: Omit<ObstacleProps, 'id' | 'onCollect' | 'onHit'>) => {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.x += delta * 2;
      groupRef.current.rotation.y += delta * 1.5;
    }
  });

  // MUCH LARGER sizes for visibility
  const size = type === 'asteroid' ? 1.2 : type === 'crystal' ? 0.8 : 0.9;
  
  return (
    <group ref={groupRef} position={[LANE_POSITIONS[lane], -1.5, z]}>
      {type === 'asteroid' && (
        <>
          {/* Main asteroid - red spiky */}
          <mesh>
            <dodecahedronGeometry args={[size]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
          {/* Glowing danger outline */}
          <mesh>
            <dodecahedronGeometry args={[size * 1.15]} />
            <meshBasicMaterial color="#ff0000" transparent opacity={0.3} wireframe />
          </mesh>
          {/* Pulsing glow */}
          <mesh>
            <sphereGeometry args={[size * 1.4, 8, 8]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.15} />
          </mesh>
        </>
      )}
      {type === 'crystal' && (
        <>
          {/* Golden crystal */}
          <mesh>
            <octahedronGeometry args={[size]} />
            <meshBasicMaterial color="#fbbf24" />
          </mesh>
          {/* Sparkle glow */}
          <mesh>
            <octahedronGeometry args={[size * 1.2]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.4} wireframe />
          </mesh>
          {/* Light emission */}
          <pointLight color="#fbbf24" intensity={2} distance={5} />
        </>
      )}
      {type === 'shield' && (
        <>
          {/* Cyan shield orb */}
          <mesh>
            <icosahedronGeometry args={[size]} />
            <meshBasicMaterial color="#22d3ee" />
          </mesh>
          {/* Shield ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[size * 1.3, 0.1, 8, 16]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.6} />
          </mesh>
          {/* Glow */}
          <mesh>
            <sphereGeometry args={[size * 1.5, 8, 8]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.2} />
          </mesh>
          <pointLight color="#22d3ee" intensity={2} distance={5} />
        </>
      )}
    </group>
  );
});
Obstacle.displayName = 'Obstacle';

// Game scene that handles all 3D logic
interface GameSceneProps {
  gameState: 'countdown' | 'playing' | 'paused' | 'complete';
  playerLane: number;
  hasShield: boolean;
  speed: number;
  obstacles: Array<{ id: string; lane: number; z: number; type: 'asteroid' | 'crystal' | 'shield' }>;
  onObstaclePass: (id: string, type: string) => void;
}

const GameScene = ({ gameState, playerLane, hasShield, speed, obstacles, onObstaclePass }: GameSceneProps) => {
  const { camera } = useThree();
  const passedRef = useRef(new Set<string>());
  
  // Set up camera
  useEffect(() => {
    camera.position.set(0, 2, 10);
    camera.lookAt(0, 0, -10);
  }, [camera]);

  // Check for collisions/collections
  useFrame(() => {
    if (gameState !== 'playing') return;
    
    obstacles.forEach(obs => {
      // Check if obstacle has passed player (z > 5)
      if (obs.z > 4 && !passedRef.current.has(obs.id)) {
        const distance = Math.abs(obs.lane - playerLane);
        
        if (distance === 0) {
          // Hit!
          passedRef.current.add(obs.id);
          onObstaclePass(obs.id, obs.type);
        }
      }
      
      // Remove from tracking once fully passed
      if (obs.z > 10) {
        passedRef.current.delete(obs.id);
      }
    });
  });

  return (
    <>
      {/* Ambient lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 5, 10]} intensity={1} color="#a855f7" />
      
      {/* Background stars */}
      <Stars />
      
      {/* Tunnel */}
      <Tunnel speed={speed} />
      <ScrollingFloor speed={speed} />
      
      {/* Player */}
      <Player lane={playerLane} hasShield={hasShield} />
      
      {/* Obstacles */}
      {obstacles.map(obs => (
        <MovingObstacle key={obs.id} {...obs} />
      ))}
    </>
  );
};

// Moving obstacle wrapper - position now controlled by parent state
const MovingObstacle = memo(({ lane, z, type }: {
  lane: number; z: number; type: 'asteroid' | 'crystal' | 'shield';
}) => {
  return (
    <group position={[0, 0, z]}>
      <Obstacle lane={lane} z={0} type={type} />
    </group>
  );
});
MovingObstacle.displayName = 'MovingObstacle';

// Stars background
const Stars = memo(() => {
  const starsRef = useRef<THREE.Points>(null);
  
  const positions = new Float32Array(1000 * 3);
  for (let i = 0; i < 1000; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 100;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 50 + 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 200 - 50;
  }

  useFrame((_, delta) => {
    if (starsRef.current) {
      starsRef.current.rotation.z += delta * 0.02;
    }
  });

  return (
    <points ref={starsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.2} color="#ffffff" transparent opacity={0.8} />
    </points>
  );
});
Stars.displayName = 'Stars';

// UI Overlay for score/lives - fullscreen positioning, compact mode support
const GameUI = memo(({ score, lives, combo, hasShield, distance, compact = false }: { 
  score: number; lives: number; combo: number; hasShield: boolean; distance: number; compact?: boolean;
}) => (
  <div className={`absolute ${compact ? 'top-1 left-1 right-1' : 'top-2 left-2 right-2'} flex justify-between items-start pointer-events-none z-10 safe-area-inset-top`}>
    <div className="flex flex-col gap-1">
      <div className="bg-black/60 backdrop-blur-sm rounded-lg px-2 py-0.5">
        <span className={`text-yellow-400 font-bold ${compact ? 'text-sm' : 'text-base'}`}>{score}</span>
        {!compact && <span className="text-[10px] text-muted-foreground ml-0.5">pts</span>}
      </div>
      <div className="bg-black/60 backdrop-blur-sm rounded-lg px-2 py-0.5">
        <span className={`text-cyan-400 font-bold ${compact ? 'text-sm' : 'text-base'}`}>{Math.round(distance)}</span>
        {!compact && <span className="text-[10px] text-muted-foreground ml-0.5">m</span>}
      </div>
      {combo > 1 && (
        <motion.div 
          className="bg-purple-500/60 backdrop-blur-sm rounded-lg px-2 py-0.5"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
        >
          <span className={`text-white font-bold ${compact ? 'text-sm' : 'text-base'}`}>{combo}x</span>
          {!compact && <span className="text-[10px] text-purple-200 ml-0.5">combo</span>}
        </motion.div>
      )}
    </div>
    <div className="flex items-center gap-1">
      {hasShield && (
        <motion.div 
          className="bg-cyan-500/60 backdrop-blur-sm rounded-lg px-1.5 py-0.5"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          <span className={compact ? 'text-sm' : 'text-lg'}>🛡️</span>
        </motion.div>
      )}
      <div className="flex gap-0.5 bg-black/60 backdrop-blur-sm rounded-lg px-1.5 py-0.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <motion.span 
            key={i} 
            className={`${compact ? 'text-sm' : 'text-lg'} ${i < lives ? '' : 'grayscale opacity-30'}`}
            animate={i < lives ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            ❤️
          </motion.span>
        ))}
      </div>
    </div>
  </div>
));
GameUI.displayName = 'GameUI';

// Lane controls - fullscreen positioning, compact
const LaneControls = memo(({ onLeft, onRight }: { onLeft: () => void; onRight: () => void }) => (
  <div className="absolute bottom-4 left-3 right-3 flex justify-between z-10 safe-area-inset-bottom">
    <button
      className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:bg-white/30 transition-colors border border-white/20"
      onPointerDown={onLeft}
    >
      <span className="text-3xl text-white">◀</span>
    </button>
    <button
      className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:bg-white/30 transition-colors border border-white/20"
      onPointerDown={onRight}
    >
      <span className="text-3xl text-white">▶</span>
    </button>
  </div>
));
LaneControls.displayName = 'LaneControls';

// Main game component - ENDLESS until lives = 0
export const AstralFrequencyGame = ({
  companionStats: _companionStats,
  onComplete,
  onDamage,
  tierAttackDamage = 15,
  difficulty = 'medium',
  isPractice = false,
  compact = false,
}: AstralFrequencyGameProps) => {
  const config = DIFFICULTY_CONFIG[difficulty];
  
  // Game state
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'complete'>('countdown');
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  
  // Player state
  const [playerLane, setPlayerLane] = useState(1);
  const [hasShield, setHasShield] = useState(false);
  const [lives, setLives] = useState(3);
  const [showDamageFlash, setShowDamageFlash] = useState(false);
  
  // Game objects
  const [obstacles, setObstacles] = useState<Array<{ id: string; lane: number; z: number; type: 'asteroid' | 'crystal' | 'shield' }>>([]);
  const [speed, setSpeed] = useState(config.startSpeed);
  
  // Refs
  const gameStateRef = useRef(gameState);
  const playerLaneRef = useRef(playerLane);
  const hasShieldRef = useRef(hasShield);
  const lastSpawnRef = useRef(0);
  const touchStartRef = useRef<{ x: number } | null>(null);
  
  // Sync refs
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { playerLaneRef.current = playerLane; }, [playerLane]);
  useEffect(() => { hasShieldRef.current = hasShield; }, [hasShield]);
  
  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
  }, []);
  
  const changeLane = useCallback((direction: -1 | 1) => {
    if (gameStateRef.current !== 'playing') return;
    setPlayerLane(prev => Math.max(0, Math.min(2, prev + direction)));
    triggerHaptic('light');
  }, []);
  
  // Touch controls
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX };
  }, []);
  
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    if (Math.abs(deltaX) > 30) {
      changeLane(deltaX > 0 ? 1 : -1);
    }
    touchStartRef.current = null;
  }, [changeLane]);
  
  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStateRef.current !== 'playing') return;
      if (e.key === 'ArrowLeft' || e.key === 'a') changeLane(-1);
      if (e.key === 'ArrowRight' || e.key === 'd') changeLane(1);
      if (e.key === 'Escape') setGameState('paused');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeLane]);
  
  // Handle obstacle interactions
  const handleObstaclePass = useCallback((id: string, type: string) => {
    setObstacles(prev => prev.filter(o => o.id !== id));
    
    if (type === 'asteroid') {
      if (hasShieldRef.current) {
        setHasShield(false);
        triggerHaptic('medium');
      } else {
        // Trigger damage flash animation
        setShowDamageFlash(true);
        setTimeout(() => setShowDamageFlash(false), 200);
        
        // Player takes damage from collision
        onDamage?.({ target: 'player', amount: tierAttackDamage, source: 'collision' });
        
        setLives(prev => {
          const newLives = prev - 1;
          if (newLives <= 0) {
            setGameState('complete');
          }
          return newLives;
        });
        setCombo(0);
        triggerHaptic('heavy');
      }
    } else if (type === 'crystal') {
      const points = 10 * (1 + combo * 0.1);
      setScore(prev => prev + Math.round(points));
      setCombo(prev => {
        const newCombo = prev + 1;
        setMaxCombo(max => Math.max(max, newCombo));
        return newCombo;
      });
      triggerHaptic('light');
      // Crystal collection no longer deals damage - distance milestone-based only
    } else if (type === 'shield') {
      setHasShield(true);
      triggerHaptic('medium');
    }
  }, [combo, onDamage, tierAttackDamage]);
  
  // Game loop - spawn obstacles, update positions, and update distance (NO TIMER)
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const interval = setInterval(() => {
      // Update distance
      setDistance(prev => {
        const newDistance = prev + speed * 0.1;
        
        // MILESTONE DAMAGE: Deal damage every 100m traveled
        const prevMilestones = Math.floor(prev / 100);
        const newMilestones = Math.floor(newDistance / 100);
        if (newMilestones > prevMilestones) {
          onDamage?.({ target: 'adversary', amount: GAME_DAMAGE_VALUES.astral_frequency.distanceMilestone, source: 'distance_milestone' });
        }
        
        // Practice mode: end after reaching 500 distance
        if (isPractice && newDistance >= 500) {
          setGameState('complete');
        }
        
        return newDistance;
      });
      
      // Gradually increase speed - NO LIMIT
      setSpeed(prev => prev + config.speedIncrement);
      
      // Update obstacle positions and spawn new ones
      setObstacles(prev => {
        // Move all obstacles forward
        const moved = prev.map(o => ({ ...o, z: o.z + speed * 0.15 }));
        
        // Filter out obstacles that are too far past player
        const filtered = moved.filter(o => o.z < 15);
        
        // Spawn new obstacle if needed
        const now = Date.now();
        if (now - lastSpawnRef.current > config.spawnInterval * 1000) {
          lastSpawnRef.current = now;
          
          const rand = Math.random();
          const type: 'asteroid' | 'crystal' | 'shield' = 
            rand < config.obstacleChance ? 'asteroid' : 
            rand < 0.95 ? 'crystal' : 'shield';
          
          const lane = Math.floor(Math.random() * 3);
          
          return [...filtered, { id: `${now}-${Math.random()}`, lane, z: -80, type }];
        }
        
        return filtered;
      });
    }, 100);
    
    return () => clearInterval(interval);
  }, [gameState, config, speed, isPractice, onDamage]);
  
  // Complete game - calculate result based on distance and score
  useEffect(() => {
    if (gameState !== 'complete') return;
    
    // Score based on distance traveled + crystals collected
    // Accuracy based on how far they got relative to difficulty
    const distanceThresholds: Record<ArcadeDifficulty, number> = { 
      beginner: 600, 
      easy: 500, 
      medium: 400, 
      hard: 300, 
      master: 250 
    };
    const threshold = distanceThresholds[difficulty];
    const accuracy = Math.min(100, Math.round((distance / threshold) * 100));
    
    const result: 'perfect' | 'good' | 'fail' = 
      accuracy >= 90 ? 'perfect' : accuracy >= 50 ? 'good' : 'fail';
    
    onComplete({
      success: result !== 'fail',
      accuracy,
      result,
      highScoreValue: distance,
      gameStats: {
        distance: Math.floor(distance),
        score,
        maxCombo,
        livesRemaining: lives,
      },
    });
  }, [gameState, score, distance, difficulty, onComplete, maxCombo, lives]);
  
  return (
    <div 
      className="fixed inset-0 z-50 overflow-hidden bg-slate-950"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 3D Canvas - Full screen */}
      <Canvas
        camera={{ fov: 75, near: 0.1, far: 200 }}
        style={{ 
          background: 'linear-gradient(to bottom, #0f0a1a, #1a0a2e)',
          position: 'absolute',
          inset: 0,
        }}
      >
        <Suspense fallback={null}>
          <GameScene
            gameState={gameState}
            playerLane={playerLane}
            hasShield={hasShield}
            speed={speed}
            obstacles={obstacles}
            onObstaclePass={handleObstaclePass}
          />
        </Suspense>
      </Canvas>
      
      {/* HUD overlay */}
      <GameUI score={score} lives={lives} combo={combo} hasShield={hasShield} distance={distance} compact={compact} />
      
      {/* Controls - positioned at bottom */}
      <LaneControls 
        onLeft={() => changeLane(-1)} 
        onRight={() => changeLane(1)} 
      />
      
      {/* Damage flash overlay */}
      <AnimatePresence>
        {showDamageFlash && (
          <motion.div 
            className="absolute inset-0 bg-red-500/40 pointer-events-none z-30"
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>
      
      {/* Overlays */}
      <AnimatePresence>
        {gameState === 'countdown' && (
          <CountdownOverlay count={3} onComplete={handleCountdownComplete} />
        )}
        {gameState === 'paused' && (
          <PauseOverlay onResume={() => setGameState('playing')} />
        )}
      </AnimatePresence>
    </div>
  );
};
