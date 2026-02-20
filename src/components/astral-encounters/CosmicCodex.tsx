import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';
import { BookOpen, Skull, Sparkles, Trophy } from 'lucide-react';
import { CosmicCodexEntry, AdversaryEssence } from '@/types/astralEncounters';
import { formatDisplayLabel } from '@/lib/utils';

interface CosmicCodexProps {
  codexEntries: CosmicCodexEntry[];
  essences: AdversaryEssence[];
  totalStatBoosts: { mind: number; body: number; soul: number };
  isLoading?: boolean;
}

const THEME_ICONS: Record<string, string> = {
  distraction: '🌀',
  chaos: '⚡',
  stagnation: '🪨',
  laziness: '💤',
  anxiety: '🌪️',
  overthinking: '🔄',
  doubt: '👤',
  fear: '👁️',
};

export const CosmicCodex = ({ codexEntries, essences, totalStatBoosts, isLoading }: CosmicCodexProps) => {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30 animate-pulse">
          <div className="h-6 w-32 bg-muted rounded mb-4" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </Card>
        <div className="h-64 bg-muted/30 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <Card className="p-4 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold">Cosmic Codex</h2>
        </div>
        
        {/* Total stat boosts from essences */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-background/50">
            <p className="text-xs text-muted-foreground">Mind Boost</p>
            <p className="text-lg font-bold text-blue-400">+{totalStatBoosts.mind}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-background/50">
            <p className="text-xs text-muted-foreground">Body Boost</p>
            <p className="text-lg font-bold text-green-400">+{totalStatBoosts.body}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-background/50">
            <p className="text-xs text-muted-foreground">Soul Boost</p>
            <p className="text-lg font-bold text-purple-400">+{totalStatBoosts.soul}</p>
          </div>
        </div>
      </Card>

      {/* Bestiary */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Skull className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">Adversary Bestiary</h3>
          <span className="text-xs text-muted-foreground">({codexEntries.length} discovered)</span>
        </div>

        {codexEntries.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            <Skull className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No adversaries defeated yet</p>
            <p className="text-sm mt-1">Complete quests to trigger encounters</p>
          </Card>
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {codexEntries.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">
                        {THEME_ICONS[entry.adversary_theme] || '❓'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">{entry.adversary_name}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Trophy className="w-3 h-3" />
                            <span>×{entry.times_defeated}</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDisplayLabel(entry.adversary_theme)} type
                        </p>
                        {entry.adversary_lore && (
                          <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">
                            "{entry.adversary_lore}"
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Essence Collection */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Essence Collection</h3>
          <span className="text-xs text-muted-foreground">({essences.length} absorbed)</span>
        </div>

        {essences.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No essences collected yet</p>
            <p className="text-sm mt-1">Defeat adversaries to absorb their power</p>
          </Card>
        ) : (
          <ScrollArea className="h-64">
            <div className="grid grid-cols-2 gap-2">
              {essences.map((essence, index) => (
                <motion.div
                  key={essence.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className={`p-3 border-l-4 ${
                    essence.stat_type === 'mind' 
                      ? 'border-l-blue-500' 
                      : essence.stat_type === 'body'
                        ? 'border-l-green-500'
                        : 'border-l-purple-500'
                  }`}>
                    <p className="font-medium text-sm truncate">{essence.essence_name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatDisplayLabel(essence.stat_type)}
                      </span>
                      <span className={`text-xs font-bold ${
                        essence.stat_type === 'mind' 
                          ? 'text-blue-400' 
                          : essence.stat_type === 'body'
                            ? 'text-green-400'
                            : 'text-purple-400'
                      }`}>
                        +{essence.stat_boost}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">
                      from {essence.adversary_name}
                    </p>
                  </Card>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};
