import { motion } from "framer-motion";
import { Check, Star, Clock, Zap, Brain, Heart, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestCardProps {
  id: string;
  text: string;
  completed: boolean;
  xpReward: number;
  isMainQuest?: boolean;
  difficulty?: "easy" | "medium" | "hard";
  category?: "mind" | "body" | "soul" | null;
  scheduledTime?: string | null;
  estimatedDuration?: number | null;
  onToggle: (id: string, completed: boolean) => void;
  onEdit?: () => void;
}

const difficultyConfig = {
  easy: { color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30" },
  medium: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  hard: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
};

const categoryIcons = {
  mind: Brain,
  body: Dumbbell,
  soul: Heart,
};

export function QuestCard({
  id,
  text,
  completed,
  xpReward,
  isMainQuest,
  difficulty = "medium",
  category,
  scheduledTime,
  estimatedDuration,
  onToggle,
  onEdit,
}: QuestCardProps) {
  const diffStyle = difficultyConfig[difficulty];
  const CategoryIcon = category ? categoryIcons[category] : null;

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours, 10);
    const suffix = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${suffix}`;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "group relative flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer",
        "bg-card/80 backdrop-blur-sm hover:bg-card",
        completed 
          ? "border-border/30 opacity-70" 
          : diffStyle.border,
        isMainQuest && !completed && "ring-1 ring-stardust-gold/30 shadow-glow"
      )}
      onClick={onEdit}
    >
      {/* Main quest glow effect */}
      {isMainQuest && !completed && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-stardust-gold/5 to-transparent pointer-events-none" />
      )}

      {/* Checkbox with XP burst animation */}
      <motion.button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(id, !completed);
        }}
        className={cn(
          "relative flex-shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all",
          completed
            ? "bg-primary border-primary text-primary-foreground"
            : "border-primary/50 hover:border-primary hover:bg-primary/10"
        )}
        whileTap={{ scale: 0.9 }}
      >
        {completed && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500 }}
          >
            <Check className="h-3 w-3" />
          </motion.div>
        )}
      </motion.button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isMainQuest && (
            <Star className="h-3.5 w-3.5 text-stardust-gold fill-stardust-gold flex-shrink-0" />
          )}
          <p className={cn(
            "text-sm font-medium truncate",
            completed && "line-through text-muted-foreground"
          )}>
            {text}
          </p>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-1">
          {scheduledTime && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatTime(scheduledTime)}
            </span>
          )}
          {estimatedDuration && (
            <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
              {estimatedDuration}m
            </span>
          )}
        </div>
      </div>

      {/* Right side: category + XP */}
      <div className="flex items-center gap-2">
        {CategoryIcon && (
          <div className={cn(
            "h-6 w-6 rounded-full flex items-center justify-center",
            category === "mind" && "bg-category-mind/20 text-category-mind",
            category === "body" && "bg-category-body/20 text-category-body",
            category === "soul" && "bg-category-soul/20 text-category-soul"
          )}>
            <CategoryIcon className="h-3 w-3" />
          </div>
        )}

        {/* XP badge */}
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
          completed 
            ? "bg-primary/20 text-primary" 
            : diffStyle.bg + " " + diffStyle.color
        )}>
          <Zap className="h-3 w-3" />
          {xpReward}
        </div>
      </div>
    </motion.div>
  );
}
