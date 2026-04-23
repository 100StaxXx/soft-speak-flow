import React, { useState, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Clock, Zap, Flame, Mountain, Star, Brain, Dumbbell, Heart } from "lucide-react";
import type { DisplayQuest } from "@/features/quests/display";
import { isValidQuestCategory } from "@/features/quests/validation";
import { cn } from "@/lib/utils";
import { playSound } from "@/utils/soundEffects";

export type QuestDragCardQuest = Pick<
  DisplayQuest,
  | "id"
  | "title"
  | "scheduledTime"
  | "estimatedDuration"
  | "isMainQuest"
  | "difficulty"
  | "category"
  | "xpReward"
  | "completed"
>;

interface QuestDragCardProps {
  quest: QuestDragCardQuest;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  draggable?: boolean;
  onLongPress?: () => void;
  compact?: boolean;
  showTime?: boolean;
}

// Category configuration with icons and colors
const categoryConfig = {
  mind: {
    icon: Brain,
    label: "Mind",
    colors: "from-category-mind/20 to-purple-500/20 text-category-mind border-category-mind/30",
    glow: "shadow-[0_0_15px_hsl(var(--category-mind)/0.3)]"
  },
  body: {
    icon: Dumbbell,
    label: "Body",
    colors: "from-category-body/20 to-red-500/20 text-category-body border-category-body/30",
    glow: "shadow-[0_0_15px_hsl(var(--category-body)/0.3)]"
  },
  soul: {
    icon: Heart,
    label: "Soul",
    colors: "from-category-soul/20 to-cyan-500/20 text-category-soul border-category-soul/30",
    glow: "shadow-[0_0_15px_hsl(var(--category-soul)/0.3)]"
  }
};

// Difficulty configuration with icons and colors
const difficultyConfig = {
  easy: {
    icon: Zap,
    borderColor: "border-emerald-500/30",
    bgColor: "bg-emerald-500/5",
    textColor: "text-emerald-400",
    glow: "shadow-[0_0_20px_hsl(142,76%,50%/0.2)]"
  },
  medium: {
    icon: Flame,
    borderColor: "border-amber-500/30",
    bgColor: "bg-amber-500/5",
    textColor: "text-amber-400",
    glow: "shadow-[0_0_20px_hsl(45,90%,55%/0.2)]"
  },
  hard: {
    icon: Mountain,
    borderColor: "border-rose-500/30",
    bgColor: "bg-rose-500/5",
    textColor: "text-rose-400",
    glow: "shadow-[0_0_20px_hsl(350,90%,60%/0.2)]"
  },
};

export const QuestDragCard = React.memo(({ 
  quest,
  isDragging, 
  onDragStart, 
  onDragEnd,
  draggable,
  onLongPress, 
  compact = false, 
  showTime = true 
}: QuestDragCardProps) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!onLongPress) return;
    
    // Store initial touch position
    touchStartPos.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
    
    longPressTriggered.current = false;
    setIsPressed(true);
    
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      playSound('pop');
      onLongPress();
      setIsPressed(false);
    }, 500); // Reduced from 600ms for snappier feel
  }, [onLongPress]);

  const handleTouchEnd = useCallback(() => {
    setIsPressed(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Cancel long press if user moves finger more than 10px
    if (touchStartPos.current) {
      const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
      if (dx > 10 || dy > 10) {
        handleTouchEnd();
      }
    }
  }, [handleTouchEnd]);

  const difficulty = quest.difficulty?.toLowerCase() as 'easy' | 'medium' | 'hard' | undefined;
  const config = difficulty ? difficultyConfig[difficulty] : null;
  const category = isValidQuestCategory(quest.category) ? quest.category : undefined;
  const categoryInfo = category ? categoryConfig[category] : null;

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${period}`;
  };

  const formatDuration = (duration: number) => {
    if (duration < 60) return `${duration}m`;
    const hours = Math.floor(duration / 60);
    const mins = duration % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };
  const isCardDraggable = draggable ?? Boolean(onDragStart);

  return (
    <div className="flex items-stretch gap-2">
      <Card
        data-quest-card="true"
        draggable={isCardDraggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={cn(
          "cursor-grab active:cursor-grabbing overflow-hidden group relative touch-manipulation",
          // Hardware-accelerated transforms for smooth animations
          "transform-gpu transition-all duration-200 ease-out",
          isDragging && "opacity-50 scale-95",
          !isDragging && "hover:scale-[1.02] active:scale-[0.98]",
          isPressed && !isDragging && "scale-[0.97] opacity-90",
          quest.completed && "opacity-60",
          // Main Quest - gold styling
          quest.isMainQuest && "border-2 border-[hsl(45,100%,60%)] shadow-[0_0_20px_hsl(45,100%,60%/0.3)]",
          // Category-based left border for non-main quests
          !quest.isMainQuest && categoryInfo && `border-l-4 ${categoryInfo.colors.split(' ').find(c => c.includes('border'))}`,
          // Difficulty-based colors for side quests
          !quest.isMainQuest && config?.borderColor,
          !quest.isMainQuest && isHovering && config?.glow,
          !quest.isMainQuest && isHovering && categoryInfo?.glow
        )}
        style={{ 
          willChange: isDragging ? 'transform, opacity' : 'auto',
          WebkitTapHighlightColor: 'transparent'
        }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchCancel={handleTouchEnd}
      >
        {/* Main Quest Gold Shimmer */}
        {quest.isMainQuest && !quest.completed && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[hsl(45,100%,60%)]/10 to-transparent animate-pulse" />
        )}

        {/* Card Content */}
        <div className={cn("relative flex items-start gap-3", compact ? "p-2" : "p-3")}>
          {/* Difficulty Icon */}
          {config && !quest.isMainQuest && !compact && (
            <div className={cn("flex-shrink-0 mt-0.5", config.textColor)}>
              {React.createElement(config.icon, { className: "h-4 w-4" })}
            </div>
          )}

          {/* Quest Info */}
          <div className="flex-1 space-y-1">
            <div className="flex items-start gap-2">
              {quest.isMainQuest && <Star className="h-4 w-4 text-[hsl(45,100%,60%)] flex-shrink-0 mt-0.5 animate-pulse" />}
              <p className={cn(
                "font-medium leading-relaxed",
                compact ? "text-xs" : "text-sm",
                quest.completed && "line-through text-muted-foreground",
                quest.isMainQuest && "text-base font-semibold"
              )}>
                {quest.title}
              </p>
            </div>

            {/* Category Badge */}
            {categoryInfo && !quest.isMainQuest && !compact && (
              <div className="flex items-center gap-1">
                <div className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r border",
                  categoryInfo.colors
                )}>
                  <categoryInfo.icon className="h-3 w-3" />
                  <span>{categoryInfo.label}</span>
                </div>
              </div>
            )}

            {/* Quest Meta Info */}
            {!compact && (
              <div className="flex items-center gap-3 text-xs flex-wrap">
                {showTime && quest.scheduledTime && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatTime(quest.scheduledTime)}
                  </div>
                )}

                {quest.estimatedDuration && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatDuration(quest.estimatedDuration)}
                  </div>
                )}

                <div className={cn(
                  "font-semibold",
                  quest.isMainQuest ? "text-[hsl(45,100%,60%)]" : "text-muted-foreground"
                )}>
                  +{quest.xpReward} XP
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Drag hint on hover */}
        {isHovering && !quest.completed && (
          <div className="absolute bottom-1 right-1 text-[10px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
            Drag to reorder
          </div>
        )}
      </Card>
    </div>
  );
});
