import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic, useStaticStars } from './gameUtils';
import { TrackRatingUI } from './TrackRatingUI';
import { useRhythmTrack, RhythmTrack } from '@/hooks/useRhythmTrack';
import { Moon, Star, Sun, Music, Sparkles } from 'lucide-react';

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
  compact?: boolean;
}

type LaneType = 'moon' | 'star' | 'sun';

interface Note {
  id: number;
  lane: LaneType;
  spawnTime: number; // ms since game start when note should spawn
  expectedHitTime: number; // ms since game start when note should be hit
  y: number;
  hit: boolean;
  missed: boolean;
}

type HitResult = 'perfect' | 'great' | 'good' | 'miss';

const LANE_INDICES: Record<LaneType, number> = { moon: 0, star: 1, sun: 2 };

// Travel time for notes to go from top to hit zone (ms)
const NOTE_TRAVEL_TIME_MS = 1500;

const DIFFICULTY_CONFIG = {
  beginner: { notesPerBeat: 0.25, patterns: ['single'] as const },
  easy: { notesPerBeat: 0.5, patterns: ['single'] as const },
  medium: { notesPerBeat: 1, patterns: ['single', 'double'] as const },
  hard: { notesPerBeat: 2, patterns: ['single', 'double', 'triple'] as const },
  master: { notesPerBeat: 3, patterns: ['single', 'double', 'triple'] as const },
};

// TIME-BASED timing windows (ms) - much more reliable than position
const TIMING_WINDOWS_MS = { 
  perfect: 60,   // ±60ms window
  great: 120,    // ±120ms window  
  good: 180      // ±180ms window
};

// Audio latency compensation - adjust if taps feel early/late
const AUDIO_LATENCY_OFFSET_MS = 30;

const MAX_MISSES_BY_DIFFICULTY: Record<ArcadeDifficulty, number> = {
  beginner: 12, easy: 10, medium: 8, hard: 5, master: 3,
};

// Hit zone at 85% - closer to the tap buttons for better visual-tactile connection
const HIT_ZONE_Y = 85;
const MAX_HIT_EFFECTS = 4;
const RENDER_THROTTLE_MS = 16; // 60fps for smooth highway effect

const HIT_RESULTS: Record<HitResult, { label: string; points: number; color: string }> = {
  perfect: { label: 'PERFECT!', points: 100, color: 'hsl(45, 100%, 60%)' },
  great: { label: 'GREAT!', points: 75, color: 'hsl(271, 91%, 65%)' },
  good: { label: 'GOOD', points: 50, color: 'hsl(142, 71%, 45%)' },
  miss: { label: 'MISS', points: 0, color: 'hsl(0, 84%, 60%)' },
};

const LANE_CONFIG: Record<LaneType, { icon: typeof Moon; color: string; glowColor: string }> = {
  moon: { icon: Moon, color: 'hsl(271, 91%, 65%)', glowColor: 'hsl(271, 91%, 75%)' },
  star: { icon: Star, color: 'hsl(45, 100%, 60%)', glowColor: 'hsl(45, 100%, 70%)' },
  sun: { icon: Sun, color: 'hsl(25, 95%, 55%)', glowColor: 'hsl(25, 95%, 65%)' },
};

const LANES: LaneType[] = ['moon', 'star', 'sun'];
const MIN_LOADING_TIME_MS = 1500;
const READY_BUFFER_MS = 500;

const getComboMultiplier = (combo: number): number => {
  if (combo >= 50) return 4;
  if (combo >= 25) return 3;
  if (combo >= 10) return 2;
  return 1;
};

interface GameStats {
  score: number;
  combo: number;
  maxCombo: number;
  notesHit: number;
  notesMissed: number;
}

const initialGameStats: GameStats = {
  score: 0, combo: 0, maxCombo: 0, notesHit: 0, notesMissed: 0,
};

// Static star background - highway style
const StaticStarBackground = memo(({ stars }: { stars: ReturnType<typeof useStaticStars> }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {stars.map((star, i) => (
      <div
        key={star.id}
        className="absolute rounded-full"
        style={{ 
          left: `${star.x}%`, 
          top: `${star.y}%`,
          width: `${i % 3 === 0 ? 3 : 2}px`,
          height: `${i % 3 === 0 ? 3 : 2}px`,
          background: i % 5 === 0 
            ? 'hsl(45, 100%, 80%)'
            : 'hsl(210, 100%, 90%)',
          boxShadow: `0 0 ${2 + (i % 3)}px rgba(255,255,255,0.4)`,
          opacity: 0.4 + (i % 4) * 0.08,
        }}
      />
    ))}
    {/* Cosmic nebula backdrop */}
    <div 
      className="absolute inset-0 opacity-25"
      style={{
        background: 'radial-gradient(ellipse at 20% 20%, hsl(271, 50%, 25%) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, hsl(45, 50%, 15%) 0%, transparent 50%)',
      }}
    />
  </div>
));
StaticStarBackground.displayName = 'StaticStarBackground';

