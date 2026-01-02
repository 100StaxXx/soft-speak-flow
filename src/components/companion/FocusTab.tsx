import { memo } from 'react';
import { FocusTimer } from '@/features/tasks/components/FocusTimer';
import { Sparkles } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';

export const FocusTab = memo(() => {
  return (
    <div className="space-y-6 mt-6">
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
    </div>
  );
});

FocusTab.displayName = 'FocusTab';
