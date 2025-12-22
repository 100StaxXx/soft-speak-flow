import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
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

type LaneType = 'moon' | 'star' | 'sun';

interface Note {
  id: number;
  lane: LaneType;
  spawnTime: number;
  y: number;
  hit: boolean;
  missed: boolean;
}

type HitResult = 'perfect' | 'great' | 'good' | 'miss';

const LANE_INDICES: Record<LaneType, number> = { moon: 0, star: 1, sun: 2 };

const DIFFICULTY_CONFIG = {
  beginner: { notesPerBeat: 0.25, scrollSpeed: 0.025, patterns: ['single'] as const },
  easy: { notesPerBeat: 0.5, scrollSpeed: 0.035, patterns: ['single'] as const },
  medium: { notesPerBeat: 1, scrollSpeed: 0.045, patterns: ['single', 'double'] as const },
  hard: { notesPerBeat: 2, scrollSpeed: 0.055, patterns: ['single', 'double', 'triple'] as const },
  master: { notesPerBeat: 3, scrollSpeed: 0.07, patterns: ['single', 'double', 'triple'] as const },
};

const TIMING_WINDOWS = { perfect: 5, great: 9, good: 14 };

const MAX_MISSES_BY_DIFFICULTY: Record<ArcadeDifficulty, number> = {
  beginner: 12, easy: 10, medium: 8, hard: 5, master: 3,
};

const HIT_ZONE_Y = 80;
const MAX_HIT_EFFECTS = 4; // Reduced from 8
const RENDER_THROTTLE_MS = 20; // Increased from 16 (~50fps is sufficient)

const HIT_RESULTS: Record<HitResult, { label: string; points: number; color: string }> = {
  perfect: { label: 'PERFECT!', points: 100, color: 'hsl(45, 100%, 60%)' },
  great: { label: 'GREAT!', points: 75, color: 'hsl(271, 91%, 65%)' },
  good: { label: 'GOOD', points: 50, color: 'hsl(142, 71%, 45%)' },
  miss: { label: 'MISS', points: 0, color: 'hsl(0, 84%, 60%)' },
};

const LANE_CONFIG: Record<LaneType, { icon: typeof Moon; color: string }> = {
  moon: { icon: Moon, color: 'hsl(271, 91%, 65%)' },
  star: { icon: Star, color: 'hsl(45, 100%, 60%)' },
  sun: { icon: Sun, color: 'hsl(25, 95%, 55%)' },
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

// OPTIMIZED: Static star background - no beat pulse, fewer elements
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
          opacity: 0.5 + (i % 4) * 0.1,
        }}
      />
    ))}
    {/* Simple nebula - no animation */}
    <div 
      className="absolute inset-0 opacity-20"
      style={{
        background: 'radial-gradient(ellipse at 20% 30%, hsl(271, 50%, 30%) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, hsl(45, 50%, 20%) 0%, transparent 50%)',
      }}
    />
  </div>
));
StaticStarBackground.displayName = 'StaticStarBackground';

// OPTIMIZED: Simplified note orb - compact sizing
// FIX: Use percentage instead of vh for proper positioning within container
const NoteOrb = memo(({ note, laneIndex }: { note: Note; laneIndex: number }) => {
  const config = LANE_CONFIG[note.lane];
  const Icon = config.icon;
  
  return (
    <div
      className="absolute flex items-center justify-center"
      style={{
        width: '52px',
        height: '52px',
        left: `calc(${(laneIndex + 0.5) * 33.33}% - 26px)`,
        top: `${note.y}%`,
        transform: 'translateY(-50%) translateZ(0)',
        willChange: 'transform',
        zIndex: 15,
      }}
    >
      <div
        className="w-full h-full rounded-full flex items-center justify-center"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${config.color}, ${config.color}88)`,
          boxShadow: `0 0 12px ${config.color}80`,
          border: `2px solid ${config.color}`,
        }}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  );
});
NoteOrb.displayName = 'NoteOrb';

// OPTIMIZED: CSS-only hit effect - no particles, just text animation
const HitEffect = memo(({ lane, result }: { lane: LaneType; result: HitResult }) => {
  const laneIndex = LANE_INDICES[lane];
  const config = HIT_RESULTS[result];
  
  return (
    <div
      className="absolute flex items-center justify-center pointer-events-none animate-stellar-hit-text"
      style={{
        left: `calc(${(laneIndex + 0.5) * 33.33}%)`,
        top: `${HIT_ZONE_Y}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <span
        className="text-xl font-black whitespace-nowrap"
        style={{ 
          color: config.color, 
          textShadow: `0 0 10px ${config.color}`,
        }}
      >
        {config.label}
      </span>
    </div>
  );
});
HitEffect.displayName = 'HitEffect';

