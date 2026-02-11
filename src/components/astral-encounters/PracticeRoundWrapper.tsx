import { useState, useEffect, useCallback, memo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult, MiniGameType } from '@/types/astralEncounters';
import { Button } from '@/components/ui/button';
import { Play, SkipForward } from 'lucide-react';

const EnergyBeamGame = lazy(() => import('./EnergyBeamGame').then(m => ({ default: m.EnergyBeamGame })));
const TapSequenceGame = lazy(() => import('./TapSequenceGame').then(m => ({ default: m.TapSequenceGame })));
const AstralFrequencyGame = lazy(() => import('./AstralFrequencyGame').then(m => ({ default: m.AstralFrequencyGame })));
const EclipseTimingGame = lazy(() => import('./EclipseTimingGame').then(m => ({ default: m.EclipseTimingGame })));
const StarfallDodgeGame = lazy(() => import('./StarfallDodgeGame').then(m => ({ default: m.StarfallDodgeGame })));
const SoulSerpentGame = lazy(() => import('./SoulSerpentGame').then(m => ({ default: m.SoulSerpentGame })));
const OrbMatchGame = lazy(() => import('./OrbMatchGame').then(m => ({ default: m.OrbMatchGame })));
const GalacticMatchGame = lazy(() => import('./GalacticMatchGame').then(m => ({ default: m.GalacticMatchGame })));

interface PracticeRoundWrapperProps {
  gameType: MiniGameType;
  companionStats: { mind: number; body: number; soul: number };
  onPracticeComplete: () => void;
  onSkipPractice: () => void;
  isFullscreen?: boolean;
}

// Games that need fullscreen rendering
const FULLSCREEN_GAMES: MiniGameType[] = ['starfall_dodge', 'astral_frequency'];

// Practice duration - short rounds for all games
const PRACTICE_TIMER = 12; // 12 seconds for all practice rounds

const PracticeBanner = memo(() => (
  <motion.div
    className="absolute top-0 left-0 right-0 z-50 flex justify-center"
    initial={{ y: -50, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
  >
    <div className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 px-6 py-2 rounded-b-xl shadow-lg">
      <div className="flex items-center gap-2">
        <motion.span
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="text-lg"
        >
          🎯
        </motion.span>
        <span className="font-bold text-black text-sm uppercase tracking-wider">
          Practice Round
        </span>
        <motion.span
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1, repeat: Infinity, delay: 0.5 }}
          className="text-lg"
        >
          🎯
        </motion.span>
      </div>
    </div>
  </motion.div>
));
PracticeBanner.displayName = 'PracticeBanner';

const PracticeIntro = memo(({ 
  gameType, 
  onStart, 
  onSkip 
}: { 
  gameType: MiniGameType; 
  onStart: () => void; 
  onSkip: () => void;
}) => {
  const gameName = {
    energy_beam: 'Star Defender',
    tap_sequence: 'Tap Sequence',
    astral_frequency: 'Cosmiq Dash',
    eclipse_timing: 'Stellar Beats',
    starfall_dodge: 'Starfall Dodge',
    soul_serpent: 'Soul Serpent',
    orb_match: 'Starburst',
    galactic_match: 'Galactic Match',
  }[gameType];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex flex-col items-center justify-center p-8 text-center min-h-[400px]"
    >
      <motion.div
        className="mb-6 p-4 rounded-full bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-500/30"
        animate={{ 
          boxShadow: ['0 0 20px rgba(245, 158, 11, 0.3)', '0 0 40px rgba(245, 158, 11, 0.5)', '0 0 20px rgba(245, 158, 11, 0.3)']
        }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <span className="text-5xl">🎮</span>
      </motion.div>

      <h3 className="text-2xl font-bold text-foreground mb-2">
        Practice Round
      </h3>
      
      <p className="text-muted-foreground mb-2">
        Try <span className="text-amber-400 font-semibold">{gameName}</span> before the real battle!
      </p>
      
      <p className="text-sm text-muted-foreground/70 mb-8 max-w-xs">
        This is a quick practice session to warm up. Your score won't count yet!
      </p>

      <div className="flex gap-3">
        <Button
          onClick={onStart}
          size="lg"
          className="px-8 font-bold bg-gradient-to-r from-amber-500 to-yellow-500 text-black hover:from-amber-600 hover:to-yellow-600"
        >
          <Play className="w-5 h-5 mr-2" />
          Start Practice
        </Button>
        
        <Button
          onClick={onSkip}
          variant="ghost"
          size="lg"
          className="text-muted-foreground hover:text-foreground"
        >
          <SkipForward className="w-4 h-4 mr-1" />
          Skip
        </Button>
      </div>
    </motion.div>
  );
});
PracticeIntro.displayName = 'PracticeIntro';

