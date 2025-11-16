import { Smile, Meh, Frown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MoodSelectorProps {
  onSelect: (mood: string) => void;
  selected?: string | null;
}

export const MoodSelector = ({ onSelect, selected }: MoodSelectorProps) => {
  const moods = [
    { id: "good", label: "Good", icon: Smile, color: "text-green-500" },
    { id: "neutral", label: "Neutral", icon: Meh, color: "text-yellow-500" },
    { id: "tough", label: "Tough", icon: Frown, color: "text-red-500" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
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
            <span className="text-sm">{mood.label}</span>
          </Button>
        );
      })}
    </div>
  );
};
