import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, MapPin, Book, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { JourneyMilestone } from '@/hooks/useJourneySchedule';

interface PostcardPreviewProps {
  milestones: JourneyMilestone[];
  storyType?: string | null;
  className?: string;
}

export const PostcardPreview = memo(function PostcardPreview({ milestones, storyType, className }: PostcardPreviewProps) {
  const postcardMilestones = useMemo(() => 
    milestones.filter(m => m.isPostcardMilestone),
    [milestones]
  );

  if (postcardMilestones.length === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Book className="w-4 h-4 text-primary" />
        <span className="font-medium text-sm">Your Story Chapters</span>
        <Badge variant="secondary" className="text-xs ml-auto">
          {postcardMilestones.length} chapters
        </Badge>
      </div>

      <div className="grid gap-2">
        {postcardMilestones.map((milestone, index) => (
          <motion.div
            key={milestone.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative overflow-hidden rounded-lg border bg-gradient-to-r from-amber-500/5 to-orange-500/5 p-3"
          >
            {/* Shimmer effect for unrevealed content */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
            
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-amber-500" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-amber-600">
                    Chapter {index + 1}
                  </span>
                  <Star className="w-3 h-3 text-amber-500" />
                </div>
                <p className="font-medium text-sm truncate">{milestone.title}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                  <MapPin className="w-3 h-3" />
                  <span className="italic">Location revealed on completion</span>
                </div>
              </div>
              
              <Badge variant="outline" className="text-[10px] flex-shrink-0">
                {milestone.milestonePercent}%
              </Badge>
            </div>
          </motion.div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Complete milestones to unlock cosmic postcards from your companion's journey
      </p>
    </div>
  );
});
