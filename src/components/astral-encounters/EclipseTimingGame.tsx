import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic, useStaticStars } from './gameUtils';
import { TrackRatingUI } from './TrackRatingUI';
import { useRhythmTrack, RhythmTrack } from '@/hooks/useRhythmTrack';
import { Moon, Star, Sun, Music, Sparkles } from 'lucide-react';
import { stopEncounterMusic } from '@/utils/soundEffects';
import { DamageEvent, GAME_DAMAGE_VALUES } from '@/types/battleSystem';
import { ArcadeDifficulty } from '@/types/arcadeDifficulty';

interface EclipseTimingGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  onDamage?: (event: DamageEvent) => void;
  tierAttackDamage?: number;
  difficulty?: ArcadeDifficulty;
  questIntervalScale?: number;
  maxTimer?: number;
  isPractice?: boolean;
}

// Lane types
type LaneType = 'moon' | 'star' | 'sun';

interface Note {
  id: number;
  lane: LaneType;
  spawnTime: number;
  y: number; // 0-100 percentage from top
  hit: boolean;
  missed: boolean;
}

type HitResult = 'perfect' | 'great' | 'good' | 'miss';

// Pre-calculated lane indices for O(1) lookup
const LANE_INDICES: Record<LaneType, number> = { moon: 0, star: 1, sun: 2 };

// Difficulty configurations for BPM-synced notes
const DIFFICULTY_CONFIG = {
  beginner: {
    notesPerBeat: 0.25,   // Every 4 beats
    scrollSpeed: 0.025,
    patterns: ['single'] as const,
  },
  easy: {
    notesPerBeat: 0.5,    // Every 2 beats
    scrollSpeed: 0.035,
    patterns: ['single'] as const,
  },
  medium: {
    notesPerBeat: 1,      // Every beat
    scrollSpeed: 0.045,
    patterns: ['single', 'double'] as const,
  },
  hard: {
    notesPerBeat: 2,      // Every half-beat
    scrollSpeed: 0.055,
    patterns: ['single', 'double', 'triple'] as const,
  },
  master: {
    notesPerBeat: 3,      // Every third-beat
    scrollSpeed: 0.07,
    patterns: ['single', 'double', 'triple'] as const,
  },
};

// IMPROVED: More forgiving timing windows (in % distance from hit zone)
const TIMING_WINDOWS = {
  perfect: 5,  // Was 3% → now 5% (easier to hit perfect)
  great: 9,    // Was 6% → now 9%
  good: 14,    // Was 10% → now 14%
};

// Max misses allowed by difficulty before losing
const MAX_MISSES_BY_DIFFICULTY: Record<ArcadeDifficulty, number> = {
  beginner: 12,
  easy: 10,
  medium: 8,
  hard: 5,
  master: 3,
};

// IMPROVED: Hit zone moved up for better visibility
const HIT_ZONE_Y = 80; // Was 85% → now 80%
const MAX_HIT_EFFECTS = 8; // Increased for more visual feedback
const RENDER_THROTTLE_MS = 16; // ~60fps state sync

const HIT_RESULTS: Record<HitResult, { label: string; points: number; color: string; particles: number }> = {
  perfect: { label: 'PERFECT!', points: 100, color: 'hsl(45, 100%, 60%)', particles: 12 },
  great: { label: 'GREAT!', points: 75, color: 'hsl(271, 91%, 65%)', particles: 8 },
  good: { label: 'GOOD', points: 50, color: 'hsl(142, 71%, 45%)', particles: 5 },
  miss: { label: 'MISS', points: 0, color: 'hsl(0, 84%, 60%)', particles: 0 },
};

const LANE_CONFIG: Record<LaneType, { icon: typeof Moon; color: string; bgColor: string }> = {
  moon: { icon: Moon, color: 'hsl(271, 91%, 65%)', bgColor: 'hsl(271, 91%, 65%)' },
  star: { icon: Star, color: 'hsl(45, 100%, 60%)', bgColor: 'hsl(45, 100%, 60%)' },
  sun: { icon: Sun, color: 'hsl(25, 95%, 55%)', bgColor: 'hsl(25, 95%, 55%)' },
};

const LANES: LaneType[] = ['moon', 'star', 'sun'];

// Loading buffer times to prevent lag
const MIN_LOADING_TIME_MS = 1500;
const READY_BUFFER_MS = 500;

const getComboMultiplier = (combo: number): number => {
  if (combo >= 50) return 4;
  if (combo >= 25) return 3;
  if (combo >= 10) return 2;
  return 1;
};

// Batched game stats for single state update
interface GameStats {
  score: number;
  combo: number;
  maxCombo: number;
  notesHit: number;
  notesMissed: number;
}

const initialGameStats: GameStats = {
  score: 0,
  combo: 0,
  maxCombo: 0,
  notesHit: 0,
  notesMissed: 0,
};