const PracticeComplete = memo(({ onContinue }: { onContinue: () => void }) => {
  // Auto-continue after 2 seconds
  useEffect(() => {
    const timer = setTimeout(onContinue, 2000);
    return () => clearTimeout(timer);
  }, [onContinue]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="flex flex-col items-center justify-center p-8 text-center min-h-[400px]"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="mb-6"
      >
        <span className="text-6xl">✨</span>
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-2xl font-bold text-foreground mb-2"
      >
        Nice Warm-Up!
      </motion.h3>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-muted-foreground mb-6"
      >
        Now let's do it for real!
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex items-center gap-2 text-sm text-muted-foreground/70"
      >
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>Starting real battle...</span>
      </motion.div>
    </motion.div>
  );
});
PracticeComplete.displayName = 'PracticeComplete';

const PracticeLoadingFallback = memo(() => (
  <div className="pt-2 min-h-[400px] flex items-center justify-center">
    <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span>Loading practice game...</span>
    </div>
  </div>
));
PracticeLoadingFallback.displayName = 'PracticeLoadingFallback';

export const PracticeRoundWrapper = ({
  gameType,
  companionStats,
  onPracticeComplete,
  onSkipPractice,
  isFullscreen = false,
}: PracticeRoundWrapperProps) => {
  const [practicePhase, setPracticePhase] = useState<'intro' | 'playing' | 'complete'>('intro');
  
  // Check if this game needs fullscreen rendering
  const isFullscreenGame = isFullscreen || FULLSCREEN_GAMES.includes(gameType);

  const handleStartPractice = useCallback(() => {
    setPracticePhase('playing');
  }, []);

  const handlePracticeGameComplete = useCallback((_result: MiniGameResult) => {
    // Don't care about the result - it's practice
    setPracticePhase('complete');
  }, []);

  // Render the practice game with easier settings and shorter timer
  const renderPracticeGame = () => {
    const props = {
      companionStats,
      onComplete: handlePracticeGameComplete,
      difficulty: 'easy' as const,
      questIntervalScale: 0,
      isPractice: true,
      maxTimer: PRACTICE_TIMER, // Short practice duration
    };

    switch (gameType) {
      case 'energy_beam':
        return <EnergyBeamGame {...props} />;
      case 'tap_sequence':
        return <TapSequenceGame {...props} />;
      case 'astral_frequency':
        return <AstralFrequencyGame {...props} />;
      case 'eclipse_timing':
        return <EclipseTimingGame {...props} />;
      case 'starfall_dodge':
        return <StarfallDodgeGame {...props} />;
      case 'soul_serpent':
        return <SoulSerpentGame {...props} />;
      case 'orb_match':
        return <OrbMatchGame {...props} />;
      case 'galactic_match':
        return <GalacticMatchGame {...props} />;
      default:
        return <EnergyBeamGame {...props} />;
    }
  };

  return (
    <div className={isFullscreenGame ? "relative h-full" : "relative"}>
      <AnimatePresence mode="wait">
        {practicePhase === 'intro' && (
          <PracticeIntro
            key="intro"
            gameType={gameType}
            onStart={handleStartPractice}
            onSkip={onSkipPractice}
          />
        )}

        {practicePhase === 'playing' && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={isFullscreenGame ? "relative h-full" : "relative"}
          >
            <PracticeBanner />
            <Suspense fallback={<PracticeLoadingFallback />}>
              {isFullscreenGame ? (
                // Fullscreen games render without constraints
                renderPracticeGame()
              ) : (
                // Non-fullscreen games keep the scroll container
                <div className="pt-2 min-h-[400px] max-h-[calc(100vh-120px)] overflow-y-auto">
                  {renderPracticeGame()}
                </div>
              )}
            </Suspense>
          </motion.div>
        )}

        {practicePhase === 'complete' && (
          <PracticeComplete
            key="complete"
            onContinue={onPracticeComplete}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
