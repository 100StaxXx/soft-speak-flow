import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ChevronRight, BookOpen, Mail, MapPin } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { StorySeed } from '@/types/narrativeTypes';

interface MilestonePostcardPreviewProps {
  currentProgress: number;
  targetPercent: number;
  milestoneTitle: string;
  chapterNumber: number;
  className?: string;
  compact?: boolean;
  isExpanded?: boolean;
  onClick?: () => void;
  storySeed?: StorySeed | null;
  totalChapters?: number | null;
  companionDisplayName?: string;
}

// Progress tier thresholds
type ProgressTier = 'beginning' | 'building' | 'approaching' | 'close' | 'imminent';

function getProgressTier(progressPercent: number): ProgressTier {
  if (progressPercent >= 95) return 'imminent';
  if (progressPercent >= 75) return 'close';
  if (progressPercent >= 50) return 'approaching';
  if (progressPercent >= 25) return 'building';
  return 'beginning';
}

function getStoryTeaser(
  tier: ProgressTier, 
  chapterNumber: number, 
  storySeed?: StorySeed | null,
  companionDisplayName?: string
): { tagline: string; narrative: string } {
  const chapter = storySeed?.chapter_blueprints?.[chapterNumber - 1];
  const mystery = storySeed?.the_great_mystery;
  const prophecy = storySeed?.the_prophecy?.full_text;
  const characters = chapter?.featured_characters || storySeed?.the_ensemble_cast?.map(c => c.name) || [];
  const featuredCharacter = characters[0];
  const companionLabel = companionDisplayName ? `Your ${companionDisplayName}` : "Your companion";
  
  // Default fallbacks with adventure flavor
  const defaults = {
    beginning: {
      tagline: "The journey begins...",
      narrative: `${companionLabel} senses adventure on the horizon. Each step forward reveals more of your cosmic tale.`
    },
    building: {
      tagline: "A mystery stirs...",
      narrative: "Strange whispers echo through the starlight. Something awaits discovery in the chapters ahead."
    },
    approaching: {
      tagline: "Destiny takes shape...",
      narrative: `The threads of fate weave tighter. ${companionLabel} grows eager to share what they've witnessed.`
    },
    close: {
      tagline: "The path reveals itself...",
      narrative: "A postcard forms in the cosmic winds. Soon you'll glimpse what your companion has seen."
    },
    imminent: {
      tagline: "Almost there...",
      narrative: `${companionLabel} is preparing a message for you. The stars align for a revelation...`
    }
  };

  // Story-driven content when we have StorySeed data
  if (storySeed) {
    switch (tier) {
      case 'beginning':
        return {
          tagline: chapter?.opening_hook 
            ? truncate(chapter.opening_hook, 40)
            : "The journey begins...",
          narrative: mystery?.question 
            ? `A question echoes: "${truncate(mystery.question, 100)}"`
            : chapter?.narrative_purpose
              ? `This chapter explores: ${truncate(chapter.narrative_purpose, 100)}`
              : defaults.beginning.narrative
        };
      
      case 'building':
        return {
          tagline: mystery?.question 
            ? "A riddle stirs in the darkness..."
            : "Something awakens...",
          narrative: prophecy 
            ? `"${truncate(prophecy, 120)}"`
            : chapter?.cliffhanger
              ? `Whispers speak of: ${truncate(chapter.cliffhanger, 100)}`
              : defaults.building.narrative
        };
      
      case 'approaching':
        return {
          tagline: featuredCharacter 
            ? `${featuredCharacter} awaits...`
            : "Paths converge ahead...",
          narrative: chapter?.plot_advancement
            ? truncate(chapter.plot_advancement, 120)
            : featuredCharacter
              ? `You'll soon cross paths with ${featuredCharacter}. What role will they play in your story?`
              : defaults.approaching.narrative
        };
      
      case 'close':
        return {
          tagline: chapter?.title 
            ? truncate(chapter.title, 35)
            : "The path reveals itself...",
          narrative: `${companionLabel} has witnessed something remarkable and is crafting a postcard to share the tale...`
        };
      
      case 'imminent':
        return {
          tagline: "A postcard arrives...",
          narrative: chapter?.title
            ? `Chapter ${chapterNumber}: "${chapter.title}" is about to unlock. A cosmic postcard awaits!`
            : `Chapter ${chapterNumber} is about to unlock. A cosmic postcard awaits!`
        };
    }
  }

  return defaults[tier];
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trim() + '...';
}

function getTierIcon(tier: ProgressTier) {
  switch (tier) {
    case 'imminent': return Mail;
    case 'close': return MapPin;
    case 'approaching': return BookOpen;
    default: return Sparkles;
  }
}

