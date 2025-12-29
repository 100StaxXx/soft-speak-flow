import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ChevronRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface MilestonePostcardPreviewProps {
  currentProgress: number;
  targetPercent: number;
  milestoneTitle: string;
  chapterNumber: number;
  className?: string;
  compact?: boolean;
}

export function MilestonePostcardPreview({
  currentProgress,
  targetPercent,
  milestoneTitle,
  chapterNumber,
  className,
  compact = false,
}: MilestonePostcardPreviewProps) {
  const remaining = Math.max(0, targetPercent - currentProgress);
  const progressTowardMilestone = remaining > 0 
    ? ((currentProgress / targetPercent) * 100) 
    : 100;

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20',
          className
        )}
      >
        <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">
            Ch. {chapterNumber}: {milestoneTitle}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {Math.round(remaining)}% to go
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-amber-500/50" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'p-4 rounded-xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-purple-500/10 border border-amber-500/20',
        className
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500/30 to-orange-500/30 border border-amber-500/40 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-amber-500" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium text-amber-600 mb-0.5">
            Next Chapter Unlocks
          </div>
          <p className="font-semibold text-sm">
            Chapter {chapterNumber}: {milestoneTitle}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progress to unlock</span>
          <span className="font-medium">{Math.round(progressTowardMilestone)}%</span>
        </div>
        <Progress 
          value={progressTowardMilestone} 
          className="h-2 bg-amber-500/10"
        />
        <p className="text-xs text-muted-foreground text-center">
          {remaining <= 5 
            ? "Almost there! Your companion is preparing a postcard..." 
            : `${Math.round(remaining)}% more to unlock this chapter`
          }
        </p>
      </div>
    </motion.div>
  );
}
