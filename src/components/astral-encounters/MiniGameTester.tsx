import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { EnergyBeamGame } from './EnergyBeamGame';
import { TapSequenceGame } from './TapSequenceGame';
import { AstralFrequencyGame } from './AstralFrequencyGame';
import { EclipseTimingGame } from './EclipseTimingGame';
import { StarfallDodgeGame } from './StarfallDodgeGame';
import { RuneResonanceGame } from './RuneResonanceGame';
import { AstralSerpentGame } from './AstralSerpentGame';
import { MiniGameResult, MiniGameType } from '@/types/astralEncounters';
import { Zap, Target, Radio, Moon, Sparkles, Music, X, Trophy, Brain, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const GAMES: { type: MiniGameType; label: string; icon: React.ReactNode; stat: 'mind' | 'body' | 'soul' }[] = [
  { type: 'energy_beam', label: 'Energy Beam', icon: <Zap className="w-4 h-4" />, stat: 'body' },
  { type: 'tap_sequence', label: 'Tap Sequence', icon: <Target className="w-4 h-4" />, stat: 'mind' },
  { type: 'astral_frequency', label: 'Astral Frequency', icon: <Radio className="w-4 h-4" />, stat: 'soul' },
  { type: 'eclipse_timing', label: 'Eclipse Timing', icon: <Moon className="w-4 h-4" />, stat: 'body' },
  { type: 'starfall_dodge', label: 'Starfall Dodge', icon: <Sparkles className="w-4 h-4" />, stat: 'mind' },
  { type: 'rune_resonance', label: 'Rune Resonance', icon: <Music className="w-4 h-4" />, stat: 'soul' },
  { type: 'astral_serpent', label: 'Astral Serpent', icon: <Zap className="w-4 h-4" />, stat: 'body' },
];

interface MiniGameTesterProps {
  companionStats?: { mind: number; body: number; soul: number };
}

export const MiniGameTester = ({ companionStats: initialStats }: MiniGameTesterProps) => {
  const [activeGame, setActiveGame] = useState<MiniGameType | null>(null);
  const [lastResult, setLastResult] = useState<MiniGameResult | null>(null);
  const [questInterval, setQuestInterval] = useState<number>(3);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [companionStats, setCompanionStats] = useState(initialStats || { mind: 50, body: 50, soul: 50 });
  const [resultHistory, setResultHistory] = useState<{ game: MiniGameType; result: MiniGameResult }[]>([]);

  const handleComplete = (result: MiniGameResult) => {
    setLastResult(result);
    if (activeGame) {
      setResultHistory(prev => [...prev.slice(-4), { game: activeGame, result }]);
    }
    setTimeout(() => setActiveGame(null), 1500);
  };

  const questIntervalScale = (questInterval - 3) * 0.15;

  const renderGame = () => {
    const props = { 
      companionStats, 
      onComplete: handleComplete, 
      difficulty,
      questIntervalScale 
    };
    
    switch (activeGame) {
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
      case 'rune_resonance':
        return <RuneResonanceGame {...props} />;
      case 'astral_serpent':
        return <AstralSerpentGame {...props} />;
      default:
        return null;
    }
  };

  const getStatColor = (stat: 'mind' | 'body' | 'soul') => {
    return stat === 'mind' ? 'text-blue-400' : stat === 'body' ? 'text-red-400' : 'text-purple-400';
  };

  const getStatIcon = (stat: 'mind' | 'body' | 'soul') => {
    return stat === 'mind' ? <Brain className="w-3 h-3" /> : stat === 'body' ? <Heart className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />;
  };

  if (activeGame) {
    return (
      <Card className="p-4 relative overflow-hidden">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-50"
          onClick={() => setActiveGame(null)}
        >
          <X className="w-4 h-4" />
        </Button>
        <div className="absolute top-2 left-2 text-xs text-muted-foreground z-50 flex gap-2">
          <span className="px-2 py-0.5 bg-muted rounded-full">{difficulty}</span>
          <span className="px-2 py-0.5 bg-muted rounded-full">
            Quest: {questInterval} ({questIntervalScale > 0 ? '+' : ''}{(questIntervalScale * 100).toFixed(0)}%)
          </span>
        </div>
        {renderGame()}
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Mini-Game Tester
        </h3>
        {resultHistory.length > 0 && (
          <div className="flex gap-1">
            {resultHistory.slice(-5).map((entry, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`w-2 h-2 rounded-full ${
                  entry.result.result === 'perfect' ? 'bg-yellow-500' :
                  entry.result.result === 'good' ? 'bg-green-500' :
                  entry.result.result === 'partial' ? 'bg-orange-500' : 'bg-red-500'
                }`}
                title={`${GAMES.find(g => g.type === entry.game)?.label}: ${entry.result.accuracy}%`}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Last Result */}
      <AnimatePresence>
        {lastResult && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3 rounded-lg text-sm flex items-center justify-between ${
              lastResult.result === 'perfect' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
              lastResult.result === 'good' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
              lastResult.result === 'partial' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 
              'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}
          >
            <span className="font-medium capitalize">{lastResult.result}!</span>
            <span className="text-foreground">{lastResult.accuracy}% accuracy</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Configurator */}
      <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border/50">
        <p className="text-xs font-medium text-muted-foreground">Companion Stats (affects game difficulty)</p>
        
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Brain className="w-4 h-4 text-blue-400" />
            <span className="text-xs w-10 text-blue-400">Mind</span>
            <Slider
              value={[companionStats.mind]}
              onValueChange={([v]) => setCompanionStats(s => ({ ...s, mind: v }))}
              max={100}
              step={5}
              className="flex-1"
            />
            <span className="text-xs w-8 text-right">{companionStats.mind}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Heart className="w-4 h-4 text-red-400" />
            <span className="text-xs w-10 text-red-400">Body</span>
            <Slider
              value={[companionStats.body]}
              onValueChange={([v]) => setCompanionStats(s => ({ ...s, body: v }))}
              max={100}
              step={5}
              className="flex-1"
            />
            <span className="text-xs w-8 text-right">{companionStats.body}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-xs w-10 text-purple-400">Soul</span>
            <Slider
              value={[companionStats.soul]}
              onValueChange={([v]) => setCompanionStats(s => ({ ...s, soul: v }))}
              max={100}
              step={5}
              className="flex-1"
            />
            <span className="text-xs w-8 text-right">{companionStats.soul}</span>
          </div>
        </div>
      </div>

      {/* Difficulty Settings */}
      <div className="flex gap-4">
        <div className="flex-1 space-y-2">
          <p className="text-xs text-muted-foreground">Difficulty</p>
          <div className="flex gap-2">
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <Button
                key={d}
                variant={difficulty === d ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDifficulty(d)}
                className="flex-1 capitalize"
              >
                {d}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <p className="text-xs text-muted-foreground">Quest Interval (2=easier, 4=harder)</p>
          <div className="flex gap-2">
            {([2, 3, 4] as const).map((interval) => (
              <Button
                key={interval}
                variant={questInterval === interval ? 'default' : 'outline'}
                size="sm"
                onClick={() => setQuestInterval(interval)}
                className="flex-1"
              >
                {interval}
              </Button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Game Grid */}
      <div className="grid grid-cols-2 gap-3">
        {GAMES.map((game) => (
          <Button
            key={game.type}
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4 relative overflow-hidden group hover:border-primary/50"
            onClick={() => setActiveGame(game.type)}
          >
            {/* Background glow on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-accent/0 group-hover:from-primary/10 group-hover:to-accent/10 transition-all duration-300" />
            
            <div className="relative flex items-center gap-2">
              {game.icon}
              <span className="font-medium">{game.label}</span>
            </div>
            
            <div className={`flex items-center gap-1 text-xs ${getStatColor(game.stat)}`}>
              {getStatIcon(game.stat)}
              <span className="capitalize">{game.stat} bonus</span>
            </div>
          </Button>
        ))}
      </div>

      {/* Feature callouts */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 bg-muted/30 rounded-lg">
          <span className="text-lg">🎯</span>
          <p className="text-xs text-muted-foreground mt-1">Combo System</p>
        </div>
        <div className="p-2 bg-muted/30 rounded-lg">
          <span className="text-lg">⏸️</span>
          <p className="text-xs text-muted-foreground mt-1">Pause Support</p>
        </div>
        <div className="p-2 bg-muted/30 rounded-lg">
          <span className="text-lg">📳</span>
          <p className="text-xs text-muted-foreground mt-1">Haptic Feedback</p>
        </div>
      </div>
    </Card>
  );
};
