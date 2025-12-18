import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic, useStaticStars } from './gameUtils';
import { TrackRatingUI } from './TrackRatingUI';
import { useRhythmTrack, RhythmTrack } from '@/hooks/useRhythmTrack';
import { Moon, Star, Sun, Music, Loader2 } from 'lucide-react';
import { stopEncounterMusic } from '@/utils/soundEffects';
interface EclipseTimingGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
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

// Difficulty configurations for BPM-synced notes
const DIFFICULTY_CONFIG = {
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
};

// Timing windows (in % distance from hit zone)
const TIMING_WINDOWS = {
  perfect: 3,
  great: 6,
  good: 10,
};

const HIT_ZONE_Y = 85;

const HIT_RESULTS: Record<HitResult, { label: string; points: number; color: string }> = {
  perfect: { label: 'PERFECT!', points: 100, color: 'hsl(45, 100%, 60%)' },
  great: { label: 'GREAT!', points: 75, color: 'hsl(271, 91%, 65%)' },
  good: { label: 'GOOD', points: 50, color: 'hsl(142, 71%, 45%)' },
  miss: { label: 'MISS', points: 0, color: 'hsl(0, 84%, 60%)' },
};

const LANE_CONFIG: Record<LaneType, { icon: typeof Moon; color: string; bgColor: string }> = {
  moon: { icon: Moon, color: 'hsl(271, 91%, 65%)', bgColor: 'hsl(271, 91%, 65%)' },
  star: { icon: Star, color: 'hsl(45, 100%, 60%)', bgColor: 'hsl(45, 100%, 60%)' },
  sun: { icon: Sun, color: 'hsl(25, 95%, 55%)', bgColor: 'hsl(25, 95%, 55%)' },
};

const LANES: LaneType[] = ['moon', 'star', 'sun'];

const getComboMultiplier = (combo: number): number => {
  if (combo >= 50) return 4;
  if (combo >= 25) return 3;
  if (combo >= 10) return 2;
  return 1;
};

// Star background
const StarBackground = memo(({ stars }: { stars: ReturnType<typeof useStaticStars> }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {stars.map(star => (
      <div
        key={star.id}
        className="absolute w-1 h-1 bg-white/20 rounded-full"
        style={{ left: `${star.x}%`, top: `${star.y}%` }}
      />
    ))}
  </div>
));
StarBackground.displayName = 'StarBackground';