// IMPROVED: Animated star background with parallax
const AnimatedStarBackground = memo(({ stars, beatPulse }: { stars: ReturnType<typeof useStaticStars>; beatPulse: boolean }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* Ambient floating particles */}
    <div className="absolute inset-0">
      {Array.from({ length: 15 }).map((_, i) => (
        <div
          key={`particle-${i}`}
          className="absolute rounded-full animate-stellar-float"
          style={{
            width: `${2 + Math.random() * 3}px`,
            height: `${2 + Math.random() * 3}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: `radial-gradient(circle, hsl(${200 + Math.random() * 60}, 80%, 70%), transparent)`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${4 + Math.random() * 4}s`,
            opacity: 0.4 + Math.random() * 0.4,
          }}
        />
      ))}
    </div>
    
    {/* Static stars with parallax layers */}
    {stars.map((star, i) => (
      <div
        key={star.id}
        className="absolute rounded-full transition-all duration-300"
        style={{ 
          left: `${star.x}%`, 
          top: `${star.y}%`,
          width: `${i % 3 === 0 ? 3 : 2}px`,
          height: `${i % 3 === 0 ? 3 : 2}px`,
          background: i % 5 === 0 
            ? 'radial-gradient(circle, hsl(45, 100%, 80%), hsl(45, 100%, 60%))'
            : 'radial-gradient(circle, hsl(210, 100%, 90%), hsl(210, 50%, 70%))',
          boxShadow: beatPulse && i % 3 === 0 
            ? `0 0 ${8 + (i % 4) * 2}px hsl(45, 100%, 70%)` 
            : `0 0 ${3 + (i % 3)}px rgba(255,255,255,0.5)`,
          opacity: beatPulse && i % 2 === 0 ? 1 : 0.6 + (i % 4) * 0.1,
          transform: beatPulse ? `scale(${1 + (i % 3) * 0.15})` : 'scale(1)',
        }}
      />
    ))}
    
    {/* Nebula gradients */}
    <div 
      className="absolute inset-0 opacity-30"
      style={{
        background: 'radial-gradient(ellipse at 20% 30%, hsl(271, 50%, 30%) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, hsl(45, 50%, 20%) 0%, transparent 50%)',
      }}
    />
  </div>
));
AnimatedStarBackground.displayName = 'AnimatedStarBackground';

// IMPROVED: Larger note with trail effect and pulsing glow
const NoteOrb = memo(({ note, laneIndex, approachPercent }: { note: Note; laneIndex: number; approachPercent: number }) => {
  const config = LANE_CONFIG[note.lane];
  const Icon = config.icon;
  
  // Calculate glow intensity based on approach
  const glowIntensity = Math.min(1, approachPercent * 1.5);
  const scale = 1 + (approachPercent * 0.15);
  
  return (
    <div
      className="absolute flex items-center justify-center gpu-layer"
      style={{
        width: '72px', // Increased from 56px
        height: '72px',
        left: `calc(${(laneIndex + 0.5) * 33.33}% - 36px)`,
        transform: `translateY(calc(${note.y}vh - 50%)) translateZ(0) scale(${scale})`,
        willChange: 'transform',
        top: 0,
      }}
    >
      {/* Trail effect */}
      <div
        className="absolute w-full h-24 -top-20 rounded-full opacity-60"
        style={{
          background: `linear-gradient(to bottom, transparent 0%, ${config.color}40 50%, ${config.color}80 100%)`,
          filter: 'blur(8px)',
        }}
      />
      
      {/* Approach ring */}
      <div
        className="absolute w-full h-full rounded-full animate-pulse"
        style={{
          border: `2px solid ${config.color}${Math.round(glowIntensity * 80).toString(16).padStart(2, '0')}`,
          transform: `scale(${1.3 - glowIntensity * 0.2})`,
          opacity: glowIntensity * 0.6,
        }}
      />
      
      {/* Main orb */}
      <div
        className="w-full h-full rounded-full flex items-center justify-center animate-stellar-orb-pulse"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${config.color}, ${config.color}88)`,
          boxShadow: `
            0 0 ${20 + glowIntensity * 20}px ${config.color}${Math.round(128 + glowIntensity * 80).toString(16)},
            0 0 ${40 + glowIntensity * 30}px ${config.color}60,
            inset 0 0 20px ${config.color}40
          `,
          border: `3px solid ${config.color}`,
        }}
      >
        <Icon className="w-9 h-9 text-white drop-shadow-lg" />
      </div>
    </div>
  );
});
NoteOrb.displayName = 'NoteOrb';

// IMPROVED: Enhanced hit feedback with particles and animations
const HitEffectEnhanced = memo(({ lane, result, id }: { lane: LaneType; result: HitResult; id: number }) => {
  const laneIndex = LANE_INDICES[lane];
  const config = HIT_RESULTS[result];
  const laneConfig = LANE_CONFIG[lane];
  
  // Generate burst particles
  const particles = useMemo(() => 
    Array.from({ length: config.particles }).map((_, i) => ({
      id: i,
      angle: (360 / config.particles) * i + Math.random() * 30,
      distance: 40 + Math.random() * 40,
      size: 4 + Math.random() * 6,
      delay: Math.random() * 0.1,
    })),
  [config.particles]);
  
  return (
    <div
      className="absolute flex flex-col items-center pointer-events-none"
      style={{
        left: `calc(${(laneIndex + 0.5) * 33.33}%)`,
        top: `${HIT_ZONE_Y}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Particle burst */}
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute rounded-full animate-stellar-particle-burst"
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            background: result === 'perfect' 
              ? `radial-gradient(circle, hsl(45, 100%, 80%), ${config.color})`
              : config.color,
            boxShadow: `0 0 ${particle.size * 2}px ${config.color}`,
            '--particle-angle': `${particle.angle}deg`,
            '--particle-distance': `${particle.distance}px`,
            animationDelay: `${particle.delay}s`,
          } as React.CSSProperties}
        />
      ))}
      
      {/* Ring burst effect */}
      <div
        className="absolute w-16 h-16 rounded-full animate-stellar-ring-burst"
        style={{
          border: `3px solid ${config.color}`,
          boxShadow: `0 0 20px ${config.color}`,
        }}
      />
      
      {/* Hit text */}
      <div className="animate-stellar-hit-text">
        <span
          className="text-2xl font-black whitespace-nowrap"
          style={{ 
            color: config.color, 
            textShadow: `0 0 20px ${config.color}, 0 0 40px ${config.color}80`,
            letterSpacing: '0.05em',
          }}
        >
          {config.label}
        </span>
      </div>
      
      {/* Perfect flash */}
      {result === 'perfect' && (
        <div className="absolute inset-0 w-32 h-32 -translate-x-1/2 -translate-y-1/2 animate-stellar-perfect-flash rounded-full"
          style={{
            background: `radial-gradient(circle, ${config.color}60, transparent 70%)`,
          }}
        />
      )}
    </div>
  );
});
HitEffectEnhanced.displayName = 'HitEffectEnhanced';