// Guitar Hero style BAR NOTE with glowing trail
const NoteBar = memo(({ note, laneIndex, gameTimeMs }: { note: Note; laneIndex: number; gameTimeMs: number }) => {
  const config = LANE_CONFIG[note.lane];
  
  // Calculate how close to hit zone (for glow intensity)
  const timeToHit = note.expectedHitTime - gameTimeMs;
  const proximityFactor = Math.max(0, Math.min(1, 1 - (timeToHit / NOTE_TRAVEL_TIME_MS)));
  const glowIntensity = 0.4 + proximityFactor * 0.6;
  
  // Trail length based on proximity - longer as it approaches
  const trailLength = 30 + proximityFactor * 50;
  
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `calc(${(laneIndex + 0.5) * 33.33}% - 45px)`,
        top: `${note.y}%`,
        transform: 'translateY(-50%) translateZ(0)',
        willChange: 'transform',
        zIndex: 15,
      }}
    >
      {/* Glowing trail effect */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          width: '60px',
          height: `${trailLength}px`,
          bottom: '100%',
          background: `linear-gradient(to bottom, transparent 0%, ${config.color}40 50%, ${config.color}80 100%)`,
          filter: `blur(${4 + proximityFactor * 4}px)`,
          opacity: glowIntensity * 0.7,
        }}
      />
      
      {/* Main bar note - horizontal rectangle */}
      <div
        style={{
          width: '90px',
          height: '18px',
          borderRadius: '9px',
          background: `linear-gradient(180deg, ${config.glowColor} 0%, ${config.color} 50%, ${config.color}cc 100%)`,
          boxShadow: `
            0 0 ${10 + proximityFactor * 15}px ${config.color}${Math.round(glowIntensity * 99).toString(16).padStart(2, '0')},
            0 0 ${20 + proximityFactor * 20}px ${config.color}60,
            inset 0 2px 4px rgba(255,255,255,0.4),
            inset 0 -2px 4px rgba(0,0,0,0.3)
          `,
          border: `2px solid ${config.glowColor}`,
          transform: `scaleY(${1 + proximityFactor * 0.2})`,
          transition: 'transform 0.05s ease-out',
        }}
      >
        {/* Inner highlight */}
        <div
          className="absolute top-1 left-2 right-2 h-1 rounded-full"
          style={{ background: 'rgba(255,255,255,0.5)' }}
        />
      </div>
    </div>
  );
});
NoteBar.displayName = 'NoteBar';

