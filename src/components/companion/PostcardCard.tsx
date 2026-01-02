import { motion } from "framer-motion";
import { MapPin, Calendar, BookOpen, Sparkles, Crown } from "lucide-react";
import { CompanionPostcard } from "@/hooks/useCompanionPostcards";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { StoryTypeSlug } from "@/types/narrativeTypes";

interface PostcardCardProps {
  postcard: CompanionPostcard;
  onClick: () => void;
}

const storyTypeColors: Record<StoryTypeSlug, string> = {
  treasure_hunt: "from-amber-500/30 to-yellow-500/30 border-amber-500/40",
  mystery: "from-purple-500/30 to-indigo-500/30 border-purple-500/40",
  pilgrimage: "from-cyan-500/30 to-teal-500/30 border-cyan-500/40",
  heroes_journey: "from-red-500/30 to-orange-500/30 border-red-500/40",
  rescue_mission: "from-pink-500/30 to-rose-500/30 border-pink-500/40",
  exploration: "from-emerald-500/30 to-green-500/30 border-emerald-500/40",
};

const storyTypeIcons: Record<StoryTypeSlug, string> = {
  treasure_hunt: "🗺️",
  mystery: "🔮",
  pilgrimage: "🧭",
  heroes_journey: "⚔️",
  rescue_mission: "💖",
  exploration: "🏔️",
};

// Fallback colors for non-narrative postcards
const milestoneColors: Record<number, string> = {
  25: "from-blue-500/20 to-cyan-500/20 border-blue-500/30",
  50: "from-purple-500/20 to-pink-500/20 border-purple-500/30",
  75: "from-orange-500/20 to-yellow-500/20 border-orange-500/30",
  100: "from-yellow-400/20 to-amber-500/20 border-yellow-500/30",
};

export const PostcardCard = ({ postcard, onClick }: PostcardCardProps) => {
  const storyType = 'story_type_slug' in postcard 
    ? (postcard.story_type_slug as StoryTypeSlug | undefined) 
    : undefined;
  const hasNarrativeContent = !!(postcard.chapter_title || postcard.story_content);
  const isFinale = postcard.is_finale;
  
  // Use special finale styling, story type colors, or fallback to milestone colors
  const colorClass = isFinale
    ? "from-yellow-500/40 to-amber-600/40 border-yellow-400/60"
    : storyType 
      ? storyTypeColors[storyType] || storyTypeColors.heroes_journey
      : milestoneColors[postcard.milestone_percent] || milestoneColors[25];

  const icon = storyType ? storyTypeIcons[storyType] : null;

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative w-full aspect-[4/3] rounded-xl overflow-hidden",
        "bg-gradient-to-br border",
        colorClass,
        "group cursor-pointer",
        isFinale && "ring-2 ring-yellow-400/50 shadow-lg shadow-yellow-500/20"
      )}
    >
      {/* Image */}
      <img
        src={postcard.image_url}
        alt={postcard.location_name}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Overlay gradient */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent",
        isFinale && "from-black/90 via-yellow-900/20 to-transparent"
      )} />

      {/* Top badges */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
        {/* Chapter badge or Finale crown */}
        {isFinale ? (
          <div className="px-2 py-0.5 rounded-full bg-yellow-500/80 backdrop-blur-sm flex items-center gap-1">
            <Crown className="w-3 h-3 text-yellow-900" />
            <span className="text-[10px] font-bold text-yellow-900">
              FINALE
            </span>
          </div>
        ) : postcard.chapter_number ? (
          <div className="px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm flex items-center gap-1">
            <BookOpen className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-medium text-white">
              Ch. {postcard.chapter_number}
            </span>
          </div>
        ) : null}
        
        {/* Story type or milestone badge */}
        <div className="px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm flex items-center gap-1 ml-auto">
          {icon ? (
            <span className="text-xs">{icon}</span>
          ) : (
            <Sparkles className="w-3 h-3 text-yellow-400" />
          )}
          <span className="text-xs font-bold text-white">
            {postcard.milestone_percent}%
          </span>
        </div>
      </div>

      {/* Content indicator */}
      {hasNarrativeContent && !isFinale && (
        <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-primary animate-pulse" />
      )}

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        {/* Chapter title */}
        {postcard.chapter_title && (
          <h4 className={cn(
            "text-xs font-semibold text-white mb-0.5 line-clamp-1",
            isFinale && "text-yellow-200"
          )}>
            {postcard.chapter_title}
          </h4>
        )}
        
        <div className="flex items-center gap-1 mb-1">
          <MapPin className={cn("w-3 h-3", isFinale ? "text-yellow-400" : "text-primary")} />
          <span className="text-xs font-medium text-white truncate">
            {postcard.location_name}
          </span>
        </div>
        <div className="flex items-center gap-1 text-white/60">
          <Calendar className="w-3 h-3" />
          <span className="text-[10px]">
            {format(new Date(postcard.generated_at), "MMM d, yyyy")}
          </span>
        </div>
      </div>

      {/* Finale glow effect */}
      {isFinale && (
        <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/10 via-transparent to-yellow-500/5 pointer-events-none" />
      )}

      {/* Hover shine effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-tr from-white/0 via-white/10 to-white/0" />
    </motion.button>
  );
};