// IMPROVED: Larger, more responsive lane buttons
const LaneButton = memo(({ 
  lane, 
  laneIndex, 
  onTap, 
  isPressed,
  hasApproachingNote,
}: { 
  lane: LaneType; 
  laneIndex: number; 
  onTap: () => void;
  isPressed: boolean;
  hasApproachingNote: boolean;
}) => {
  const config = LANE_CONFIG[lane];
  const Icon = config.icon;
  const touchIdRef = useRef<number | null>(null);
  
  // IMPROVED: Unified pointer handler - immediate response
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only respond to primary pointer
    if (touchIdRef.current !== null) return;
    touchIdRef.current = e.pointerId;
    
    // Immediate haptic feedback
    triggerHaptic('light');
    onTap();
  }, [onTap]);
  
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerId === touchIdRef.current) {
      touchIdRef.current = null;
    }
  }, []);
  
  const handlePointerCancel = useCallback(() => {
    touchIdRef.current = null;
  }, []);
  
  return (
    <button
      className="flex-1 h-full flex items-center justify-center relative overflow-hidden select-none"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        background: isPressed 
          ? `linear-gradient(to top, ${config.color}70, ${config.color}20)` 
          : hasApproachingNote
            ? `linear-gradient(to top, ${config.color}30, transparent)`
            : 'transparent',
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      {/* Glow effect when note approaching */}
      {hasApproachingNote && !isPressed && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{
            background: `radial-gradient(ellipse at center bottom, ${config.color}30, transparent 70%)`,
          }}
        />
      )}
      
      {/* Main button circle - LARGER */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center transition-all duration-75"
        style={{
          background: isPressed 
            ? `radial-gradient(circle, ${config.color}, ${config.color}80)`
            : `radial-gradient(circle, ${config.color}40, ${config.color}15)`,
          border: `4px solid ${config.color}${isPressed ? '' : '80'}`,
          boxShadow: isPressed 
            ? `0 0 40px ${config.color}, inset 0 0 30px ${config.color}60, 0 0 60px ${config.color}40` 
            : hasApproachingNote
              ? `0 0 20px ${config.color}60`
              : `0 0 10px ${config.color}30`,
          transform: isPressed ? 'scale(0.9)' : 'scale(1)',
        }}
      >
        <Icon 
          className="w-10 h-10 transition-all pointer-events-none" 
          style={{ 
            color: isPressed ? 'white' : config.color,
            filter: isPressed ? `drop-shadow(0 0 15px white)` : 'none',
            transform: isPressed ? 'scale(1.1)' : 'scale(1)',
          }} 
        />
      </div>
      
      {/* Press ripple effect */}
      {isPressed && (
        <div
          className="absolute inset-0 animate-stellar-ripple"
          style={{
            background: `radial-gradient(circle at center, ${config.color}40, transparent 70%)`,
          }}
        />
      )}
    </button>
  );
});
LaneButton.displayName = 'LaneButton';

