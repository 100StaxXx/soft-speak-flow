import { Frown, Brain, Zap, Battery, Smile, Target, Focus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface MoodSelectorProps {
  onSelect: (mood: string) => void;
  selected?: string | null;
}

export const MoodSelector = ({ onSelect, selected }: MoodSelectorProps) => {
  const moods = [
    { id: "unmotivated", label: "Unmotivated", icon: Frown, color: "text-red-500", borderColor: "border-red-500/50", bgColor: "bg-red-500/10" },
    { id: "overthinking", label: "Overthinking", icon: Brain, color: "text-purple-500", borderColor: "border-purple-500/50", bgColor: "bg-purple-500/10" },
    { id: "stressed", label: "Stressed", icon: Zap, color: "text-orange-500", borderColor: "border-orange-500/50", bgColor: "bg-orange-500/10" },
    { id: "low_energy", label: "Low Energy", icon: Battery, color: "text-gray-400", borderColor: "border-gray-400/50", bgColor: "bg-gray-400/10" },
    { id: "content", label: "Content", icon: Smile, color: "text-blue-400", borderColor: "border-blue-400/50", bgColor: "bg-blue-400/10" },
    { id: "disciplined", label: "Disciplined", icon: Target, color: "text-green-500", borderColor: "border-green-500/50", bgColor: "bg-green-500/10" },
    { id: "focused", label: "Focused", icon: Focus, color: "text-teal-500", borderColor: "border-teal-500/50", bgColor: "bg-teal-500/10" },
    { id: "inspired", label: "Inspired", icon: Sparkles, color: "text-yellow-500", borderColor: "border-yellow-500/50", bgColor: "bg-yellow-500/10" },
  ];

  return (
    <div className="grid grid-cols-4 gap-2.5">
      {moods.map((mood) => {
        const Icon = mood.icon;
        const isSelected = selected === mood.id;
        
        return (
          <button
            key={mood.id}
            type="button"
            onClick={() => {
              onSelect(mood.id);
              window.dispatchEvent(new CustomEvent('mood-selected'));
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 active:scale-95",
              isSelected
                ? `${mood.bgColor} ${mood.borderColor} shadow-md`
                : "bg-card/50 border-border/50 hover:border-primary/40 hover:bg-card/80"
            )}
          >
            <div className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200",
              isSelected ? mood.bgColor : "bg-muted/50"
            )}>
              <Icon className={cn("h-5 w-5", isSelected ? mood.color : "text-muted-foreground")} />
            </div>
            <span className={cn(
              "text-[10px] font-medium leading-none text-center",
              isSelected ? "text-foreground" : "text-muted-foreground"
            )}>
              {mood.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
