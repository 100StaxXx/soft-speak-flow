import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';
import { Clock, Trophy, XCircle, Star, Sparkles } from 'lucide-react';
import { AstralEncounter } from '@/types/astralEncounters';
import { format } from 'date-fns';
import { formatDisplayLabel } from '@/lib/utils';

interface EncounterHistoryProps {
  encounters: AstralEncounter[];
}

const RESULT_CONFIG: Record<string, { icon: typeof Trophy; color: string; label: string }> = {
  perfect: { icon: Trophy, color: 'text-amber-400', label: 'Perfect' },
  good: { icon: Star, color: 'text-primary', label: 'Victory' },
  partial: { icon: Sparkles, color: 'text-blue-400', label: 'Partial' },
  fail: { icon: XCircle, color: 'text-red-400', label: 'Escaped' },
};

export const EncounterHistory = ({ encounters }: EncounterHistoryProps) => {
  const completedEncounters = encounters.filter(e => e.completed_at);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-semibold">Recent Encounters</h3>
      </div>

      {completedEncounters.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No encounters yet</p>
          <p className="text-sm mt-1">Complete 20 quests to trigger your first encounter</p>
        </Card>
      ) : (
        <ScrollArea className="h-80">
          <div className="space-y-2">
            {completedEncounters.map((encounter, index) => {
              const config = RESULT_CONFIG[encounter.result || 'fail'];
              const Icon = config.icon;

              return (
                <motion.div
                  key={encounter.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg bg-muted ${config.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">{encounter.adversary_name}</p>
                          <span className={`text-xs font-medium ${config.color}`}>
                            {config.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{formatDisplayLabel(encounter.adversary_tier)}</span>
                          <span>•</span>
                          <span>{encounter.accuracy_score || 0}% accuracy</span>
                          {encounter.xp_earned > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-primary">+{encounter.xp_earned} XP</span>
                            </>
                          )}
                        </div>
                        {encounter.essence_earned && (
                          <p className="text-xs text-green-500 mt-1">
                            ✨ {encounter.essence_earned}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {encounter.completed_at && format(new Date(encounter.completed_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
