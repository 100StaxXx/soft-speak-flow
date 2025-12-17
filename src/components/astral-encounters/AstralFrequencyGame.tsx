import { useState, useEffect, useCallback, useRef, memo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
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

// Difficulty configuration
const DIFFICULTY_CONFIG = {
  easy: {
    gameTime: 30,
    startSpeed: 12,
    maxSpeed: 20,
    spawnInterval: 1.2,
    obstacleChance: 0.6,
  },
  medium: {
    gameTime: 35,
    startSpeed: 16,
    maxSpeed: 28,
    spawnInterval: 0.9,
    obstacleChance: 0.65,
  },
  hard: {
    gameTime: 40,
    startSpeed: 20,
    maxSpeed: 35,
    spawnInterval: 0.7,
    obstacleChance: 0.7,
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

// Obstacle component
interface ObstacleProps {
  id: string;
  lane: number;
  z: number;
  type: 'asteroid' | 'crystal' | 'shield';
  onCollect?: () => void;
  onHit?: () => void;
}

const Obstacle = memo(({ lane, z, type }: Omit<ObstacleProps, 'id' | 'onCollect' | 'onHit'>) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 2;
      meshRef.current.rotation.y += delta * 1.5;
    }
  });

  const color = type === 'asteroid' ? '#ef4444' : type === 'crystal' ? '#fbbf24' : '#22d3ee';
  const size = type === 'asteroid' ? 0.6 : 0.4;

  return (
    <mesh ref={meshRef} position={[LANE_POSITIONS[lane], -1.5, z]}>
      {type === 'asteroid' ? (
        <dodecahedronGeometry args={[size]} />
      ) : type === 'crystal' ? (
        <octahedronGeometry args={[size]} />
      ) : (
        <icosahedronGeometry args={[size]} />
      )}
      <meshBasicMaterial color={color} />
    </mesh>
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
    
    const playerX = LANE_POSITIONS[playerLane];
    
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
        <MovingObstacle key={obs.id} {...obs} speed={speed} gameState={gameState} />
      ))}
    </>
  );
};

// Moving obstacle wrapper
const MovingObstacle = memo(({ id, lane, z, type, speed, gameState }: { 
  id: string; lane: number; z: number; type: 'asteroid' | 'crystal' | 'shield'; speed: number; gameState: string 
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const zRef = useRef(z);

  useFrame((_, delta) => {
    if (gameState !== 'playing' || !groupRef.current) return;
    zRef.current += delta * speed;
    groupRef.current.position.z = zRef.current;
  });

  return (
    <group ref={groupRef} position={[0, 0, z]}>
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

// UI Overlay for score/lives
const GameUI = memo(({ score, lives, combo, hasShield }: { score: number; lives: number; combo: number; hasShield: boolean }) => (
  <div className="absolute top-16 left-4 right-4 flex justify-between items-start pointer-events-none z-10">
    <div className="flex flex-col gap-2">
      <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1">
        <span className="text-yellow-400 font-bold">{score}</span>
        <span className="text-xs text-muted-foreground ml-1">pts</span>
      </div>
      {combo > 1 && (
        <div className="bg-purple-500/50 backdrop-blur-sm rounded-lg px-3 py-1">
          <span className="text-white font-bold">{combo}x</span>
          <span className="text-xs text-purple-200 ml-1">combo</span>
        </div>
      )}
    </div>
    <div className="flex items-center gap-2">
      {hasShield && (
        <div className="bg-cyan-500/50 backdrop-blur-sm rounded-lg px-3 py-1">
          <span className="text-cyan-200">🛡️</span>
        </div>
      )}
      <div className="flex gap-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <span key={i} className={`text-xl ${i < lives ? 'opacity-100' : 'opacity-30'}`}>
            ❤️
          </span>
        ))}
      </div>
    </div>
  </div>
));
GameUI.displayName = 'GameUI';

// Lane controls
const LaneControls = memo(({ onLeft, onRight }: { onLeft: () => void; onRight: () => void }) => (
  <div className="absolute bottom-4 left-4 right-4 flex justify-between z-10">
    <button
      className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center active:bg-white/20 transition-colors"
      onPointerDown={onLeft}
    >
      <span className="text-3xl">◀</span>
    </button>
    <button
      className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center active:bg-white/20 transition-colors"
      onPointerDown={onRight}
    >
      <span className="text-3xl">▶</span>
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
  const [playerLane, setPlayerLane] = useState(1);
  const [hasShield, setHasShield] = useState(false);
  const [lives, setLives] = useState(3);
  
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
    } else if (type === 'shield') {
      setHasShield(true);
      triggerHaptic('medium');
    }
  }, []);
  
  // Game loop - spawn obstacles and update timer
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const interval = setInterval(() => {
      // Update timer
      setTimeLeft(prev => {
        if (prev <= 0) {
          setGameState('complete');
          return 0;
        }
        return prev - 0.1;
      });
      
      // Update distance
      setDistance(prev => prev + speed * 0.1);
      
      // Gradually increase speed
      setSpeed(prev => Math.min(config.maxSpeed, prev + 0.02));
      
      // Spawn obstacles
      const now = Date.now();
      if (now - lastSpawnRef.current > config.spawnInterval * 1000) {
        lastSpawnRef.current = now;
        
        const rand = Math.random();
        const type: 'asteroid' | 'crystal' | 'shield' = 
          rand < config.obstacleChance ? 'asteroid' : 
          rand < 0.95 ? 'crystal' : 'shield';
        
        const lane = Math.floor(Math.random() * 3);
        
        setObstacles(prev => [
          ...prev.filter(o => o.z < 15), // Clean up passed obstacles
          { id: `${now}-${Math.random()}`, lane, z: -80, type }
        ]);
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [gameState, config, speed]);
  
  // Complete game
  useEffect(() => {
    if (gameState !== 'complete') return;
    
    const accuracy = Math.min(100, Math.round((score / Math.max(1, distance * 0.3)) * 100));
    const result: 'perfect' | 'good' | 'partial' | 'fail' = 
      accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 50 ? 'partial' : 'fail';
    
    onComplete({
      success: result !== 'fail',
      accuracy,
      result,
    });
  }, [gameState, score, distance, maxCombo, onComplete]);
  
  return (
    <div 
      className="relative w-full h-full min-h-[500px] rounded-lg overflow-hidden bg-slate-950"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 3D Canvas */}
      <Canvas
        camera={{ fov: 75, near: 0.1, far: 200 }}
        style={{ background: 'linear-gradient(to bottom, #0f0a1a, #1a0a2e)' }}
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
      
      {/* HUD */}
      <GameHUD title="Cosmiq Dash" timeLeft={Math.ceil(timeLeft)} score={score} />
      <GameUI score={score} lives={lives} combo={combo} hasShield={hasShield} />
      
      {/* Controls */}
      <LaneControls 
        onLeft={() => changeLane(-1)} 
        onRight={() => changeLane(1)} 
      />
      
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
