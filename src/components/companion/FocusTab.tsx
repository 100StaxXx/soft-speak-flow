import { memo, useState } from 'react';
import { FocusTimer } from '@/features/tasks/components/FocusTimer';
import { Sparkles, Timer, Shield } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { ResistModePanel } from './ResistModePanel';

type FocusMode = 'focus' | 'resist';

export const FocusTab = memo(() => {
  const [mode, setMode] = useState<FocusMode>('focus');

  return (
    <div className="space-y-6 mt-6">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <Button
          variant={mode === 'focus' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('focus')}
          className="flex-1 gap-2"
        >
          <Timer className="h-4 w-4" />
          Focus
        </Button>
        <Button
          variant={mode === 'resist' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('resist')}
          className="flex-1 gap-2"
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