// Hit effect with flash animation
const HitEffect = memo(({ lane, result }: { lane: LaneType; result: HitResult }) => {
  const laneIndex = LANE_INDICES[lane];
  const config = HIT_RESULTS[result];
  const laneConfig = LANE_CONFIG[lane];
  
  return (
    <div
      className="absolute flex flex-col items-center justify-center pointer-events-none"
      style={{
        left: `calc(${(laneIndex + 0.5) * 33.33}%)`,
        top: `${HIT_ZONE_Y}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Flash ring */}
      <div
        className="absolute animate-ping"
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          border: `3px solid ${result === 'perfect' ? config.color : laneConfig.color}`,
          opacity: 0.6,
        }}
      />
      {/* Result text */}
      <span
        className="text-xl font-black whitespace-nowrap animate-stellar-hit-text"
        style={{ 
          color: config.color, 
          textShadow: `0 0 15px ${config.color}, 0 0 30px ${config.color}80`,
        }}
      >
        {config.label}
      </span>
    </div>
  );
});
HitEffect.displayName = 'HitEffect';

// Enhanced lane button with better touch handling
const LaneButton = memo(({ 
  lane, 
  laneIndex, 
  onTap, 
  isPressed,
  hasApproachingNote,
}: { 
  lane: LaneType; 
  laneIndex: number; 
  onTap: (timestamp: number) => void;
  isPressed: boolean;
  hasApproachingNote: boolean;
}) => {
  const config = LANE_CONFIG[lane];
  const Icon = config.icon;
  const touchActiveRef = useRef<boolean>(false);
  
  // Use touchstart for faster mobile response
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (touchActiveRef.current) return;
    touchActiveRef.current = true;
    
    // Get high-precision timestamp
    const tapTime = performance.now();
    triggerHaptic('light');
    onTap(tapTime);
  }, [onTap]);
  
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    touchActiveRef.current = false;
  }, []);
  
  // Fallback pointer events for desktop
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return; // Let touch events handle it
    e.preventDefault();
    e.stopPropagation();
    
    const tapTime = performance.now();
    triggerHaptic('light');
    onTap(tapTime);
  }, [onTap]);
  
  return (
    <button
      className="flex-1 h-full flex items-center justify-center relative overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        background: isPressed 
          ? `linear-gradient(to top, ${config.color}80, ${config.color}30)` 
          : hasApproachingNote
            ? `linear-gradient(to top, ${config.color}40, transparent)`
            : 'transparent',
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      {/* Hit zone target circle */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center transition-all duration-50"
        style={{
          background: isPressed 
            ? `radial-gradient(circle, ${config.color}, ${config.color}90)`
            : `radial-gradient(circle, ${config.color}50, ${config.color}20)`,
          border: `4px solid ${config.color}${isPressed ? '' : '90'}`,
          boxShadow: isPressed 
            ? `0 0 30px ${config.color}, 0 0 60px ${config.color}60` 
            : hasApproachingNote
              ? `0 0 20px ${config.color}60`
              : `0 0 10px ${config.color}40`,
          transform: isPressed ? 'scale(0.85)' : 'scale(1)',
        }}
      >
        <Icon 
          className="w-8 h-8 pointer-events-none" 
          style={{ color: isPressed ? 'white' : config.color }} 
        />
      </div>
    </button>
  );
});
LaneButton.displayName = 'LaneButton';

// Generate notes with time-based positioning
const generateSyncedNotes = (bpm: number, durationSeconds: number, difficulty: ArcadeDifficulty): Note[] => {
  const config = DIFFICULTY_CONFIG[difficulty];
  const beatInterval = 60000 / bpm;
  const noteInterval = beatInterval / config.notesPerBeat;
  const notes: Note[] = [];
  
  // First note hits at 2 seconds (spawn earlier based on travel time)
  let hitTime = 2000;
  const endTime = (durationSeconds - 2) * 1000;
  
  while (hitTime < endTime) {
    const patternType = config.patterns[Math.floor(Math.random() * config.patterns.length)];
    const spawnTime = hitTime - NOTE_TRAVEL_TIME_MS;
    
    if (patternType === 'single') {
      const lane = LANES[Math.floor(Math.random() * 3)];
      notes.push({ id: notes.length, lane, spawnTime, expectedHitTime: hitTime, y: -10, hit: false, missed: false });
    } else if (patternType === 'double') {
      const lanes = [...LANES].sort(() => Math.random() - 0.5).slice(0, 2);
      lanes.forEach(lane => {
        notes.push({ id: notes.length, lane, spawnTime, expectedHitTime: hitTime, y: -10, hit: false, missed: false });
      });
    } else if (patternType === 'triple') {
      LANES.forEach(lane => {
        notes.push({ id: notes.length, lane, spawnTime, expectedHitTime: hitTime, y: -10, hit: false, missed: false });
      });
    }
    hitTime += noteInterval;
  }
  return notes;
};

const generateFallbackNotes = (difficulty: ArcadeDifficulty): Note[] => {
  return generateSyncedNotes(120, 30, difficulty);
};

const TrackLoadingScreen = memo(({ isGenerating }: { isGenerating?: boolean }) => (
  <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3">
    <div className="relative">
      <div className="animate-spin">
        <Music className="w-12 h-12 text-primary" />
      </div>
      <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-yellow-400 animate-pulse" />
    </div>
    <p className="text-base font-medium text-foreground">
      {isGenerating ? 'Generating music...' : 'Loading music...'}
    </p>
  </div>
));
TrackLoadingScreen.displayName = 'TrackLoadingScreen';

export const EclipseTimingGame = ({
  companionStats,
  onComplete,
  onDamage,
  tierAttackDamage = 15,
  difficulty = 'medium',
  questIntervalScale = 0,
  maxTimer,
  isPractice = false,
  compact = false,
}: EclipseTimingGameProps) => {
  const [gameState, setGameState] = useState<'loading' | 'countdown' | 'playing' | 'paused' | 'rating' | 'complete'>('loading');
  const [songsPlayed, setSongsPlayed] = useState(0);
  const [gameStats, setGameStats] = useState<GameStats>(initialGameStats);
  const [visibleNotes, setVisibleNotes] = useState<Note[]>([]);
  const [hitEffects, setHitEffects] = useState<{ id: number; lane: LaneType; result: HitResult }[]>([]);
  const [pressedLanes, setPressedLanes] = useState<Record<LaneType, boolean>>({ moon: false, star: false, sun: false });
  const [gameResult, setGameResult] = useState<MiniGameResult | null>(null);
  const [showMissWarning, setShowMissWarning] = useState(false);
  const [showComboMultiplier, setShowComboMultiplier] = useState(false);
  const [beatPulse, setBeatPulse] = useState(false);
  const [gameTimeMs, setGameTimeMs] = useState(0);
  
  const maxMisses = MAX_MISSES_BY_DIFFICULTY[difficulty];
  
  const gameStartTimeRef = useRef<number>(0);
  const lastRenderTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();
  const notesRef = useRef<Note[]>([]);
  const gameStatsRef = useRef<GameStats>(initialGameStats);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<RhythmTrack | null>(null);
  const loadingStartRef = useRef<number>(0);
  
  const stars = useStaticStars(20);
  const config = DIFFICULTY_CONFIG[difficulty];
  
  const { track, isLoading, isGenerating, error, userRating, fetchRandomTrack, rateTrack } = useRhythmTrack();

  

  // Load track and initialize notes
  useEffect(() => {
    const initGame = async () => {
      loadingStartRef.current = Date.now();
      const loadedTrack = await fetchRandomTrack(difficulty);
      
      const transitionToCountdown = () => {
        const loadingDuration = Date.now() - loadingStartRef.current;
        const remainingTime = Math.max(0, MIN_LOADING_TIME_MS - loadingDuration);
        setTimeout(() => setGameState('countdown'), remainingTime + READY_BUFFER_MS);
      };
      
      if (loadedTrack) {
        currentTrackRef.current = loadedTrack;
        notesRef.current = generateSyncedNotes(loadedTrack.bpm, loadedTrack.duration_seconds, difficulty);
        
        const audio = new Audio(loadedTrack.audio_url);
        audio.preload = 'auto';
        audioRef.current = audio;
        
        audio.addEventListener('canplaythrough', transitionToCountdown, { once: true });
        audio.addEventListener('error', () => {
          notesRef.current = generateFallbackNotes(difficulty);
          transitionToCountdown();
        });
        audio.load();
      } else {
        notesRef.current = generateFallbackNotes(difficulty);
        transitionToCountdown();
      }
    };
    
    initGame();
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, [difficulty, fetchRandomTrack]);

  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
    gameStartTimeRef.current = performance.now();
    lastRenderTimeRef.current = performance.now();
    
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((e) => {
        if (e.name !== 'NotAllowedError') {
          console.warn('Audio play failed:', e.message);
        }
      });
    }
  }, []);

  // High-performance game loop with time-based positioning
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const missThresholdMs = TIMING_WINDOWS_MS.good + 50; // Miss if 50ms past good window
    
    const gameLoop = (currentTime: number) => {
      const gameTime = currentTime - gameStartTimeRef.current;
      const notes = notesRef.current;
      let missCount = 0;
      
      // Update note positions based on time
      for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        if (note.hit || note.missed) continue;
        
        // Calculate Y position based on time to hit
        const timeToHit = note.expectedHitTime - gameTime;
        const progress = 1 - (timeToHit / NOTE_TRAVEL_TIME_MS);
        
        // Note Y position: -10% at spawn, HIT_ZONE_Y% at hit time
        note.y = -10 + (progress * (HIT_ZONE_Y + 10));
        
        // Check if note was missed (past the hit window)
        if (gameTime > note.expectedHitTime + missThresholdMs) {
          note.missed = true;
          missCount++;
        }
      }
      
      // Handle misses
      if (missCount > 0) {
        const stats = gameStatsRef.current;
        const newMissCount = stats.notesMissed + missCount;
        gameStatsRef.current = { ...stats, notesMissed: newMissCount, combo: 0 };
        
        if (newMissCount >= maxMisses) {
          audioRef.current?.pause();
          onDamage?.({ target: 'player', amount: GAME_DAMAGE_VALUES.eclipse_timing.tooManyMisses, source: 'too_many_misses' });
          
          const totalNotes = notes.length;
          const finalStats = gameStatsRef.current;
          const accuracy = totalNotes > 0 ? Math.round((finalStats.notesHit / totalNotes) * 100) : 0;
          
          setGameResult({
            success: false, accuracy, result: 'fail', highScoreValue: finalStats.score,
            gameStats: { score: finalStats.score, maxCombo: finalStats.maxCombo, notesHit: finalStats.notesHit, misses: finalStats.notesMissed },
          });
          setGameStats({ ...finalStats });
          setGameState('complete');
          return;
        }
      }
      
      // Throttled render sync
      if (currentTime - lastRenderTimeRef.current >= RENDER_THROTTLE_MS) {
        lastRenderTimeRef.current = currentTime;
        
        const visible: Note[] = [];
        for (let i = 0; i < notes.length; i++) {
          const note = notes[i];
          if (!note.hit && !note.missed && note.y >= -15 && note.y <= 100) {
            visible.push({ ...note });
          }
        }
        setVisibleNotes(visible);
        setGameStats({ ...gameStatsRef.current });
        setGameTimeMs(gameTime);
        
        // Update warning/multiplier visibility
        const stats = gameStatsRef.current;
        setShowMissWarning(stats.notesMissed >= maxMisses - 2 && stats.notesMissed < maxMisses);
        setShowComboMultiplier(stats.combo >= 10);
      }
      
      // Check completion
      let allProcessed = true;
      for (let i = 0; i < notes.length; i++) {
        if (!notes[i].hit && !notes[i].missed && notes[i].y <= 100) {
          allProcessed = false;
          break;
        }
      }
      
      if (allProcessed && notes.length > 0) {
        audioRef.current?.pause();
        onDamage?.({ target: 'adversary', amount: GAME_DAMAGE_VALUES.eclipse_timing.songComplete, source: 'song_complete' });
        
        const totalNotes = notes.length;
        const finalStats = gameStatsRef.current;
        const accuracy = totalNotes > 0 ? Math.round((finalStats.notesHit / totalNotes) * 100) : 0;
        
        setGameResult({
          success: true, accuracy, result: accuracy >= 90 ? 'perfect' : 'good', highScoreValue: finalStats.score,
          gameStats: { score: finalStats.score, maxCombo: finalStats.maxCombo, notesHit: finalStats.notesHit, misses: finalStats.notesMissed },
        });
        setGameStats({ ...finalStats });
        
        if (currentTrackRef.current && !isPractice) {
          setGameState('rating');
        } else {
          setGameState('complete');
        }
        return;
      }
      
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };
    
    animationFrameRef.current = requestAnimationFrame(gameLoop);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [gameState, isPractice, onDamage, maxMisses]);

  // TIME-BASED hit detection
  const handleLaneTap = useCallback((lane: LaneType, tapTimestamp: number) => {
    if (gameState !== 'playing') return;
    
    // Visual feedback
    setPressedLanes(prev => ({ ...prev, [lane]: true }));
    setTimeout(() => setPressedLanes(prev => ({ ...prev, [lane]: false })), 80);
    
    const gameTime = tapTimestamp - gameStartTimeRef.current + AUDIO_LATENCY_OFFSET_MS;
    const notes = notesRef.current;
    let closestNote: Note | null = null;
    let closestTimeDiff = Infinity;
    
    // Find closest unhit note in this lane by TIME
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      if (note.lane !== lane || note.hit || note.missed) continue;
      
      const timeDiff = Math.abs(gameTime - note.expectedHitTime);
      if (timeDiff < closestTimeDiff && timeDiff <= TIMING_WINDOWS_MS.good) {
        closestTimeDiff = timeDiff;
        closestNote = note;
      }
    }
    
    if (!closestNote) return;
    
    // Determine hit quality based on TIME difference
    let result: HitResult;
    if (closestTimeDiff <= TIMING_WINDOWS_MS.perfect) result = 'perfect';
    else if (closestTimeDiff <= TIMING_WINDOWS_MS.great) result = 'great';
    else result = 'good';
    
    closestNote.hit = true;
    
    const currentStats = gameStatsRef.current;
    const multiplier = getComboMultiplier(currentStats.combo);
    const points = HIT_RESULTS[result].points * multiplier;
    const newCombo = currentStats.combo + 1;
    
    gameStatsRef.current = {
      score: currentStats.score + points,
      combo: newCombo,
      maxCombo: Math.max(currentStats.maxCombo, newCombo),
      notesHit: currentStats.notesHit + 1,
      notesMissed: currentStats.notesMissed,
    };
    setGameStats({ ...gameStatsRef.current });
    
    // Hit effect
    const effectId = Date.now();
    setHitEffects(prev => [...prev.slice(-(MAX_HIT_EFFECTS - 1)), { id: effectId, lane, result }]);
    setTimeout(() => setHitEffects(prev => prev.filter(e => e.id !== effectId)), 400);
    
    triggerHaptic(result === 'perfect' ? 'success' : 'light');
  }, [gameState]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      const timestamp = performance.now();
      if (e.key === 'a' || e.key === 'ArrowLeft') handleLaneTap('moon', timestamp);
      else if (e.key === 's' || e.key === 'ArrowDown') handleLaneTap('star', timestamp);
      else if (e.key === 'd' || e.key === 'ArrowRight') handleLaneTap('sun', timestamp);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, handleLaneTap]);

  const handleRate = useCallback(async (rating: 'up' | 'down') => {
    if (currentTrackRef.current) await rateTrack(currentTrackRef.current.id, rating);
  }, [rateTrack]);

  const loadNextSong = useCallback(async () => {
    audioRef.current?.pause();
    audioRef.current = null;
    
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
      setTimeout(() => setGameState('countdown'), remainingTime + READY_BUFFER_MS);
    };
    
    const loadedTrack = await fetchRandomTrack(difficulty);
    
    if (loadedTrack) {
      currentTrackRef.current = loadedTrack;
      notesRef.current = generateSyncedNotes(loadedTrack.bpm, loadedTrack.duration_seconds, difficulty);
      
      const audio = new Audio(loadedTrack.audio_url);
      audio.preload = 'auto';
      audioRef.current = audio;
      
      audio.addEventListener('canplaythrough', transitionToCountdown, { once: true });
      audio.addEventListener('error', () => {
        notesRef.current = generateFallbackNotes(difficulty);
        transitionToCountdown();
      });
      audio.load();
    } else {
      notesRef.current = generateFallbackNotes(difficulty);
      currentTrackRef.current = null;
      transitionToCountdown();
    }
  }, [difficulty, fetchRandomTrack]);

  const handleFinish = useCallback(() => setGameState('complete'), []);

  useEffect(() => {
    if (gameState === 'complete' && gameResult) {
      setTimeout(() => onComplete(gameResult), 300);
    }
  }, [gameState, gameResult, onComplete]);

  useEffect(() => {
    if (audioRef.current) {
      if (gameState === 'paused') audioRef.current.pause();
      else if (gameState === 'playing') {
        audioRef.current.play().catch((e) => {
          if (e.name !== 'NotAllowedError') {
            console.warn('Audio play failed:', e.message);
          }
        });
      }
    }
  }, [gameState]);

  // BPM-synced beat pulse effect
  useEffect(() => {
    if (gameState !== 'playing' || !currentTrackRef.current) return;
    const bpm = currentTrackRef.current.bpm || 120;
    const beatInterval = 60000 / bpm;
    
    const interval = setInterval(() => {
      setBeatPulse(true);
      setTimeout(() => setBeatPulse(false), 80);
    }, beatInterval);
    
    return () => clearInterval(interval);
  }, [gameState]);

  const approachingLanes = useMemo(() => {
    const approaching: Record<LaneType, boolean> = { moon: false, star: false, sun: false };
    for (const note of visibleNotes) {
      if (note.y > HIT_ZONE_Y - 20 && note.y < HIT_ZONE_Y + 5) {
        approaching[note.lane] = true;
      }
    }
    return approaching;
  }, [visibleNotes]);

  const { score, combo, notesHit, notesMissed } = gameStats;
  const comboMultiplier = getComboMultiplier(combo);
  const totalNotes = notesRef.current.length;
  const processedNotes = notesHit + notesMissed;

  if (gameState === 'loading') {
    return (
      <div className="flex flex-col items-center relative w-full h-full min-h-[500px] overflow-hidden" style={{ touchAction: 'none' }}>
        <TrackLoadingScreen isGenerating={isGenerating} />
      </div>
    );
  }

  if (gameState === 'rating') {
    return (
      <div className="flex flex-col items-center justify-center relative w-full h-full min-h-[500px] gap-6 p-4 overflow-hidden" style={{ touchAction: 'none' }}>
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-foreground mb-2">Song Complete!</h2>
          <p className="text-lg text-muted-foreground">
            Score: <span className="text-primary font-bold">{score}</span> • 
            Accuracy: <span className="text-primary font-bold">{gameResult?.accuracy}%</span>
          </p>
        </div>
        
        {currentTrackRef.current && (
          <TrackRatingUI trackName={currentTrackRef.current.genre} onRate={handleRate} onSkip={() => {}} currentRating={userRating} />
        )}
        
        <div className="flex gap-4 mt-4">
          <button onClick={loadNextSong} className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors">
            Next Song →
          </button>
          <button onClick={handleFinish} className="px-6 py-3 rounded-lg bg-secondary text-secondary-foreground font-semibold hover:bg-secondary/90 transition-colors">
            Finish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center relative w-full h-full min-h-[500px] overflow-hidden" style={{ touchAction: 'none' }}>
      {gameState === 'countdown' && <CountdownOverlay count={3} onComplete={handleCountdownComplete} />}
      
      {gameState === 'paused' && <PauseOverlay onResume={() => setGameState('playing')} />}

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
        compact={compact}
      />
      
      {/* Miss warning */}
      {showMissWarning && gameState === 'playing' && (
        <div
          className="absolute top-20 right-4 z-30 px-3 py-1 rounded-full text-sm font-bold animate-pulse"
          style={{ background: 'linear-gradient(135deg, hsl(0, 70%, 50%), hsl(0, 84%, 40%))', color: 'white' }}
        >
          ⚠️ {maxMisses - notesMissed} MISS{maxMisses - notesMissed > 1 ? 'ES' : ''} LEFT!
        </div>
      )}
      
      {/* Combo multiplier */}
      {showComboMultiplier && (
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full text-base font-bold"
          style={{ background: 'linear-gradient(135deg, hsl(45, 100%, 50%), hsl(25, 95%, 50%))', color: 'white', boxShadow: '0 0 15px hsl(45, 100%, 50% / 0.4)' }}
        >
          🔥 {comboMultiplier}x MULTIPLIER
        </div>
      )}

      {/* HIGHWAY CONTAINER with 3D perspective */}
      <div 
        className="relative w-full rounded-xl overflow-hidden"
        style={{
          background: 'linear-gradient(to bottom, hsl(240, 35%, 5%), hsl(260, 40%, 8%), hsl(270, 45%, 10%))',
          height: 'calc(100% - 100px)',
          minHeight: '350px',
          touchAction: 'none',
          perspective: '800px',
          perspectiveOrigin: 'center 30%',
        }}
      >
        <StaticStarBackground stars={stars} />
        
        {/* Highway track with 3D transform */}
        <div
          className="absolute inset-0"
          style={{
            transformStyle: 'preserve-3d',
            transform: 'rotateX(35deg)',
            transformOrigin: 'center bottom',
          }}
        >
          {/* Lane dividers - converging lines for highway effect */}
          <div className="absolute inset-0 flex pointer-events-none">
            {LANES.map((lane, index) => (
              <div 
                key={lane} 
                className="flex-1 relative"
                style={{ 
                  borderRight: index < 2 ? `2px solid hsl(var(--border) / 0.4)` : 'none',
                }}
              >
                {/* Center lane glow line */}
                <div
                  className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2"
                  style={{
                    background: `linear-gradient(to bottom, ${LANE_CONFIG[lane].color}10 0%, ${LANE_CONFIG[lane].color}30 50%, ${LANE_CONFIG[lane].color}50 100%)`,
                  }}
                />
              </div>
            ))}
          </div>

          {/* Lane glow trails */}
          <div className="absolute inset-0 flex pointer-events-none">
            {LANES.map((lane) => {
              const laneConfig = LANE_CONFIG[lane];
              const hasApproaching = approachingLanes[lane];
              return (
                <div
                  key={lane}
                  className="flex-1 transition-all duration-100"
                  style={{
                    background: `linear-gradient(to bottom, 
                      transparent 0%, 
                      ${laneConfig.color}${hasApproaching ? '18' : '08'} 40%, 
                      ${laneConfig.color}${hasApproaching ? '40' : '20'} 70%, 
                      ${laneConfig.color}${hasApproaching ? '60' : '30'} 100%)`,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Hit zone glow band */}
        <div
          className="absolute left-0 right-0 pointer-events-none z-8"
          style={{
            top: `${HIT_ZONE_Y - 4}%`,
            height: '10%',
            background: `linear-gradient(to bottom, transparent, hsl(45, 100%, 60% / ${beatPulse ? 0.3 : 0.15}), transparent)`,
            transition: 'background 0.08s ease-out',
          }}
        />

        {/* Beat pulse center burst */}
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-6 transition-all duration-60"
          style={{
            top: `${HIT_ZONE_Y}%`,
            transform: 'translate(-50%, -50%)',
            width: beatPulse ? '180px' : '120px',
            height: beatPulse ? '180px' : '120px',
            borderRadius: '50%',
            background: `radial-gradient(circle, hsl(45, 100%, 80% / ${beatPulse ? 0.4 : 0.1}), transparent 70%)`,
            boxShadow: beatPulse ? '0 0 80px hsl(45, 100%, 60% / 0.6)' : 'none',
          }}
        />

        {/* Hit zone line - prominent bar */}
        <div
          className="absolute left-0 right-0 pointer-events-none z-10"
          style={{
            top: `${HIT_ZONE_Y}%`,
            height: '6px',
            background: 'linear-gradient(90deg, hsl(271, 91%, 65%), hsl(45, 100%, 60%), hsl(25, 95%, 55%))',
            boxShadow: `0 0 25px hsl(45, 100%, 60% / 0.8), 0 0 50px hsl(45, 100%, 60% / ${beatPulse ? 0.6 : 0.4})`,
            transition: 'box-shadow 0.08s ease-out',
          }}
        />
        
        {/* Hit zone targets */}
        <div className="absolute left-0 right-0 flex justify-around pointer-events-none z-5" style={{ top: `${HIT_ZONE_Y}%`, transform: 'translateY(-50%)' }}>
          {LANES.map(lane => {
            const laneConfig = LANE_CONFIG[lane];
            const hasApproaching = approachingLanes[lane];
            return (
              <div 
                key={lane} 
                className="w-24 h-6 rounded-full transition-all duration-100"
                style={{ 
                  background: hasApproaching 
                    ? `linear-gradient(180deg, ${laneConfig.color}60, ${laneConfig.color}30)`
                    : `linear-gradient(180deg, ${laneConfig.color}30, ${laneConfig.color}10)`,
                  border: `3px solid ${hasApproaching ? laneConfig.color : `${laneConfig.color}60`}`,
                  boxShadow: hasApproaching 
                    ? `0 0 25px ${laneConfig.color}, inset 0 0 10px ${laneConfig.color}40` 
                    : `0 0 12px ${laneConfig.color}40`,
                  transform: hasApproaching ? 'scaleX(1.1)' : 'scaleX(1)',
                }} 
              />
            );
          })}
        </div>

        {/* Lane icons at top */}
        <div className="absolute top-4 left-0 right-0 flex justify-around pointer-events-none z-20">
          {LANES.map(lane => {
            const laneConfig = LANE_CONFIG[lane];
            const Icon = laneConfig.icon;
            return (
              <div key={lane} className="p-2 rounded-full" style={{ background: `${laneConfig.color}25` }}>
                <Icon className="w-6 h-6" style={{ color: laneConfig.color, opacity: 0.9 }} />
              </div>
            );
          })}
        </div>

        {/* BAR NOTES with trails */}
        {visibleNotes.map(note => (
          <NoteBar key={note.id} note={note} laneIndex={LANE_INDICES[note.lane]} gameTimeMs={gameTimeMs} />
        ))}

        {/* Hit effects */}
        {hitEffects.map(effect => (
          <HitEffect key={effect.id} lane={effect.lane} result={effect.result} />
        ))}

        {/* Lane buttons */}
        <div className="absolute bottom-0 left-0 right-0 flex" style={{ height: '14%' }}>
          {LANES.map((lane, i) => (
            <LaneButton
              key={lane}
              lane={lane}
              laneIndex={i}
              onTap={(timestamp) => handleLaneTap(lane, timestamp)}
              isPressed={pressedLanes[lane]}
              hasApproachingNote={approachingLanes[lane]}
            />
          ))}
        </div>
      </div>

      {gameState === 'playing' && (
        <div className="text-center py-2 text-xs text-muted-foreground">
          Tap lanes when bars reach the line • Keys: A/S/D or ←/↓/→
        </div>
      )}
    </div>
  );
};