// Generate BPM-synced notes
const generateSyncedNotes = (
  bpm: number, 
  durationSeconds: number, 
  difficulty: ArcadeDifficulty
): Note[] => {
  const config = DIFFICULTY_CONFIG[difficulty];
  const beatInterval = 60000 / bpm;
  const noteInterval = beatInterval / config.notesPerBeat;
  const notes: Note[] = [];
  
  let time = 2000;
  const endTime = (durationSeconds - 2) * 1000;
  
  while (time < endTime) {
    const patternType = config.patterns[Math.floor(Math.random() * config.patterns.length)];
    
    if (patternType === 'single') {
      const lane = LANES[Math.floor(Math.random() * 3)];
      notes.push({ id: notes.length, lane, spawnTime: time, y: -10, hit: false, missed: false });
    } else if (patternType === 'double') {
      const lanes = [...LANES].sort(() => Math.random() - 0.5).slice(0, 2);
      lanes.forEach(lane => {
        notes.push({ id: notes.length, lane, spawnTime: time, y: -10, hit: false, missed: false });
      });
    } else if (patternType === 'triple') {
      LANES.forEach(lane => {
        notes.push({ id: notes.length, lane, spawnTime: time, y: -10, hit: false, missed: false });
      });
    }
    
    time += noteInterval;
  }
  
  return notes;
};

const generateFallbackNotes = (difficulty: ArcadeDifficulty): Note[] => {
  return generateSyncedNotes(120, 30, difficulty);
};

// Loading screen component
const TrackLoadingScreen = memo(({ isGenerating }: { isGenerating?: boolean }) => (
  <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
    <div className="relative">
      <div className="animate-spin">
        <Music className="w-16 h-16 text-primary" />
      </div>
      <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-pulse" />
    </div>
    <p className="text-lg font-medium text-foreground">
      {isGenerating ? 'Generating music...' : 'Loading music...'}
    </p>
    <p className="text-sm text-muted-foreground">
      {isGenerating ? 'Creating AI-powered rhythm track' : 'Preparing your rhythm experience'}
    </p>
  </div>
));
TrackLoadingScreen.displayName = 'TrackLoadingScreen';

// Screen flash effect component
const ScreenFlash = memo(({ color, visible }: { color: string; visible: boolean }) => {
  if (!visible) return null;
  return (
    <div
      className="absolute inset-0 pointer-events-none z-50 animate-stellar-screen-flash"
      style={{
        background: `radial-gradient(circle at center, ${color}40, transparent 70%)`,
      }}
    />
  );
});
ScreenFlash.displayName = 'ScreenFlash';

