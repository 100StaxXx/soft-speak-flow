import { Smile, Meh, Frown, Sparkles, Heart, Coffee, Moon, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MoodSelectorProps {
  onSelect: (mood: string) => void;
  selected?: string | null;
}

export const MoodSelector = ({ onSelect, selected }: MoodSelectorProps) => {
  const moods = [
    { id: "amazing", label: "Amazing", icon: Sparkles, color: "text-yellow-500" },
    { id: "happy", label: "Happy", icon: Smile, color: "text-green-500" },
    { id: "grateful", label: "Grateful", icon: Heart, color: "text-pink-500" },
    { id: "calm", label: "Calm", icon: Coffee, color: "text-blue-400" },
    { id: "neutral", label: "Neutral", icon: Meh, color: "text-gray-500" },
    { id: "tired", label: "Tired", icon: Moon, color: "text-purple-500" },
    { id: "stressed", label: "Stressed", icon: Zap, color: "text-orange-500" },
    { id: "tough", label: "Tough", icon: Frown, color: "text-red-500" },
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
            className={`h-20 flex-col gap-2 ${isSelected ? "" : "hover:border-primary"}`}
            onClick={() => onSelect(mood.id)}
          >
            <Icon className={`h-6 w-6 ${isSelected ? "" : mood.color}`} />
            <span className="text-xs">{mood.label}</span>
          </Button>
        );
      })}
    </div>
  );
};