function getTierGlow(tier: ProgressTier): string {
  switch (tier) {
    case 'imminent': return 'shadow-[0_0_20px_rgba(251,191,36,0.4)]';
    case 'close': return 'shadow-[0_0_15px_rgba(251,191,36,0.3)]';
    case 'approaching': return 'shadow-[0_0_10px_rgba(251,191,36,0.2)]';
    default: return '';
  }
}

export function MilestonePostcardPreview({
  currentProgress,
  targetPercent,
  milestoneTitle: _milestoneTitle,
  chapterNumber,
  className,
  compact = false,
  isExpanded = false,
  onClick,
  storySeed,
  totalChapters,
  companionDisplayName,
}: MilestonePostcardPreviewProps) {
  const remaining = Math.max(0, targetPercent - currentProgress);
  const progressTowardMilestone = remaining > 0 
    ? ((currentProgress / targetPercent) * 100) 
    : 100;

  const tier = useMemo(() => getProgressTier(progressTowardMilestone), [progressTowardMilestone]);
  const { tagline, narrative } = useMemo(
    () => getStoryTeaser(tier, chapterNumber, storySeed, companionDisplayName),
    [tier, chapterNumber, storySeed, companionDisplayName]
  );
  
  const TierIcon = getTierIcon(tier);
  const tierGlow = getTierGlow(tier);
  const companionLabel = companionDisplayName ? `Your ${companionDisplayName}` : "Your companion";

  if (compact && !isExpanded) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={onClick}
        className={cn(
          'no-text-select flex items-center gap-2 rounded-lg border border-amber-300/25 bg-slate-950/55 px-3 py-2 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm',
          onClick && 'cursor-pointer hover:border-amber-500/40 transition-colors',
          tierGlow,
          className
        )}
      >
        <motion.div
          animate={tier === 'imminent' ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <TierIcon className={cn(
            "w-4 h-4 text-amber-500",
            tier === 'imminent' && "animate-pulse"
          )} />
        </motion.div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">
            Ch. {chapterNumber}{totalChapters ? `/${totalChapters}` : ''}: {tagline}
          </div>
          <div className="text-[10px] text-white/70">
            {tier === 'imminent' 
              ? "Postcard incoming!" 
              : `${Math.round(remaining)}% to unlock`}
          </div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="w-4 h-4 text-amber-300/70" />
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={onClick}
      className={cn(
        'no-text-select rounded-xl border border-amber-300/25 bg-gradient-to-br from-slate-950/70 via-slate-900/60 to-purple-950/55 p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm',
        onClick && 'cursor-pointer hover:border-amber-500/40 transition-colors',
        tierGlow,
        className
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        <motion.div 
          className={cn(
            "w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500/30 to-orange-500/30 border border-amber-500/40 flex items-center justify-center",
            tier === 'imminent' && "from-amber-500/50 to-orange-500/50"
          )}
          animate={tier === 'imminent' ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <TierIcon className={cn(
            "w-6 h-6 text-amber-500",
            tier === 'imminent' && "animate-pulse"
          )} />
        </motion.div>
        <div className="flex-1">
          <div className="mb-0.5 text-xs font-semibold text-amber-300 drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]">
            {tier === 'imminent' 
              ? "Postcard Arriving Soon!" 
              : tier === 'close' 
                ? "Chapter Nearly Unlocked"
                : "Next Chapter Awaits"}
          </div>
          <p className="text-sm font-semibold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">
            Chapter {chapterNumber}{totalChapters ? ` of ${totalChapters}` : ''}: {tagline}
          </p>
        </div>
      </div>

      {/* Story narrative teaser */}
      <div className="mb-3 rounded-lg border border-white/10 bg-slate-950/65 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <p className="text-[13px] font-medium leading-5 text-white/95 drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]">
          {narrative}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/75">Progress to unlock</span>
          <span className="font-semibold text-white">{Math.round(progressTowardMilestone)}%</span>
        </div>
        <Progress 
          value={progressTowardMilestone} 
          className={cn(
            "h-2 bg-white/15",
            tier === 'imminent' && "bg-amber-300/25"
          )}
        />
        <p className="text-center text-xs text-white/75">
          {tier === 'imminent' 
            ? `${companionLabel} is preparing your postcard...`
            : tier === 'close'
              ? `Just ${Math.round(remaining)}% more to receive a cosmic postcard!`
              : `${Math.round(remaining)}% more to unlock this chapter`
          }
        </p>
      </div>
    </motion.div>
  );
}
