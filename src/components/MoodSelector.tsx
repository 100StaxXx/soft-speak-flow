import { Frown, Brain, Zap, Battery, Smile, Target, Focus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MoodSelectorProps {
  onSelect: (mood: string) => void;
  selected?: string | null;
}

export const MoodSelector = ({ onSelect, selected }: MoodSelectorProps) => {
  const moods = [
    { id: "unmotivated", label: "Unmotivated", icon: Frown, color: "text-red-500" },
    { id: "overthinking", label: "Overthinking", icon: Brain, color: "text-purple-500" },
    { id: "stressed", label: "Stressed", icon: Zap, color: "text-orange-500" },
    { id: "low_energy", label: "Low Energy", icon: Battery, color: "text-gray-500" },
    { id: "content", label: "Content", icon: Smile, color: "text-blue-400" },
    { id: "disciplined", label: "Disciplined", icon: Target, color: "text-green-500" },
    { id: "focused", label: "Focused", icon: Focus, color: "text-teal-500" },
    { id: "inspired", label: "Inspired", icon: Sparkles, color: "text-yellow-500" },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {moods.map((mood) => {
        const Icon = mood.icon;
        const isSelected = selected === mood.id;
        
        return (
          <Button
            key={mood.id}
            variant={isSelected ? "default" : "outline"}
            className={`h-auto py-2.5 flex-col gap-1 ${isSelected ? "" : "hover:border-primary"}`}
            onClick={() => onSelect(mood.id)}
          >
            <Icon className={`h-5 w-5 ${isSelected ? "" : mood.color}`} />
            <span className="text-[8px] leading-none text-center">{mood.label}</span>
          </Button>
        );
      })}
    </div>
  );
};
