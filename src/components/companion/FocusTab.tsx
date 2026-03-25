import { memo, useState } from 'react';
import { FocusTimer } from '@/features/tasks/components/FocusTimer';
import { Sparkles, Timer, Shield } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { ResistModePanel } from './ResistModePanel';
import { cn } from '@/lib/utils';
import type { CompanionLayoutMode } from '@/hooks/useCompanionLayoutMode';

type FocusMode = 'focus' | 'resist';

interface FocusTabProps {
  layoutMode?: CompanionLayoutMode;
}

export const FocusTab = memo(({ layoutMode = 'mobile' }: FocusTabProps) => {
  const [mode, setMode] = useState<FocusMode>('focus');
  const isDesktop = layoutMode === 'desktop';

  if (isDesktop) {
    return (
      <div className="space-y-6 pt-1">
        <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/35 p-4 backdrop-blur-md md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Focus studio</p>
            <p className="text-2xl font-semibold tracking-tight">
              Run focus sessions or resist an urge without leaving your companion.
            </p>
          </div>
          <div className="flex gap-2 rounded-2xl bg-background/40 p-1">
            <Button
              variant={mode === 'focus' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('focus')}
              className="min-w-[116px] gap-2"
            >
              <Timer className="h-4 w-4" />
              Focus
            </Button>
            <Button
              variant={mode === 'resist' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('resist')}
              className="min-w-[116px] gap-2"
            >
              <Shield className="h-4 w-4" />
              Resist
            </Button>
          </div>
        </div>

        {mode === 'focus' ? (
          <div className="space-y-6">
            <GlassCard variant="subtle" className="p-5 text-left space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" />
                <span className="text-sm font-medium">Focus to grow your companion</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Every completed session adds steady XP without pulling attention away from the work.
              </p>
            </GlassCard>

            <FocusTimer />
          </div>
        ) : (
          <ResistModePanel />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <Button
          variant={mode === 'focus' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('focus')}
          className={cn('flex-1 gap-2')}
        >
          <Timer className="h-4 w-4" />
          Focus
        </Button>
        <Button
          variant={mode === 'resist' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('resist')}
          className={cn('flex-1 gap-2')}
        >
          <Shield className="h-4 w-4" />
          Resist
        </Button>
      </div>

      {mode === 'focus' ? (
        <>
          <GlassCard variant="subtle" className="p-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <span className="text-sm font-medium">Focus to grow your companion</span>
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="text-xs text-muted-foreground">
              XP earned from focus sessions helps your companion evolve
            </p>
          </GlassCard>
          
          <FocusTimer />
        </>
      ) : (
        <ResistModePanel />
      )}
    </div>
  );
});

FocusTab.displayName = 'FocusTab';
