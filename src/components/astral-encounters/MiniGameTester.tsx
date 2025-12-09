import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EnergyBeamGame, TapSequenceGame, BreathSyncGame, QuickSwipeGame } from './index';
import { MiniGameResult, MiniGameType } from '@/types/astralEncounters';
import { Zap, Target, Wind, ArrowUpDown, X } from 'lucide-react';

const GAMES: { type: MiniGameType; label: string; icon: React.ReactNode }[] = [
  { type: 'energy_beam', label: 'Energy Beam', icon: <Zap className="w-4 h-4" /> },
  { type: 'tap_sequence', label: 'Tap Sequence', icon: <Target className="w-4 h-4" /> },
  { type: 'breath_sync', label: 'Breath Sync', icon: <Wind className="w-4 h-4" /> },
  { type: 'quick_swipe', label: 'Quick Swipe', icon: <ArrowUpDown className="w-4 h-4" /> },
];

interface MiniGameTesterProps {
  companionStats?: { mind: number; body: number; soul: number };
}

export const MiniGameTester = ({ companionStats = { mind: 10, body: 10, soul: 10 } }: MiniGameTesterProps) => {
  const [activeGame, setActiveGame] = useState<MiniGameType | null>(null);
  const [lastResult, setLastResult] = useState<MiniGameResult | null>(null);
  const [questInterval, setQuestInterval] = useState<2 | 3 | 4>(3);

  const handleComplete = (result: MiniGameResult) => {
    setLastResult(result);
    setTimeout(() => setActiveGame(null), 2000);
  };

  // Convert quest interval to scale: 2 = -0.15, 3 = 0, 4 = +0.15
  const questIntervalScale = (questInterval - 3) * 0.15;

  const renderGame = () => {
    const props = { 
      companionStats, 
      onComplete: handleComplete, 
      difficulty: 'medium' as const,
      questIntervalScale 
    };
    
    switch (activeGame) {
      case 'energy_beam':
        return <EnergyBeamGame {...props} />;
      case 'tap_sequence':
        return <TapSequenceGame {...props} />;
      case 'breath_sync':
        return <BreathSyncGame {...props} />;
      case 'quick_swipe':
        return <QuickSwipeGame {...props} />;
      default:
        return null;
    }
  };

  if (activeGame) {
    return (
      <Card className="p-4 relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-10"
          onClick={() => setActiveGame(null)}
        >
          <X className="w-4 h-4" />
        </Button>
        <div className="absolute top-2 left-2 text-xs text-muted-foreground">
          Quest Interval: {questInterval} ({questIntervalScale > 0 ? '+' : ''}{(questIntervalScale * 100).toFixed(0)}%)
        </div>
        {renderGame()}
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <h3 className="font-semibold text-lg">Mini-Game Tester</h3>
      
      {lastResult && (
        <div className={`p-3 rounded-lg text-sm ${lastResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          Last result: {lastResult.result} ({lastResult.accuracy}% accuracy)
        </div>
      )}

      {/* Quest Interval Selector */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Quest Interval (2=easier, 4=harder)</p>
        <div className="flex gap-2">
          {([2, 3, 4] as const).map((interval) => (
            <Button
              key={interval}
              variant={questInterval === interval ? 'default' : 'outline'}
              size="sm"
              onClick={() => setQuestInterval(interval)}
            >
              {interval} quests
            </Button>
          ))}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {GAMES.map((game) => (
          <Button
            key={game.type}
            variant="outline"
            className="flex items-center gap-2 h-auto py-3"
            onClick={() => setActiveGame(game.type)}
          >
            {game.icon}
            {game.label}
          </Button>
        ))}
      </div>
    </Card>
  );
};