// Note component
const NoteOrb = memo(({ note, laneIndex }: { note: Note; laneIndex: number }) => {
  const config = LANE_CONFIG[note.lane];
  const Icon = config.icon;
  
  if (note.hit || note.missed) return null;
  
  return (
    <div
      className="absolute w-14 h-14 flex items-center justify-center transition-transform"
      style={{
        left: `calc(${(laneIndex + 0.5) * 33.33}% - 28px)`,
        top: `${note.y}%`,
        transform: 'translateY(-50%)',
      }}
    >
      <div
        className="w-full h-full rounded-full flex items-center justify-center"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${config.color}, ${config.color}88)`,
          boxShadow: `0 0 20px ${config.color}80, 0 0 40px ${config.color}40`,
          border: `2px solid ${config.color}`,
        }}
      >
        <Icon className="w-7 h-7 text-white drop-shadow-lg" />
      </div>
    </div>
  );
});
NoteOrb.displayName = 'NoteOrb';

// Hit effect component
const HitEffect = memo(({ lane, result }: { lane: LaneType; result: HitResult }) => {
  const laneIndex = LANES.indexOf(lane);
  const config = HIT_RESULTS[result];
  
  return (
    <motion.div
      className="absolute flex flex-col items-center pointer-events-none"
      style={{
        left: `calc(${(laneIndex + 0.5) * 33.33}% - 40px)`,
        top: `${HIT_ZONE_Y - 15}%`,
      }}
      initial={{ opacity: 1, scale: 0.5, y: 0 }}
      animate={{ opacity: 0, scale: 1.5, y: -30 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <span
        className="text-lg font-black"
        style={{ color: config.color, textShadow: `0 0 10px ${config.color}` }}
      >
        {config.label}
      </span>
    </motion.div>
  );
});
HitEffect.displayName = 'HitEffect';

// Lane button component
const LaneButton = memo(({ 
  lane, 
  laneIndex, 
  onTap, 
  isPressed 
}: { 
  lane: LaneType; 
  laneIndex: number; 
  onTap: () => void;
  isPressed: boolean;
}) => {
  const config = LANE_CONFIG[lane];
  const Icon = config.icon;
  
  return (
    <button
      className="flex-1 h-full flex items-center justify-center relative overflow-hidden touch-manipulation"
      onPointerDown={onTap}
      style={{
        background: isPressed 
          ? `linear-gradient(to top, ${config.color}60, transparent)` 
          : 'transparent',
      }}
    >
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-75"
        style={{
          background: isPressed 
            ? `radial-gradient(circle, ${config.color}80, ${config.color}40)`
            : `radial-gradient(circle, ${config.color}30, ${config.color}10)`,
          border: `3px solid ${config.color}${isPressed ? '' : '60'}`,
          boxShadow: isPressed ? `0 0 30px ${config.color}80, inset 0 0 20px ${config.color}40` : 'none',
          transform: isPressed ? 'scale(0.95)' : 'scale(1)',
        }}
      >
        <Icon 
          className="w-8 h-8 transition-all" 
          style={{ 
            color: isPressed ? 'white' : config.color,
            filter: isPressed ? `drop-shadow(0 0 10px white)` : 'none',
          }} 
        />
      </div>
    </button>
  );
});
LaneButton.displayName = 'LaneButton';

// Generate BPM-synced notes
const generateSyncedNotes = (
  bpm: number, 
  durationSeconds: number, 
  difficulty: 'easy' | 'medium' | 'hard'
): Note[] => {
  const config = DIFFICULTY_CONFIG[difficulty];
  const beatInterval = 60000 / bpm; // ms per beat
  const noteInterval = beatInterval / config.notesPerBeat;
  const notes: Note[] = [];
  
  // Start after 2 seconds, end 2 seconds before track ends
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

// Fallback note generation (when no track available)
const generateFallbackNotes = (difficulty: 'easy' | 'medium' | 'hard'): Note[] => {
  // Default to 120 BPM, 30 seconds
  return generateSyncedNotes(120, 30, difficulty);
};

// Loading screen component
const TrackLoadingScreen = memo(({ isGenerating }: { isGenerating?: boolean }) => (
  <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
    >
      <Music className="w-16 h-16 text-primary" />
    </motion.div>
    <p className="text-lg font-medium text-foreground">
      {isGenerating ? 'Generating music...' : 'Loading music...'}
    </p>
    <p className="text-sm text-muted-foreground">
      {isGenerating ? 'Creating AI-powered rhythm track' : 'Preparing your rhythm experience'}
    </p>
  </div>
));
TrackLoadingScreen.displayName = 'TrackLoadingScreen';

export const EclipseTimingGame = ({
  companionStats,
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0,
  maxTimer,
  isPractice = false,
}: EclipseTimingGameProps) => {
  const [gameState, setGameState] = useState<'loading' | 'countdown' | 'playing' | 'paused' | 'rating' | 'complete'>('loading');
  const [notes, setNotes] = useState<Note[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [hitEffects, setHitEffects] = useState<{ id: number; lane: LaneType; result: HitResult }[]>([]);
  const [pressedLanes, setPressedLanes] = useState<Record<LaneType, boolean>>({ moon: false, star: false, sun: false });
  const [notesHit, setNotesHit] = useState(0);
  const [notesMissed, setNotesMissed] = useState(0);
  const [gameResult, setGameResult] = useState<MiniGameResult | null>(null);
  
  const gameStartTimeRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();
  const notesRef = useRef<Note[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<RhythmTrack | null>(null);
  
  const stars = useStaticStars(20);
  const config = DIFFICULTY_CONFIG[difficulty];
  
  const { track, isLoading, isGenerating, error, userRating, fetchRandomTrack, rateTrack } = useRhythmTrack();

  // Stop encounter music when Stellar Beats starts (has its own audio)
  useEffect(() => {
    stopEncounterMusic();
  }, []);

  // Load track and initialize notes
  useEffect(() => {
    const initGame = async () => {
      const loadedTrack = await fetchRandomTrack(difficulty);
      
      if (loadedTrack) {
        currentTrackRef.current = loadedTrack;
        // Generate BPM-synced notes
        const syncedNotes = generateSyncedNotes(loadedTrack.bpm, loadedTrack.duration_seconds, difficulty);
        setNotes(syncedNotes);
        notesRef.current = syncedNotes;
        
        // Preload audio
        const audio = new Audio(loadedTrack.audio_url);
        audio.preload = 'auto';
        audioRef.current = audio;
        
        // Wait for audio to be ready
        audio.addEventListener('canplaythrough', () => {
          setGameState('countdown');
        }, { once: true });
        
        audio.addEventListener('error', (e) => {
          console.error('Audio load error:', e);
          // Fallback to no-track mode
          const fallbackNotes = generateFallbackNotes(difficulty);
          setNotes(fallbackNotes);
          notesRef.current = fallbackNotes;
          setGameState('countdown');
        });
        
        audio.load();
      } else {
        // No track available, use fallback
        console.log('No track available, using fallback notes');
        const fallbackNotes = generateFallbackNotes(difficulty);
        setNotes(fallbackNotes);
        notesRef.current = fallbackNotes;
        setGameState('countdown');
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
    
    // Start audio playback
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.error('Audio playback error:', err);
      });
    }
  }, []);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const gameLoop = (currentTime: number) => {
      const deltaTime = currentTime - lastFrameTimeRef.current;
      lastFrameTimeRef.current = currentTime;
      const gameTime = currentTime - gameStartTimeRef.current;
      
      // Update note positions
      setNotes(prevNotes => {
        const updatedNotes = prevNotes.map(note => {
          if (note.hit || note.missed) return note;
          
          const timeSinceSpawn = gameTime - note.spawnTime;
          if (timeSinceSpawn < 0) return note;
          
          const newY = timeSinceSpawn * config.scrollSpeed;
          
          if (newY > HIT_ZONE_Y + TIMING_WINDOWS.good + 5 && !note.hit && !note.missed) {
            setNotesMissed(m => m + 1);
            setCombo(0);
            return { ...note, y: newY, missed: true };
          }
          
          return { ...note, y: newY };
        });
        
        notesRef.current = updatedNotes;
        return updatedNotes;
      });
      
      // Check if game is complete
      const allNotesProcessed = notesRef.current.every(n => n.hit || n.missed || n.y > 100);
      if (allNotesProcessed && notesRef.current.length > 0) {
        // Stop audio
        if (audioRef.current) {
          audioRef.current.pause();
        }
        
        // Calculate result
        const totalNotes = notesRef.current.length;
        const accuracy = totalNotes > 0 ? Math.round((notesHit / totalNotes) * 100) : 0;
        const result = accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 40 ? 'partial' : 'fail';
        
        setGameResult({
          success: accuracy >= 50,
          accuracy,
          result,
        });
        
        // Show rating UI if we have a track, otherwise complete immediately
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
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState, config.scrollSpeed, notesHit, isPractice]);

  // Handle lane tap
  const handleLaneTap = useCallback((lane: LaneType) => {
    if (gameState !== 'playing') return;
    
    setPressedLanes(prev => ({ ...prev, [lane]: true }));
    setTimeout(() => setPressedLanes(prev => ({ ...prev, [lane]: false })), 100);
    
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
    
    setNotes(prev => prev.map(n => n.id === closestNote.id ? { ...n, hit: true } : n));
    notesRef.current = notesRef.current.map(n => n.id === closestNote.id ? { ...n, hit: true } : n);
    
    const multiplier = getComboMultiplier(combo);
    const points = HIT_RESULTS[result].points * multiplier;
    setScore(s => s + points);
    setNotesHit(h => h + 1);
    
    setCombo(c => {
      const newCombo = c + 1;
      setMaxCombo(m => Math.max(m, newCombo));
      return newCombo;
    });
    
    const effectId = Date.now() + Math.random();
    setHitEffects(prev => [...prev, { id: effectId, lane, result }]);
    setTimeout(() => {
      setHitEffects(prev => prev.filter(e => e.id !== effectId));
    }, 500);
    
    triggerHaptic(result === 'perfect' ? 'success' : result === 'great' ? 'medium' : 'light');
  }, [gameState, combo]);

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
    setGameState('complete');
  }, [rateTrack]);

  const handleSkipRating = useCallback(() => {
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

  const comboMultiplier = getComboMultiplier(combo);
  const totalNotes = notes.length;
  const processedNotes = notesHit + notesMissed;

  // Loading state
  if (gameState === 'loading') {
    return (
      <div className="flex flex-col items-center relative w-full h-full min-h-[500px]">
        <TrackLoadingScreen isGenerating={isGenerating} />
      </div>
    );
  }

  // Rating state
  if (gameState === 'rating' && currentTrackRef.current) {
    return (
      <div className="flex flex-col items-center justify-center relative w-full h-full min-h-[500px] gap-6 p-4">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-foreground mb-2">Game Complete!</h2>
          <p className="text-lg text-muted-foreground">
            Score: <span className="text-primary font-bold">{score}</span> • 
            Accuracy: <span className="text-primary font-bold">{gameResult?.accuracy}%</span>
          </p>
        </div>
        <TrackRatingUI
          trackName={currentTrackRef.current.genre}
          onRate={handleRate}
          onSkip={handleSkipRating}
          currentRating={userRating}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center relative w-full h-full min-h-[500px]">
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
        primaryStat={{ value: notesMissed, label: 'Misses', color: 'hsl(0, 84%, 60%)' }}
        isPaused={gameState === 'paused'}
        onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      />
      {/* Combo multiplier indicator - absolute positioned to avoid layout shift */}
      <AnimatePresence>
        {combo >= 10 && (
          <motion.div
            className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full text-sm font-bold"
            style={{
              background: 'linear-gradient(135deg, hsl(45, 100%, 50%), hsl(25, 95%, 50%))',
              color: 'white',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [1, 1.1, 1], opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {comboMultiplier}x MULTIPLIER
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game arena */}
      <div 
        className="relative w-full flex-1 rounded-xl overflow-hidden"
        style={{
          background: 'linear-gradient(to bottom, hsl(240, 30%, 8%), hsl(260, 30%, 12%))',
          minHeight: '400px',
        }}
      >
        <StarBackground stars={stars} />
        
        {/* Lane dividers */}
        <div className="absolute inset-0 flex pointer-events-none">
          {LANES.map((lane, i) => (
            <div
              key={lane}
              className="flex-1 border-r last:border-r-0"
              style={{ borderColor: 'hsl(var(--border) / 0.2)' }}
            />
          ))}
        </div>
        
        {/* Lane glow trails */}
        <div className="absolute inset-0 flex pointer-events-none">
          {LANES.map((lane, i) => {
            const laneConfig = LANE_CONFIG[lane];
            return (
              <div
                key={lane}
                className="flex-1"
                style={{
                  background: `linear-gradient(to bottom, transparent 0%, ${laneConfig.color}08 50%, ${laneConfig.color}15 100%)`,
                }}
              />
            );
          })}
        </div>

        {/* Hit zone line */}
        <div
          className="absolute left-0 right-0 h-1 pointer-events-none z-10"
          style={{
            top: `${HIT_ZONE_Y}%`,
            background: 'linear-gradient(90deg, hsl(271, 91%, 65%), hsl(45, 100%, 60%), hsl(25, 95%, 55%))',
            boxShadow: '0 0 20px hsl(271, 91%, 65% / 0.5), 0 0 40px hsl(45, 100%, 60% / 0.3)',
          }}
        />
        
        {/* Hit zone glow area */}
        <div
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            top: `${HIT_ZONE_Y - 5}%`,
            height: '10%',
            background: 'linear-gradient(to bottom, transparent, hsl(var(--primary) / 0.1), transparent)',
          }}
        />

        {/* Lane icons at top */}
        <div className="absolute top-3 left-0 right-0 flex justify-around pointer-events-none z-20">
          {LANES.map(lane => {
            const laneConfig = LANE_CONFIG[lane];
            const Icon = laneConfig.icon;
            return (
              <div key={lane} className="flex flex-col items-center">
                <Icon className="w-6 h-6" style={{ color: laneConfig.color, opacity: 0.6 }} />
              </div>
            );
          })}
        </div>

        {/* Notes */}
        {notes.map(note => (
          <NoteOrb key={note.id} note={note} laneIndex={LANES.indexOf(note.lane)} />
        ))}

        {/* Hit effects */}
        <AnimatePresence>
          {hitEffects.map(effect => (
            <HitEffect key={effect.id} lane={effect.lane} result={effect.result} />
          ))}
        </AnimatePresence>

        {/* Tap buttons at bottom */}
        <div 
          className="absolute bottom-0 left-0 right-0 flex"
          style={{ height: '15%' }}
        >
          {LANES.map((lane, i) => (
            <LaneButton
              key={lane}
              lane={lane}
              laneIndex={i}
              onTap={() => handleLaneTap(lane)}
              isPressed={pressedLanes[lane]}
            />
          ))}
        </div>
      </div>

      {/* Instructions */}
      {gameState === 'playing' && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Tap lanes when notes reach the line • Keyboard: A/S/D
        </p>
      )}
    </div>
  );
};