export const EclipseTimingGame = ({
  companionStats,
  onComplete,
  onDamage,
  tierAttackDamage = 15,
  difficulty = 'medium',
  questIntervalScale = 0,
  maxTimer,
  isPractice = false,
}: EclipseTimingGameProps) => {
  const [gameState, setGameState] = useState<'loading' | 'countdown' | 'playing' | 'paused' | 'rating' | 'complete'>('loading');
  const [songsPlayed, setSongsPlayed] = useState(0);
  
  // OPTIMIZED: Batched game stats in single state
  const [gameStats, setGameStats] = useState<GameStats>(initialGameStats);
  
  // OPTIMIZED: Visible notes only for rendering
  const [visibleNotes, setVisibleNotes] = useState<Note[]>([]);
  
  const [hitEffects, setHitEffects] = useState<{ id: number; lane: LaneType; result: HitResult }[]>([]);
  const [pressedLanes, setPressedLanes] = useState<Record<LaneType, boolean>>({ moon: false, star: false, sun: false });
  const [gameResult, setGameResult] = useState<MiniGameResult | null>(null);
  const [beatPulse, setBeatPulse] = useState(false);
  const [screenFlash, setScreenFlash] = useState<{ visible: boolean; color: string }>({ visible: false, color: '' });
  
  const maxMisses = MAX_MISSES_BY_DIFFICULTY[difficulty];
  
  const gameStartTimeRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const lastRenderTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();
  const beatIntervalRef = useRef<NodeJS.Timeout>();
  
  // OPTIMIZED: Use ref for all notes, only sync visible ones to state
  const notesRef = useRef<Note[]>([]);
  const gameStatsRef = useRef<GameStats>(initialGameStats);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<RhythmTrack | null>(null);
  const loadingStartRef = useRef<number>(0);
  
  const stars = useStaticStars(30); // More stars
  const config = DIFFICULTY_CONFIG[difficulty];
  
  const { track, isLoading, isGenerating, error, userRating, fetchRandomTrack, rateTrack } = useRhythmTrack();

  // Stop encounter music when Stellar Beats starts
  useEffect(() => {
    stopEncounterMusic();
  }, []);

  // Beat pulse effect synced to BPM
  useEffect(() => {
    if (gameState === 'playing' && currentTrackRef.current) {
      const bpm = currentTrackRef.current.bpm;
      const beatMs = 60000 / bpm;
      
      beatIntervalRef.current = setInterval(() => {
        setBeatPulse(true);
        setTimeout(() => setBeatPulse(false), 100);
      }, beatMs);
      
      return () => {
        if (beatIntervalRef.current) {
          clearInterval(beatIntervalRef.current);
        }
      };
    }
  }, [gameState]);

  // Load track and initialize notes
  useEffect(() => {
    const initGame = async () => {
      loadingStartRef.current = Date.now();
      const loadedTrack = await fetchRandomTrack(difficulty);
      
      const transitionToCountdown = () => {
        const loadingDuration = Date.now() - loadingStartRef.current;
        const remainingTime = Math.max(0, MIN_LOADING_TIME_MS - loadingDuration);
        setTimeout(() => {
          setGameState('countdown');
        }, remainingTime + READY_BUFFER_MS);
      };
      
      if (loadedTrack) {
        currentTrackRef.current = loadedTrack;
        const syncedNotes = generateSyncedNotes(loadedTrack.bpm, loadedTrack.duration_seconds, difficulty);
        notesRef.current = syncedNotes;
        
        const audio = new Audio(loadedTrack.audio_url);
        audio.preload = 'auto';
        audioRef.current = audio;
        
        audio.addEventListener('canplaythrough', () => {
          transitionToCountdown();
        }, { once: true });
        
        audio.addEventListener('error', (e) => {
          console.error('Audio load error:', e);
          const fallbackNotes = generateFallbackNotes(difficulty);
          notesRef.current = fallbackNotes;
          transitionToCountdown();
        });
        
        audio.load();
      } else {
        console.log('No track available, using fallback notes');
        const fallbackNotes = generateFallbackNotes(difficulty);
        notesRef.current = fallbackNotes;
        transitionToCountdown();
      }
    };
    
    initGame();
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [difficulty, fetchRandomTrack]);

  // Handle countdown complete
  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
    gameStartTimeRef.current = performance.now();
    lastFrameTimeRef.current = performance.now();
    lastRenderTimeRef.current = performance.now();
    
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.error('Audio playback error:', err);
      });
    }
  }, []);

  // OPTIMIZED: High-performance game loop with ref-based updates
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const gameLoop = (currentTime: number) => {
      const gameTime = currentTime - gameStartTimeRef.current;
      const stats = gameStatsRef.current;
      let statsChanged = false;
      let missedThisFrame: Note[] = [];
      
      // Update note positions directly in ref (no state update)
      notesRef.current = notesRef.current.map(note => {
        if (note.hit || note.missed) return note;
        
        const timeSinceSpawn = gameTime - note.spawnTime;
        if (timeSinceSpawn < 0) return note;
        
        const newY = timeSinceSpawn * config.scrollSpeed;
        
        // Check for missed notes
        if (newY > HIT_ZONE_Y + TIMING_WINDOWS.good + 5 && !note.hit && !note.missed) {
          missedThisFrame.push(note);
          return { ...note, y: newY, missed: true };
        }
        
        return { ...note, y: newY };
      });
      
      // Batch process misses
      if (missedThisFrame.length > 0) {
        const newMissCount = stats.notesMissed + missedThisFrame.length;
        gameStatsRef.current = {
          ...stats,
          notesMissed: newMissCount,
          combo: 0,
        };
        statsChanged = true;
        
        // Check if player exceeded max misses - instant loss
        if (newMissCount >= maxMisses) {
          if (audioRef.current) {
            audioRef.current.pause();
          }
          
          // Deal massive damage to player (instant loss)
          onDamage?.({ target: 'player', amount: GAME_DAMAGE_VALUES.eclipse_timing.tooManyMisses, source: 'too_many_misses' });
          
          const totalNotes = notesRef.current.length;
          const finalStats = gameStatsRef.current;
          const accuracy = totalNotes > 0 ? Math.round((finalStats.notesHit / totalNotes) * 100) : 0;
          
          setGameResult({
            success: false,
            accuracy,
            result: 'fail',
            highScoreValue: finalStats.score,
            gameStats: {
              score: finalStats.score,
              maxCombo: finalStats.maxCombo,
              notesHit: finalStats.notesHit,
              misses: finalStats.notesMissed,
            },
          });
          setGameStats({ ...finalStats });
          setGameState('complete');
          return;
        }
      }
      
      // OPTIMIZED: Throttle state sync to ~60fps for rendering
      const shouldSyncRender = currentTime - lastRenderTimeRef.current >= RENDER_THROTTLE_MS;
      
      if (shouldSyncRender) {
        lastRenderTimeRef.current = currentTime;
        
        // Only sync visible notes to state (massive render optimization)
        const visible = notesRef.current.filter(note => 
          !note.hit && !note.missed && note.y >= -15 && note.y <= 105
        );
        setVisibleNotes(visible);
        
        // Sync stats to state for UI
        if (statsChanged || missedThisFrame.length > 0) {
          setGameStats({ ...gameStatsRef.current });
        }
      }
      
      // Check if game is complete (song finished)
      const allNotesProcessed = notesRef.current.every(n => n.hit || n.missed || n.y > 100);
      if (allNotesProcessed && notesRef.current.length > 0) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        
        const totalNotes = notesRef.current.length;
        const finalStats = gameStatsRef.current;
        const accuracy = totalNotes > 0 ? Math.round((finalStats.notesHit / totalNotes) * 100) : 0;
        
        // Song completed = WIN! Deal massive damage to adversary
        onDamage?.({ target: 'adversary', amount: GAME_DAMAGE_VALUES.eclipse_timing.songComplete, source: 'song_complete' });
        
        const result = accuracy >= 90 ? 'perfect' : 'good'; // Binary win - completed song = success
        
        setGameResult({
          success: true,
          accuracy,
          result,
          highScoreValue: finalStats.score,
          gameStats: {
            score: finalStats.score,
            maxCombo: finalStats.maxCombo,
            notesHit: finalStats.notesHit,
            misses: finalStats.notesMissed,
          },
        });
        
        // Sync final stats
        setGameStats({ ...finalStats });
        
        if (currentTrackRef.current && !isPractice) {
          setGameState('rating');
        } else {
          setGameState('complete');
        }
        return;
      }
      
      lastFrameTimeRef.current = currentTime;
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };
    
    animationFrameRef.current = requestAnimationFrame(gameLoop);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState, config.scrollSpeed, isPractice, onDamage, maxMisses]);

  // IMPROVED: More responsive hit handler with better press feedback
  const handleLaneTap = useCallback((lane: LaneType) => {
    if (gameState !== 'playing') return;
    
    // Longer press visual feedback (150ms instead of 100ms)
    setPressedLanes(prev => ({ ...prev, [lane]: true }));
    setTimeout(() => setPressedLanes(prev => ({ ...prev, [lane]: false })), 150);
    
    const laneNotes = notesRef.current.filter(n => n.lane === lane && !n.hit && !n.missed);
    if (laneNotes.length === 0) return;
    
    const closestNote = laneNotes.reduce((closest, note) => {
      const distToHitZone = Math.abs(note.y - HIT_ZONE_Y);
      const closestDist = Math.abs(closest.y - HIT_ZONE_Y);
      return distToHitZone < closestDist ? note : closest;
    });
    
    const distance = Math.abs(closestNote.y - HIT_ZONE_Y);
    
    let result: HitResult;
    if (distance <= TIMING_WINDOWS.perfect) {
      result = 'perfect';
    } else if (distance <= TIMING_WINDOWS.great) {
      result = 'great';
    } else if (distance <= TIMING_WINDOWS.good) {
      result = 'good';
    } else {
      return;
    }
    
    // Update ref immediately
    notesRef.current = notesRef.current.map(n => n.id === closestNote.id ? { ...n, hit: true } : n);
    
    // Screen flash on perfect hits
    if (result === 'perfect') {
      setScreenFlash({ visible: true, color: HIT_RESULTS.perfect.color });
      setTimeout(() => setScreenFlash({ visible: false, color: '' }), 150);
    }
    
    // OPTIMIZED: Single batched state update
    const currentStats = gameStatsRef.current;
    const multiplier = getComboMultiplier(currentStats.combo);
    const points = HIT_RESULTS[result].points * multiplier;
    const newCombo = currentStats.combo + 1;
    
    const newStats: GameStats = {
      score: currentStats.score + points,
      combo: newCombo,
      maxCombo: Math.max(currentStats.maxCombo, newCombo),
      notesHit: currentStats.notesHit + 1,
      notesMissed: currentStats.notesMissed,
    };
    
    gameStatsRef.current = newStats;
    setGameStats(newStats);
    
    // OPTIMIZED: Limit concurrent effects - longer display (700ms)
    const effectId = Date.now() + Math.random();
    setHitEffects(prev => [...prev.slice(-(MAX_HIT_EFFECTS - 1)), { id: effectId, lane, result }]);
    setTimeout(() => {
      setHitEffects(prev => prev.filter(e => e.id !== effectId));
    }, 700);
    
    // Immediate haptic feedback
    triggerHaptic(result === 'perfect' ? 'success' : result === 'great' ? 'medium' : 'light');
  }, [gameState]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      
      if (e.key === 'a' || e.key === 'ArrowLeft') handleLaneTap('moon');
      else if (e.key === 's' || e.key === 'ArrowDown') handleLaneTap('star');
      else if (e.key === 'd' || e.key === 'ArrowRight') handleLaneTap('sun');
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, handleLaneTap]);

  // Handle rating
  const handleRate = useCallback(async (rating: 'up' | 'down') => {
    if (currentTrackRef.current) {
      await rateTrack(currentTrackRef.current.id, rating);
    }
  }, [rateTrack]);

  // Load next song
  const loadNextSong = useCallback(async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    // Reset all state
    gameStatsRef.current = initialGameStats;
    setGameStats(initialGameStats);
    setVisibleNotes([]);
    setHitEffects([]);
    setGameResult(null);
    setSongsPlayed(prev => prev + 1);
    setGameState('loading');
    loadingStartRef.current = Date.now();
    
    const transitionToCountdown = () => {
      const loadingDuration = Date.now() - loadingStartRef.current;
      const remainingTime = Math.max(0, MIN_LOADING_TIME_MS - loadingDuration);
      setTimeout(() => {
        setGameState('countdown');
      }, remainingTime + READY_BUFFER_MS);
    };
    
    const loadedTrack = await fetchRandomTrack(difficulty);
    
    if (loadedTrack) {
      currentTrackRef.current = loadedTrack;
      const syncedNotes = generateSyncedNotes(loadedTrack.bpm, loadedTrack.duration_seconds, difficulty);
      notesRef.current = syncedNotes;
      
      const audio = new Audio(loadedTrack.audio_url);
      audio.preload = 'auto';
      audioRef.current = audio;
      
      audio.addEventListener('canplaythrough', () => {
        transitionToCountdown();
      }, { once: true });
      
      audio.addEventListener('error', () => {
        const fallbackNotes = generateFallbackNotes(difficulty);
        notesRef.current = fallbackNotes;
        transitionToCountdown();
      });
      
      audio.load();
    } else {
      const fallbackNotes = generateFallbackNotes(difficulty);
      notesRef.current = fallbackNotes;
      currentTrackRef.current = null;
      transitionToCountdown();
    }
  }, [difficulty, fetchRandomTrack]);

  const handleFinish = useCallback(() => {
    setGameState('complete');
  }, []);

  // Complete game
  useEffect(() => {
    if (gameState === 'complete' && gameResult) {
      setTimeout(() => {
        onComplete(gameResult);
      }, 300);
    }
  }, [gameState, gameResult, onComplete]);

  // Pause/resume audio with game state
  useEffect(() => {
    if (audioRef.current) {
      if (gameState === 'paused') {
        audioRef.current.pause();
      } else if (gameState === 'playing') {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [gameState]);

  // Check for approaching notes per lane (for button glow)
  const approachingLanes = useMemo(() => {
    const approaching: Record<LaneType, boolean> = { moon: false, star: false, sun: false };
    visibleNotes.forEach(note => {
      if (note.y > HIT_ZONE_Y - 25 && note.y < HIT_ZONE_Y + 10) {
        approaching[note.lane] = true;
      }
    });
    return approaching;
  }, [visibleNotes]);

  const { score, combo, notesHit, notesMissed } = gameStats;
  const comboMultiplier = getComboMultiplier(combo);
  const totalNotes = notesRef.current.length;
  const processedNotes = notesHit + notesMissed;

  // Loading state
  if (gameState === 'loading') {
    return (
      <div 
        className="flex flex-col items-center relative w-full h-full min-h-[500px] overflow-hidden"
        style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
      >
        <TrackLoadingScreen isGenerating={isGenerating} />
      </div>
    );
  }

  // Rating state
  if (gameState === 'rating') {
    return (
      <div 
        className="flex flex-col items-center justify-center relative w-full h-full min-h-[500px] gap-6 p-4 overflow-hidden"
        style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
      >
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-foreground mb-2">Song Complete!</h2>
          <p className="text-lg text-muted-foreground">
            Score: <span className="text-primary font-bold">{score}</span> • 
            Accuracy: <span className="text-primary font-bold">{gameResult?.accuracy}%</span>
          </p>
          {songsPlayed > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              Songs played: {songsPlayed + 1}
            </p>
          )}
        </div>
        
        {currentTrackRef.current && (
          <TrackRatingUI
            trackName={currentTrackRef.current.genre}
            onRate={handleRate}
            onSkip={() => {}}
            currentRating={userRating}
          />
        )}
        
        <div className="flex gap-4 mt-4">
          <button
            onClick={loadNextSong}
            className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
          >
            Next Song →
          </button>
          <button
            onClick={handleFinish}
            className="px-6 py-3 rounded-lg bg-secondary text-secondary-foreground font-semibold hover:bg-secondary/90 transition-colors"
          >
            Finish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col items-center relative w-full h-full min-h-[500px] overflow-hidden gpu-layer"
      style={{ 
        touchAction: 'none', 
        overscrollBehavior: 'contain',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
      }}
    >
      {/* Screen flash effect */}
      <ScreenFlash color={screenFlash.color} visible={screenFlash.visible} />
      
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
        title="Stellar Beats"
        subtitle={`${processedNotes}/${totalNotes} notes${currentTrackRef.current ? ` • ${currentTrackRef.current.bpm} BPM` : ''}`}
        score={score}
        maxScore={totalNotes * 100 * 4}
        combo={combo}
        showCombo={true}
        primaryStat={{ value: notesMissed, label: `Misses (max ${maxMisses})`, color: notesMissed >= maxMisses - 2 ? 'hsl(0, 84%, 60%)' : 'hsl(45, 100%, 60%)' }}
        isPaused={gameState === 'paused'}
        onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      />
      
      {/* Warning when approaching miss limit */}
      <AnimatePresence>
        {notesMissed >= maxMisses - 2 && notesMissed < maxMisses && gameState === 'playing' && (
          <motion.div
            className="absolute top-20 right-4 z-30 px-3 py-1 rounded-full text-sm font-bold"
            style={{
              background: 'linear-gradient(135deg, hsl(0, 70%, 50%), hsl(0, 84%, 40%))',
              color: 'white',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [1, 1.1, 1], opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 0.5 }}
          >
            ⚠️ {maxMisses - notesMissed} MISS{maxMisses - notesMissed > 1 ? 'ES' : ''} LEFT!
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Combo multiplier indicator */}
      <AnimatePresence>
        {combo >= 10 && (
          <motion.div
            className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full text-base font-bold"
            style={{
              background: 'linear-gradient(135deg, hsl(45, 100%, 50%), hsl(25, 95%, 50%))',
              color: 'white',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              boxShadow: '0 0 20px hsl(45, 100%, 50% / 0.5)',
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [1, 1.05, 1], opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            🔥 {comboMultiplier}x MULTIPLIER
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game arena - GPU accelerated */}
      <div 
        className="relative w-full rounded-xl overflow-hidden gpu-layer"
        style={{
          background: `linear-gradient(to bottom, 
            hsl(240, 30%, 6%), 
            hsl(260, 35%, 10%), 
            hsl(270, 40%, 12%)
          )`,
          height: 'calc(100% - 100px)',
          minHeight: '350px',
          touchAction: 'none',
          transform: 'translateZ(0)',
          willChange: 'contents',
        }}
      >
        <AnimatedStarBackground stars={stars} beatPulse={beatPulse} />
        
        {/* Lane dividers - more visible */}
        <div className="absolute inset-0 flex pointer-events-none">
          {LANES.map((lane, i) => (
            <div
              key={lane}
              className="flex-1 border-r last:border-r-0"
              style={{ borderColor: 'hsl(var(--border) / 0.35)' }}
            />
          ))}
        </div>
        
        {/* Lane glow trails - enhanced */}
        <div className="absolute inset-0 flex pointer-events-none">
          {LANES.map((lane, i) => {
            const laneConfig = LANE_CONFIG[lane];
            const hasApproaching = approachingLanes[lane];
            return (
              <div
                key={lane}
                className="flex-1 transition-all duration-200"
                style={{
                  background: `linear-gradient(to bottom, 
                    transparent 0%, 
                    ${laneConfig.color}${hasApproaching ? '15' : '08'} 40%, 
                    ${laneConfig.color}${hasApproaching ? '25' : '12'} 70%,
                    ${laneConfig.color}${hasApproaching ? '35' : '18'} 100%
                  )`,
                }}
              />
            );
          })}
        </div>

        {/* IMPROVED: Enhanced hit zone line - thicker and animated */}
        <div
          className="absolute left-0 right-0 pointer-events-none z-10"
          style={{
            top: `${HIT_ZONE_Y}%`,
            height: '3px',
            background: 'linear-gradient(90deg, hsl(271, 91%, 65%), hsl(45, 100%, 60%), hsl(25, 95%, 55%))',
            boxShadow: `
              0 0 20px hsl(271, 91%, 65% / 0.6), 
              0 0 40px hsl(45, 100%, 60% / 0.4),
              0 -5px 20px hsl(45, 100%, 60% / 0.2),
              0 5px 20px hsl(45, 100%, 60% / 0.2)
            `,
          }}
        />
        
        {/* Hit zone target circles */}
        <div className="absolute left-0 right-0 flex justify-around pointer-events-none z-5" style={{ top: `${HIT_ZONE_Y}%`, transform: 'translateY(-50%)' }}>
          {LANES.map(lane => {
            const laneConfig = LANE_CONFIG[lane];
            return (
              <div
                key={lane}
                className="w-20 h-20 rounded-full border-2 animate-pulse"
                style={{
                  borderColor: `${laneConfig.color}40`,
                  boxShadow: `inset 0 0 20px ${laneConfig.color}20`,
                }}
              />
            );
          })}
        </div>
        
        {/* Hit zone glow area - more prominent */}
        <div
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            top: `${HIT_ZONE_Y - 8}%`,
            height: '16%',
            background: `linear-gradient(to bottom, 
              transparent, 
              hsl(var(--primary) / 0.15), 
              hsl(var(--primary) / 0.1),
              transparent
            )`,
          }}
        />

        {/* Lane icons at top - slightly larger */}
        <div className="absolute top-4 left-0 right-0 flex justify-around pointer-events-none z-20">
          {LANES.map(lane => {
            const laneConfig = LANE_CONFIG[lane];
            const Icon = laneConfig.icon;
            return (
              <div key={lane} className="flex flex-col items-center">
                <div 
                  className="p-2 rounded-full"
                  style={{
                    background: `${laneConfig.color}20`,
                    boxShadow: `0 0 15px ${laneConfig.color}30`,
                  }}
                >
                  <Icon className="w-7 h-7" style={{ color: laneConfig.color, opacity: 0.8 }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* OPTIMIZED: Only render visible notes with approach calculation */}
        {visibleNotes.map(note => {
          const approachPercent = Math.max(0, Math.min(1, (note.y - 20) / (HIT_ZONE_Y - 20)));
          return (
            <NoteOrb 
              key={note.id} 
              note={note} 
              laneIndex={LANE_INDICES[note.lane]} 
              approachPercent={approachPercent}
            />
          );
        })}

        {/* IMPROVED: Enhanced hit effects with particles */}
        {hitEffects.map(effect => (
          <HitEffectEnhanced key={effect.id} id={effect.id} lane={effect.lane} result={effect.result} />
        ))}

        {/* Tap buttons at bottom - increased height */}
        <div 
          className="absolute bottom-0 left-0 right-0 flex"
          style={{ height: '18%' }}
        >
          {LANES.map((lane, i) => (
            <LaneButton
              key={lane}
              lane={lane}
              laneIndex={i}
              onTap={() => handleLaneTap(lane)}
              isPressed={pressedLanes[lane]}
              hasApproachingNote={approachingLanes[lane]}
            />
          ))}
        </div>
      </div>

      {/* Instructions */}
      {gameState === 'playing' && (
        <div className="text-center py-2 text-xs text-muted-foreground">
          Tap lanes when notes reach the line • Keys: A/S/D or ←/↓/→
        </div>
      )}
    </div>
  );
};