// Simplified lane button
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
  
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (touchIdRef.current !== null) return;
    touchIdRef.current = e.pointerId;
    triggerHaptic('light');
    onTap();
  }, [onTap]);
  
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerId === touchIdRef.current) touchIdRef.current = null;
  }, []);
  
  const handlePointerCancel = useCallback(() => { touchIdRef.current = null; }, []);
  
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
      }}
    >
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center transition-transform duration-75"
        style={{
          background: isPressed 
            ? `radial-gradient(circle, ${config.color}, ${config.color}80)`
            : `radial-gradient(circle, ${config.color}40, ${config.color}15)`,
          border: `3px solid ${config.color}${isPressed ? '' : '80'}`,
          boxShadow: isPressed 
            ? `0 0 24px ${config.color}` 
            : `0 0 8px ${config.color}30`,
          transform: isPressed ? 'scale(0.9)' : 'scale(1)',
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

const generateSyncedNotes = (bpm: number, durationSeconds: number, difficulty: ArcadeDifficulty): Note[] => {
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
  
  const maxMisses = MAX_MISSES_BY_DIFFICULTY[difficulty];
  
  const gameStartTimeRef = useRef<number>(0);
  const lastRenderTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();
  const notesRef = useRef<Note[]>([]);
  const gameStatsRef = useRef<GameStats>(initialGameStats);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<RhythmTrack | null>(null);
  const loadingStartRef = useRef<number>(0);
  
  const stars = useStaticStars(15); // Reduced from 30
  const config = DIFFICULTY_CONFIG[difficulty];
  
  const { track, isLoading, isGenerating, error, userRating, fetchRandomTrack, rateTrack } = useRhythmTrack();

  useEffect(() => { stopEncounterMusic(); }, []);

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
        // Audio play can fail due to autoplay policy - this is expected
        if (e.name !== 'NotAllowedError') {
          console.warn('Audio play failed:', e.message);
        }
      });
    }
  }, []);

  // OPTIMIZED: High-performance game loop with for-loop mutation
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const scrollSpeed = config.scrollSpeed;
    const missThreshold = HIT_ZONE_Y + TIMING_WINDOWS.good + 5;
    
    const gameLoop = (currentTime: number) => {
      const gameTime = currentTime - gameStartTimeRef.current;
      const notes = notesRef.current;
      let missCount = 0;
      
      // OPTIMIZED: For loop with in-place mutation
      for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        if (note.hit || note.missed) continue;
        
        const timeSinceSpawn = gameTime - note.spawnTime;
        if (timeSinceSpawn < 0) continue;
        
        note.y = timeSinceSpawn * scrollSpeed;
        
        if (note.y > missThreshold) {
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
      
      // OPTIMIZED: Throttled render sync
      if (currentTime - lastRenderTimeRef.current >= RENDER_THROTTLE_MS) {
        lastRenderTimeRef.current = currentTime;
        
        const visible: Note[] = [];
        for (let i = 0; i < notes.length; i++) {
          const note = notes[i];
          if (!note.hit && !note.missed && note.y >= -15 && note.y <= 105) {
            visible.push(note);
          }
        }
        setVisibleNotes(visible);
        setGameStats({ ...gameStatsRef.current });
        
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
  }, [gameState, config.scrollSpeed, isPractice, onDamage, maxMisses]);

  const handleLaneTap = useCallback((lane: LaneType) => {
    if (gameState !== 'playing') return;
    
    setPressedLanes(prev => ({ ...prev, [lane]: true }));
    setTimeout(() => setPressedLanes(prev => ({ ...prev, [lane]: false })), 100);
    
    const notes = notesRef.current;
    let closestNote: Note | null = null;
    let closestDist = Infinity;
    
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      if (note.lane !== lane || note.hit || note.missed) continue;
      const dist = Math.abs(note.y - HIT_ZONE_Y);
      if (dist < closestDist) {
        closestDist = dist;
        closestNote = note;
      }
    }
    
    if (!closestNote) return;
    
    let result: HitResult;
    if (closestDist <= TIMING_WINDOWS.perfect) result = 'perfect';
    else if (closestDist <= TIMING_WINDOWS.great) result = 'great';
    else if (closestDist <= TIMING_WINDOWS.good) result = 'good';
    else return;
    
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
    
    // OPTIMIZED: Fewer effects, shorter timeout
    const effectId = Date.now();
    setHitEffects(prev => [...prev.slice(-(MAX_HIT_EFFECTS - 1)), { id: effectId, lane, result }]);
    setTimeout(() => setHitEffects(prev => prev.filter(e => e.id !== effectId)), 400);
    
    triggerHaptic(result === 'perfect' ? 'success' : 'light');
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
          // Audio play can fail due to autoplay policy - expected behavior
          if (e.name !== 'NotAllowedError') {
            console.warn('Audio play failed:', e.message);
          }
        });
      }
    }
  }, [gameState]);

  const approachingLanes = useMemo(() => {
    const approaching: Record<LaneType, boolean> = { moon: false, star: false, sun: false };
    for (const note of visibleNotes) {
      if (note.y > HIT_ZONE_Y - 25 && note.y < HIT_ZONE_Y + 10) {
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
      />
      
      {/* OPTIMIZED: CSS-only warning */}
      {showMissWarning && gameState === 'playing' && (
        <div
          className="absolute top-20 right-4 z-30 px-3 py-1 rounded-full text-sm font-bold animate-pulse"
          style={{ background: 'linear-gradient(135deg, hsl(0, 70%, 50%), hsl(0, 84%, 40%))', color: 'white' }}
        >
          ⚠️ {maxMisses - notesMissed} MISS{maxMisses - notesMissed > 1 ? 'ES' : ''} LEFT!
        </div>
      )}
      
      {/* OPTIMIZED: CSS-only combo multiplier */}
      {showComboMultiplier && (
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full text-base font-bold"
          style={{ background: 'linear-gradient(135deg, hsl(45, 100%, 50%), hsl(25, 95%, 50%))', color: 'white', boxShadow: '0 0 15px hsl(45, 100%, 50% / 0.4)' }}
        >
          🔥 {comboMultiplier}x MULTIPLIER
        </div>
      )}

      <div 
        className="relative w-full rounded-xl overflow-hidden"
        style={{
          background: 'linear-gradient(to bottom, hsl(240, 30%, 6%), hsl(260, 35%, 10%), hsl(270, 40%, 12%))',
          height: 'calc(100% - 100px)',
          minHeight: '350px',
          touchAction: 'none',
        }}
      >
        <StaticStarBackground stars={stars} />
        
        {/* Lane dividers */}
        <div className="absolute inset-0 flex pointer-events-none">
          {LANES.map((lane) => (
            <div key={lane} className="flex-1 border-r last:border-r-0" style={{ borderColor: 'hsl(var(--border) / 0.35)' }} />
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
                className="flex-1"
                style={{
                  background: `linear-gradient(to bottom, transparent 0%, ${laneConfig.color}${hasApproaching ? '15' : '08'} 40%, ${laneConfig.color}${hasApproaching ? '25' : '12'} 70%, ${laneConfig.color}${hasApproaching ? '35' : '18'} 100%)`,
                }}
              />
            );
          })}
        </div>

        {/* Hit zone line */}
        <div
          className="absolute left-0 right-0 pointer-events-none z-10"
          style={{
            top: `${HIT_ZONE_Y}%`,
            height: '3px',
            background: 'linear-gradient(90deg, hsl(271, 91%, 65%), hsl(45, 100%, 60%), hsl(25, 95%, 55%))',
            boxShadow: '0 0 15px hsl(45, 100%, 60% / 0.5)',
          }}
        />
        
        {/* Hit zone targets */}
        <div className="absolute left-0 right-0 flex justify-around pointer-events-none z-5" style={{ top: `${HIT_ZONE_Y}%`, transform: 'translateY(-50%)' }}>
          {LANES.map(lane => (
            <div key={lane} className="w-20 h-20 rounded-full border-2" style={{ borderColor: `${LANE_CONFIG[lane].color}40` }} />
          ))}
        </div>

        {/* Lane icons */}
        <div className="absolute top-4 left-0 right-0 flex justify-around pointer-events-none z-20">
          {LANES.map(lane => {
            const laneConfig = LANE_CONFIG[lane];
            const Icon = laneConfig.icon;
            return (
              <div key={lane} className="p-2 rounded-full" style={{ background: `${laneConfig.color}20` }}>
                <Icon className="w-6 h-6" style={{ color: laneConfig.color, opacity: 0.8 }} />
              </div>
            );
          })}
        </div>

        {/* Notes */}
        {visibleNotes.map(note => (
          <NoteOrb key={note.id} note={note} laneIndex={LANE_INDICES[note.lane]} />
        ))}

        {/* Hit effects */}
        {hitEffects.map(effect => (
          <HitEffect key={effect.id} lane={effect.lane} result={effect.result} />
        ))}

        {/* Lane buttons */}
        <div className="absolute bottom-0 left-0 right-0 flex" style={{ height: '18%' }}>
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

      {gameState === 'playing' && (
        <div className="text-center py-2 text-xs text-muted-foreground">
          Tap lanes when notes reach the line • Keys: A/S/D or ←/↓/→
        </div>
      )}
    </div>
  );
};
