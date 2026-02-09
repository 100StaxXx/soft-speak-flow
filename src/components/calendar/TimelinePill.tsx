import { cn } from "@/lib/utils";

interface TimelinePillProps {
  duration: number; // in minutes
  category?: string | null;
  isCompleted?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  mind: "bg-violet-500",
  body: "bg-coral-500",
  soul: "bg-pink-400",
  morning: "bg-amber-400",
  work: "bg-blue-500",
  default: "bg-muted-foreground/40",
};

export function TimelinePill({ duration, category, isCompleted }: TimelinePillProps) {
  // Calculate height based on duration: 15 min = 24px base
  const height = Math.max(24, Math.min((duration / 15) * 24, 96));
  
  const colorClass = isCompleted 
    ? "bg-muted-foreground/30" 
    : CATEGORY_COLORS[category || "default"] || CATEGORY_COLORS.default;

  return (
    <div
      className={cn(
        "w-1 rounded-full transition-all",
        colorClass
      )}
      style={{ height: `${height}px` }}
    />
  );
}
