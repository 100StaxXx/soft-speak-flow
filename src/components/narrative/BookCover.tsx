import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Star, Trophy, Sword } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CompletedBook, StoryTypeSlug } from "@/types/narrativeTypes";

const storyTypeColors: Record<StoryTypeSlug, string> = {
  treasure_hunt: "from-amber-600 via-yellow-500 to-amber-700",
  mystery: "from-purple-600 via-indigo-500 to-purple-700",
  pilgrimage: "from-cyan-600 via-teal-500 to-cyan-700",
  heroes_journey: "from-red-600 via-orange-500 to-red-700",
  rescue_mission: "from-pink-600 via-rose-500 to-pink-700",
  exploration: "from-emerald-600 via-green-500 to-emerald-700",
};

const storyTypeIcons: Record<StoryTypeSlug, string> = {
  treasure_hunt: "🗺️",
  mystery: "🔮",
  pilgrimage: "🧭",
  heroes_journey: "⚔️",
  rescue_mission: "💖",
  exploration: "🏔️",
};

interface BookCoverProps {
  book: CompletedBook;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
}

export const BookCover = ({ book, onClick, size = "md" }: BookCoverProps) => {
  const storyType = (book.story_type_slug || "heroes_journey") as StoryTypeSlug;
  const gradient = storyTypeColors[storyType] || storyTypeColors.heroes_journey;
  const icon = storyTypeIcons[storyType] || "📖";

  const sizeClasses = {
    sm: "w-24 h-36",
    md: "w-32 h-48",
    lg: "w-40 h-60",
  };

  const titleSize = {
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-sm",
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05, rotateY: 5 }}
      whileTap={{ scale: 0.98 }}
      className="cursor-pointer perspective-1000"
      onClick={onClick}
    >
      <Card
        className={cn(
          sizeClasses[size],
          "relative overflow-hidden border-2 border-primary/20",
          "bg-gradient-to-br shadow-lg",
          gradient
        )}
        style={{
          boxShadow: "4px 4px 15px rgba(0,0,0,0.3), inset 0 0 30px rgba(255,255,255,0.1)",
        }}
      >
        {/* Book spine effect */}
        <div className="absolute left-0 top-0 bottom-0 w-3 bg-black/20" />
        
        {/* Decorative border */}
        <div className="absolute inset-2 border border-white/20 rounded-sm pointer-events-none" />
        
        {/* Story type icon */}
        <div className="absolute top-3 right-3 text-xl opacity-80">
          {icon}
        </div>

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-between p-3 pl-5">
          {/* Title area */}
          <div className="mt-6">
            <h4 className={cn(
              "font-bold text-white leading-tight line-clamp-3",
              titleSize[size]
            )}>
              {book.book_title}
            </h4>
          </div>

          {/* Bottom info */}
          <div className="space-y-1">
            {book.boss_defeated_name && (
              <div className="flex items-center gap-1">
                <Sword className="w-3 h-3 text-white/70" />
                <span className="text-[9px] text-white/70 truncate">
                  {book.boss_defeated_name}
                </span>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <Badge 
                variant="secondary" 
                className="text-[8px] px-1 py-0 bg-white/20 text-white border-0"
              >
                {book.total_chapters} Ch
              </Badge>
              
              {book.companion_name && (
                <span className="text-[8px] text-white/60 truncate max-w-[60%]">
                  w/ {book.companion_name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Completion star */}
        <motion.div
          className="absolute -top-1 -right-1"
          initial={{ rotate: -20 }}
          animate={{ rotate: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Star className="w-5 h-5 text-yellow-300 fill-yellow-300 drop-shadow-lg" />
        </motion.div>

        {/* Glossy overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20 pointer-events-none" />
      </Card>
    </motion.div>
  );
};
