import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { EnergyBeamGame } from './EnergyBeamGame';
import { TapSequenceGame } from './TapSequenceGame';
import { BreathSyncGame } from './BreathSyncGame';
import { QuickSwipeGame } from './QuickSwipeGame';
import { ConstellationTraceGame } from './ConstellationTraceGame';
import { ShieldBarrierGame } from './ShieldBarrierGame';
import { GravityBalanceGame } from './GravityBalanceGame';
import { MiniGameResult, MiniGameType } from '@/types/astralEncounters';
import { Zap, Target, Wind, ArrowUpDown, X, Sparkles, Shield, Scale } from 'lucide-react';

const GAMES: { 
  type: MiniGameType; 
  label: string; 
  icon: React.ReactNode;
  description: string;
  stat: string;
  tone: 'mind' | 'body' | 'soul' | 'hybrid';
}[] = [
  { type: 'energy_beam', label: 'Energy Beam', icon: <Zap className="w-4 h-4" />, description: 'Charge and release inside the harmonic band.', stat: 'Body focus', tone: 'body' },
  { type: 'tap_sequence', label: 'Tap Sequence', icon: <Target className="w-4 h-4" />, description: 'Memorize the light path before repeating it.', stat: 'Mind memory', tone: 'mind' },
  { type: 'breath_sync', label: 'Breath Sync', icon: <Wind className="w-4 h-4" />, description: 'Tap at the apex of each inhale/hold/exhale.', stat: 'Soul calm', tone: 'soul' },
  { type: 'quick_swipe', label: 'Quick Swipe', icon: <ArrowUpDown className="w-4 h-4" />, description: 'Swipe with the incoming strike before it lands.', stat: 'Mind + Body', tone: 'hybrid' },
  { type: 'constellation_trace', label: 'Constellation', icon: <Sparkles className="w-4 h-4" />, description: 'Connect fading stars in order.', stat: 'Soul focus', tone: 'soul' },
  { type: 'shield_barrier', label: 'Shield Barrier', icon: <Shield className="w-4 h-4" />, description: 'Raise the proper shield just in time.', stat: 'Body timing', tone: 'body' },
  { type: 'gravity_balance', label: 'Gravity Balance', icon: <Scale className="w-4 h-4" />, description: 'Counter drifting gravity to stay centered.', stat: 'Mind balance', tone: 'mind' },
];

const STAT_TONE_CLASSES: Record<'mind' | 'body' | 'soul' | 'hybrid', string> = {
  mind: 'bg-violet-500/15 text-violet-200 border-violet-500/30',
  body: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
  soul: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
  hybrid: 'bg-cyan-500/15 text-cyan-200 border-cyan-500/30',
};

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
  const questScalePercent = (questIntervalScale * 100).toFixed(0);
  const questScaleLabel = questIntervalScale === 0 
    ? 'Balanced pacing'
    : questIntervalScale > 0
      ? 'Harder cadence'
      : 'Eased cadence';

  const renderQuestIntervalSelector = (variant: 'default' | 'compact' = 'default') => (
    <div className={`flex ${variant === 'compact' ? 'gap-1' : 'gap-2'}`}>
      {([2, 3, 4] as const).map((interval) => (
        <Button
          key={interval}
          variant={questInterval === interval ? 'default' : 'outline'}
          size="sm"
          className={variant === 'compact' ? 'px-3' : 'flex-1'}
          onClick={() => setQuestInterval(interval)}
        >
          {variant === 'compact' ? interval : `${interval} quests`}
        </Button>
      ))}
    </div>
  );

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
      case 'constellation_trace':
        return <ConstellationTraceGame {...props} />;
      case 'shield_barrier':
        return <ShieldBarrierGame {...props} />;
      case 'gravity_balance':
        return <GravityBalanceGame {...props} />;
      default:
        return null;
    }
  };

  if (activeGame) {
    const activeMeta = GAMES.find((game) => game.type === activeGame);
    return (
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Testing</p>
            <div className="flex items-center gap-2 text-lg font-semibold">
              <span className="text-primary">{activeMeta?.icon}</span>
              <span>{activeMeta?.label ?? 'Mini-game'}</span>
              {activeMeta && (
                <Badge 
                  variant="outline" 
                  className={STAT_TONE_CLASSES[activeMeta.tone]}
                >
                  {activeMeta.stat}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">{renderQuestIntervalSelector('compact')}</div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveGame(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Quest interval {questInterval} ({questIntervalScale > 0 ? '+' : ''}{questScalePercent}%)</span>
          <span>•</span>
          <span>{questScaleLabel}</span>
          <span>•</span>
          <span>Mind {companionStats.mind} / Body {companionStats.body} / Soul {companionStats.soul}</span>
        </div>
        <div className="rounded-3xl border border-border/60 bg-muted/5 p-3">
          {renderGame()}
        </div>
        <div className="sm:hidden space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Quest Interval</p>
          {renderQuestIntervalSelector()}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 space-y-5">
      <div>
        <h3 className="font-semibold text-lg">Mini-Game Tester</h3>
        <p className="text-sm text-muted-foreground">
          Quickly preview encounter mini-games with live companion stats.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(companionStats) as Array<keyof typeof companionStats>).map((stat) => (
          <div key={stat} className="rounded-2xl border border-border/50 bg-muted/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{stat}</p>
            <p className="text-lg font-semibold">{companionStats[stat]}</p>
          </div>
        ))}
      </div>

      {lastResult && (
        <div className={`rounded-2xl border px-3 py-3 ${lastResult.success ? 'border-green-500/40 bg-green-500/10' : 'border-red-500/40 bg-red-500/10'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Last result</p>
              <p className="text-sm font-semibold capitalize">{lastResult.result}</p>
            </div>
            <Badge variant="outline" className={lastResult.success ? 'border-green-500/40 text-green-400' : 'border-red-500/40 text-red-400'}>
              {lastResult.success ? 'Success' : 'Retry'}
            </Badge>
          </div>
          <Progress value={lastResult.accuracy} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-1">{lastResult.accuracy}% accuracy</p>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Quest Interval (2 = easier, 4 = harder)</p>
          <span className="text-xs text-muted-foreground">{questScaleLabel}</span>
        </div>
        {renderQuestIntervalSelector()}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {GAMES.map((game) => (
          <button
            key={game.type}
            type="button"
            onClick={() => setActiveGame(game.type)}
            className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-left transition hover:border-primary/60 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-foreground">
                <span className="text-primary">{game.icon}</span>
                <span className="font-semibold">{game.label}</span>
              </div>
              <Badge variant="outline" className={STAT_TONE_CLASSES[game.tone]}>
                {game.stat}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{game.description}</p>
          </button>
        ))}
      </div>
    </Card>
  );
};