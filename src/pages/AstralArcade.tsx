import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageTransition } from '@/components/PageTransition';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArcadeGameCard } from '@/components/astral-encounters/ArcadeGameCard';
import { useCompanion } from '@/hooks/useCompanion';
import { useArcadeHighScores } from '@/hooks/useArcadeHighScores';
import { useAchievements } from '@/hooks/useAchievements';
import { MiniGameType, MiniGameResult } from '@/types/astralEncounters';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Zap,
  Target,
  Radio,
  Clock,
  Shield,
  Hexagon,
  Gamepad2,
  Grid3X3,
  Trophy,
  Star,
  Sparkles,
} from 'lucide-react';

// Game components
import {
  EnergyBeamGame,
  TapSequenceGame,
  AstralFrequencyGame,
  EclipseTimingGame,
  StarfallDodgeGame,
  RuneResonanceGame,
  AstralSerpentGame,
  OrbMatchGame,
} from '@/components/astral-encounters';

const GAMES = [
  { type: 'energy_beam' as MiniGameType, label: 'Energy Beam', icon: Zap, stat: 'mind' as const },
  { type: 'tap_sequence' as MiniGameType, label: 'Tap Sequence', icon: Target, stat: 'mind' as const },
  { type: 'astral_frequency' as MiniGameType, label: 'Astral Frequency', icon: Radio, stat: 'soul' as const },
  { type: 'eclipse_timing' as MiniGameType, label: 'Eclipse Timing', icon: Clock, stat: 'body' as const },
  { type: 'starfall_dodge' as MiniGameType, label: 'Starfall Dodge', icon: Shield, stat: 'body' as const },
  { type: 'rune_resonance' as MiniGameType, label: 'Rune Resonance', icon: Hexagon, stat: 'soul' as const },
  { type: 'astral_serpent' as MiniGameType, label: 'Astral Serpent', icon: Gamepad2, stat: 'body' as const },
  { type: 'orb_match' as MiniGameType, label: 'Orb Match', icon: Grid3X3, stat: 'mind' as const },
];

type Difficulty = 'easy' | 'medium' | 'hard';

export default function AstralArcade() {
  const navigate = useNavigate();
  const { companion } = useCompanion();
  const { getHighScore, setHighScore, getTotalGamesWithHighScores, getAverageHighScore } = useArcadeHighScores();
  const { checkArcadeDiscovery } = useAchievements();

  const [activeGame, setActiveGame] = useState<MiniGameType | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [sessionPlays, setSessionPlays] = useState(0);
  const [sessionBestAccuracy, setSessionBestAccuracy] = useState(0);

  // Award discovery badge on first visit
  useEffect(() => {
    checkArcadeDiscovery();
  }, [checkArcadeDiscovery]);

  const companionStats = companion ? {
    mind: companion.mind ?? 10,
    body: companion.body ?? 10,
    soul: companion.soul ?? 10,
  } : { mind: 10, body: 10, soul: 10 };

  const handleGameComplete = useCallback((result: MiniGameResult) => {
    setSessionPlays((p) => p + 1);
    
    if (result.accuracy > sessionBestAccuracy) {
      setSessionBestAccuracy(result.accuracy);
    }

    if (activeGame) {
      const isNewHighScore = setHighScore(activeGame, result.accuracy, result.result);
      if (isNewHighScore) {
        toast.success('New High Score!', {
          description: `${result.accuracy}% accuracy`,
          icon: '🏆',
        });
      }
    }

    setActiveGame(null);
  }, [activeGame, sessionBestAccuracy, setHighScore]);

  const renderGame = () => {
    if (!activeGame) return null;

    const gameProps = {
      companionStats,
      difficulty,
      onComplete: handleGameComplete,
    };

    switch (activeGame) {
      case 'energy_beam':
        return <EnergyBeamGame {...gameProps} />;
      case 'tap_sequence':
        return <TapSequenceGame {...gameProps} />;
      case 'astral_frequency':
        return <AstralFrequencyGame {...gameProps} />;
      case 'eclipse_timing':
        return <EclipseTimingGame {...gameProps} />;
      case 'starfall_dodge':
        return <StarfallDodgeGame {...gameProps} />;
      case 'rune_resonance':
        return <RuneResonanceGame {...gameProps} />;
      case 'astral_serpent':
        return <AstralSerpentGame {...gameProps} />;
      case 'orb_match':
        return <OrbMatchGame {...gameProps} />;
      default:
        return null;
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Animated starfield background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-background to-background" />
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
                opacity: 0.3 + Math.random() * 0.5,
              }}
            />
          ))}
        </div>

        {/* Active game overlay */}
        {activeGame && (
          <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveGame(null)}
                className="mb-4 text-muted-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Exit Game
              </Button>
              {renderGame()}
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="relative z-10 p-4 max-w-lg mx-auto space-y-6 pb-8">
          {/* Header */}
          <div className="text-center pt-4">
            <div className="inline-flex items-center gap-2 mb-2">
              <Sparkles className="w-6 h-6 text-purple-400" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                Astral Arcade
              </h1>
              <Sparkles className="w-6 h-6 text-cyan-400" />
            </div>
            <p className="text-sm text-muted-foreground">
              Practice mini-games and sharpen your skills
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
              <div className="flex items-center gap-2 text-purple-400 mb-1">
                <Gamepad2 className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Session</span>
              </div>
              <p className="text-2xl font-bold">{sessionPlays}</p>
              <p className="text-[10px] text-muted-foreground">Games played</p>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
              <div className="flex items-center gap-2 text-yellow-400 mb-1">
                <Star className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Best</span>
              </div>
              <p className="text-2xl font-bold">{sessionBestAccuracy}%</p>
              <p className="text-[10px] text-muted-foreground">Session accuracy</p>
            </Card>
          </div>

          {/* High Scores Card */}
          <Card className="p-4 bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border-cyan-500/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-cyan-400">
                <Trophy className="w-4 h-4" />
                <span className="text-sm font-semibold uppercase tracking-wide">All-Time Records</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold text-cyan-400">{getTotalGamesWithHighScores()}/8</p>
                <p className="text-[10px] text-muted-foreground">Games mastered</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-cyan-400">{getAverageHighScore()}%</p>
                <p className="text-[10px] text-muted-foreground">Average best</p>
              </div>
            </div>
          </Card>

          {/* Difficulty Selector */}
          <div className="flex items-center justify-center gap-2">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  difficulty === d
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30'
                    : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                }`}
              >
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>

          {/* Game Grid */}
          <div className="grid grid-cols-2 gap-3">
            {GAMES.map((game) => (
              <ArcadeGameCard
                key={game.type}
                gameType={game.type}
                label={game.label}
                icon={game.icon}
                stat={game.stat}
                highScore={getHighScore(game.type)?.accuracy}
                onSelect={setActiveGame}
              />
            ))}
          </div>

          {/* Return Button */}
          <Button
            variant="outline"
            onClick={() => navigate('/tasks')}
            className="w-full border-white/10 hover:bg-white/5"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return to Quests
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
