import { memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Sparkles, Trophy, Heart, RefreshCw, Star } from "lucide-react";
import { useCompanionMemories, MemoryType, CompanionMemory } from "@/hooks/useCompanionMemories";
import { useCompanionAuraColors } from "@/hooks/useCompanionAuraColors";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

interface MemoryTimelineProps {
  className?: string;
  limit?: number;
}

// Memory type to icon/color mapping
const MEMORY_ICONS: Record<MemoryType, { icon: typeof Sparkles; color: string }> = {
  first_meeting: { icon: Heart, color: 'text-pink-400' },
  first_evolution: { icon: Sparkles, color: 'text-amber-400' },
  evolution: { icon: Sparkles, color: 'text-purple-400' },
  milestone: { icon: Trophy, color: 'text-yellow-400' },
  streak: { icon: Star, color: 'text-orange-400' },
  recovery: { icon: RefreshCw, color: 'text-green-400' },
  challenge_complete: { icon: Trophy, color: 'text-blue-400' },
  epic_complete: { icon: Star, color: 'text-cyan-400' },
  special_moment: { icon: Heart, color: 'text-rose-400' },
  bond_milestone: { icon: Heart, color: 'text-primary' },
};

// Memory type to display name
const MEMORY_NAMES: Record<MemoryType, string> = {
  first_meeting: 'First Meeting',
  first_evolution: 'First Evolution',
  evolution: 'Evolution',
  milestone: 'Milestone',
  streak: 'Streak Achievement',
  recovery: 'Recovery',
  challenge_complete: 'Challenge Complete',
  epic_complete: 'Epic Complete',
  special_moment: 'Special Moment',
  bond_milestone: 'Bond Milestone',
};

/**
 * Displays a timeline of companion memories.
 * Shows special moments, milestones, and shared experiences.
 */
export const MemoryTimeline = memo(({ className, limit = 10 }: MemoryTimelineProps) => {
  const { specialMemories, isLoading } = useCompanionMemories();
  const { primaryAura } = useCompanionAuraColors();

  const displayMemories = useMemo(() => {
    return specialMemories.slice(0, limit);
  }, [specialMemories, limit]);

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-card/30 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (displayMemories.length === 0) {
    return (
      <div className={cn(
        "text-center py-8 text-muted-foreground",
        className
      )}>
        <Heart className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No memories yet...</p>
        <p className="text-xs opacity-70">Keep spending time together!</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <AnimatePresence mode="popLayout">
        {displayMemories.map((memory, index) => (
          <MemoryCard
            key={memory.id}
            memory={memory}
            index={index}
            primaryAura={primaryAura}
          />
        ))}
      </AnimatePresence>
    </div>
  );
});

MemoryTimeline.displayName = 'MemoryTimeline';

// Individual memory card
interface MemoryCardProps {
  memory: CompanionMemory;
  index: number;
  primaryAura: string;
}

const MemoryCard = memo(({ memory, index, primaryAura }: MemoryCardProps) => {
  const config = MEMORY_ICONS[memory.memory_type] || MEMORY_ICONS.special_moment;
  const IconComponent = config.icon;
  const context = memory.memory_context;

  const formattedDate = useMemo(() => {
    try {
      return format(parseISO(memory.memory_date), 'MMM d, yyyy');
    } catch {
      return memory.memory_date;
    }
  }, [memory.memory_date]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "relative flex items-start gap-3 p-3 rounded-xl",
        "bg-card/30 border border-border/30",
        "hover:bg-card/50 transition-colors"
      )}
    >
      {/* Timeline dot */}
      <div
        className={cn(
          "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
          "bg-background/50"
        )}
        style={{
          boxShadow: `0 0 12px ${primaryAura}`,
        }}
      >
        <IconComponent className={cn("w-5 h-5", config.color)} />
      </div>

      {/* Memory content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-foreground">
            {context?.title || MEMORY_NAMES[memory.memory_type]}
          </span>
        </div>
        
        {context?.description && (
          <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
            {context.description}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
          <Calendar className="w-3 h-3" />
          <span>{formattedDate}</span>
        </div>
      </div>

      {/* Emotion indicator */}
      {context?.emotion && (
        <div className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-muted/30 capitalize">
          {context.emotion}
        </div>
      )}
    </motion.div>
  );
});

MemoryCard.displayName = 'MemoryCard';
