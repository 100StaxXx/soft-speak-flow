import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { DisplayQuest } from "@/features/quests/display";

interface AllDayTaskBannerProps {
  quest: DisplayQuest;
  onClick?: () => void;
}

const CATEGORY_ACCENT: Record<string, string> = {
  mind: "bg-violet-500",
  body: "bg-coral-500",
  soul: "bg-pink-400",
  default: "bg-muted-foreground/40",
};

export function AllDayTaskBanner({ quest, onClick }: AllDayTaskBannerProps) {
  const accent = CATEGORY_ACCENT[quest.category || "default"] || CATEGORY_ACCENT.default;

  return (
    <button
      onClick={() => onClick?.()}
      className={cn(
        "flex items-center gap-3 w-full rounded-lg bg-muted/30 px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
        quest.completed && "opacity-50"
      )}
    >
      {/* Category accent bar */}
      <div className={cn("w-1 h-5 rounded-full flex-shrink-0", accent)} />

      {/* Title */}
      <span className={cn(
        "flex-1 text-sm font-medium text-foreground truncate",
        quest.completed && "line-through text-muted-foreground"
      )}>
        {quest.title}
      </span>

      {/* All Day label */}
      <span className="text-xs text-muted-foreground flex-shrink-0">All Day</span>

      {/* Checkbox */}
      <div className={cn(
        "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
        quest.completed
          ? "bg-coral-500 border-coral-500"
          : "border-coral-500/50"
      )}>
        {quest.completed && <Check className="h-3 w-3 text-white" />}
      </div>
    </button>
  );
}
