import { ScrollArea } from "@/components/ui/scroll-area";

type Mood = {
  label: string;
  emoji: string;
};

const moods: Mood[] = [
  { label: "Unmotivated", emoji: "😴" },
  { label: "Overthinking", emoji: "🤯" },
  { label: "Confident", emoji: "💪" },
  { label: "Focused", emoji: "🎯" },
  { label: "Frustrated", emoji: "😤" },
  { label: "Inspired", emoji: "✨" },
  { label: "Heavy / Low", emoji: "😔" },
  { label: "In Transition", emoji: "🔄" },
];

interface MoodSelectorProps {
  selectedMood: string | null;
  onSelectMood: (mood: string) => void;
}

export function MoodSelector({ selectedMood, onSelectMood }: MoodSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-heading">How are you feeling right now?</h3>
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4">
          {moods.map((mood) => (
            <button
              key={mood.label}
              onClick={() => onSelectMood(mood.label)}
              className={`flex-shrink-0 flex flex-col items-center gap-2 p-4 rounded-full border-2 transition-all ${
                selectedMood === mood.label
                  ? "border-primary bg-primary/20 scale-110"
                  : "border-border hover:border-primary/50 hover:scale-105"
              }`}
            >
              <span className="text-3xl">{mood.emoji}</span>
              <span className="text-xs font-medium whitespace-nowrap">{mood.label}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}