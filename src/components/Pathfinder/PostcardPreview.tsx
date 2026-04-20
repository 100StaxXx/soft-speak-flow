import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, MapPin, Book, Star } from 'lucide-react';
import { plannerPathfinderTheme } from '@/components/companion/plannerPathfinderTheme';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { JourneyMilestone } from '@/hooks/useJourneySchedule';

interface PostcardPreviewProps {
  milestones: JourneyMilestone[];
  storyType?: string | null;
  className?: string;
}

export const PostcardPreview = memo(function PostcardPreview({ milestones, storyType: _storyType, className }: PostcardPreviewProps) {
  const postcardMilestones = useMemo(() => 
    milestones.filter(m => m.isPostcardMilestone),
    [milestones]
  );

  if (postcardMilestones.length === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      <div className={cn(plannerPathfinderTheme.raisedPanel, "flex items-center gap-2 p-4")}>
        <Book className="w-4 h-4 text-[#8d481c]" />
        <span className="font-medium text-sm">Your Story Chapters</span>
        <Badge variant="outline" className={cn(plannerPathfinderTheme.chip, "ml-auto text-xs")}>
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
            className={cn(plannerPathfinderTheme.mutedPanel, "relative overflow-hidden p-3")}
          >
            {/* Shimmer effect for unrevealed content */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
            
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[1rem] border-[3px] border-[#d38b22] bg-[linear-gradient(180deg,#fff2bd_0%,#ffd46d_100%)]">
                <Sparkles className="w-5 h-5 text-[#c67b17]" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-[#c67b17]">
                    Chapter {index + 1}
                  </span>
                  <Star className="w-3 h-3 text-[#d38b22]" />
                </div>
                <p className="font-medium text-sm truncate">{milestone.title}</p>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-[#7f4a1d]/80">
                  <MapPin className="w-3 h-3" />
                  <span className="italic">Location revealed on completion</span>
                </div>
              </div>
              
              <Badge variant="outline" className={cn(plannerPathfinderTheme.chip, "flex-shrink-0 text-[10px]")}>
                {milestone.milestonePercent}%
              </Badge>
            </div>
          </motion.div>
        ))}
      </div>

      <p className="text-center text-xs text-[#7f4a1d]/80">
        Complete milestones to unlock cosmic postcards from your companion's journey
      </p>
    </div>
  );
});
