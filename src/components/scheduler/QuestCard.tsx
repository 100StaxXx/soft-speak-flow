import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Star, Clock, Zap, Brain, Heart, Dumbbell, ChevronDown, FileText, Battery, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface QuestCardProps {
  id: string;
  text: string;
  completed: boolean;
  xpReward: number;
  isMainQuest?: boolean;
  isTutorialQuest?: boolean;
  difficulty?: "easy" | "medium" | "hard";
  category?: "mind" | "body" | "soul" | null;
  scheduledTime?: string | null;
  estimatedDuration?: number | null;
  notes?: string | null;
  priority?: string | null;
  energyLevel?: string | null;
  isRecurring?: boolean | null;
  recurrencePattern?: string | null;
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

const priorityConfig = {
  low: { color: "text-muted-foreground", bg: "bg-muted/50" },
  medium: { color: "text-yellow-400", bg: "bg-yellow-500/10" },
  high: { color: "text-red-400", bg: "bg-red-500/10" },
};

const energyConfig = {
  low: { color: "text-green-400", label: "Low Energy" },
  medium: { color: "text-yellow-400", label: "Medium Energy" },
  high: { color: "text-red-400", label: "High Energy" },
};

export function QuestCard({
  id,
  text,
  completed,
  xpReward,
  isMainQuest,
  isTutorialQuest,
  difficulty = "medium",
  category,
  scheduledTime,
  estimatedDuration,
  notes,
  priority,
  energyLevel,
  isRecurring,
  recurrencePattern,
  onToggle,
  onEdit,
}: QuestCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const diffStyle = difficultyConfig[difficulty];
  const CategoryIcon = category ? categoryIcons[category] : null;

  const hasDetails = notes || priority || energyLevel || isRecurring;

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours, 10);
    const suffix = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${suffix}`;
  };

  const formatRecurrence = (pattern: string | null | undefined) => {
    if (!pattern) return "Repeating";
    if (pattern === "daily") return "Daily";
    if (pattern === "weekly") return "Weekly";
    if (pattern === "weekdays") return "Weekdays";
    return pattern.charAt(0).toUpperCase() + pattern.slice(1);
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        data-tutorial-quest={isTutorialQuest && !completed ? "true" : undefined}
        className={cn(
          "group relative rounded-xl border transition-all",
          "bg-card/80 backdrop-blur-sm hover:bg-card",
          completed 
            ? "border-border/30 opacity-70" 
            : diffStyle.border,
          isMainQuest && !completed && "ring-1 ring-stardust-gold/30 shadow-glow",
          isTutorialQuest && !completed && "ring-2 ring-primary/50 border-primary/40 shadow-[0_0_20px_rgba(129,140,248,0.3)]"
        )}
      >
        {/* Main quest glow effect */}
        {isMainQuest && !completed && (
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-stardust-gold/5 to-transparent pointer-events-none" />
        )}

        {/* Tutorial quest arrow indicator */}
        {isTutorialQuest && !completed && (
          <motion.div
            className="absolute -left-8 top-1/2 -translate-y-1/2 text-primary"
            animate={{ x: [0, 6, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="text-lg">👉</span>
          </motion.div>
        )}

        {/* Main row */}
        <div className="flex items-center gap-3 p-3">
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
                : "border-primary/50 hover:border-primary hover:bg-primary/10",
              isTutorialQuest && !completed && "ring-4 ring-primary/30 animate-pulse"
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

          {/* Content - clickable for edit */}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onEdit}>
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

          {/* Right side: category + chevron + XP */}
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

            {/* Chevron for expansion */}
            {hasDetails && (
              <CollapsibleTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 rounded-full hover:bg-muted/50 transition-colors"
                >
                  <ChevronDown 
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform duration-200",
                      isExpanded && "rotate-180"
                    )} 
                  />
                </button>
              </CollapsibleTrigger>
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
        </div>

        {/* Expandable details section */}
        <AnimatePresence>
          {hasDetails && (
            <CollapsibleContent forceMount className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <div className="px-3 pb-3 pt-0 border-t border-border/30 mt-0">
                <div className="pt-3 space-y-2">
                  {/* Notes */}
                  {notes && (
                    <div className="flex items-start gap-2">
                      <FileText className="h-3.5 w-3.5 text-celestial-blue mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-celestial-blue/80">{notes}</p>
                    </div>
                  )}

                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {priority && (
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full capitalize",
                        priorityConfig[priority as keyof typeof priorityConfig]?.bg || "bg-muted/50",
                        priorityConfig[priority as keyof typeof priorityConfig]?.color || "text-muted-foreground"
                      )}>
                        {priority} priority
                      </span>
                    )}

                    {energyLevel && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Battery className={cn(
                          "h-3.5 w-3.5",
                          energyConfig[energyLevel as keyof typeof energyConfig]?.color || "text-muted-foreground"
                        )} />
                        <span>{energyConfig[energyLevel as keyof typeof energyConfig]?.label || energyLevel}</span>
                      </div>
                    )}

                    {isRecurring && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <RefreshCw className="h-3.5 w-3.5 text-celestial-blue" />
                        <span>{formatRecurrence(recurrencePattern)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          )}
        </AnimatePresence>
      </motion.div>
    </Collapsible>
  );
}
