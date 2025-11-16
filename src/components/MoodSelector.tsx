import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const moods = [
  { label: "Unmotivated", emoji: "😴" },
  { label: "Overthinking", emoji: "🤯" },
  { label: "Stressed", emoji: "😰" },
  { label: "Low Energy", emoji: "🔋" },
  { label: "Content", emoji: "😌" },
  { label: "Disciplined", emoji: "💪" },
  { label: "Focused", emoji: "🎯" },
  { label: "Inspired", emoji: "✨" }
];

interface MoodSelectorProps {
  onMoodSelect: (mood: string) => void;
  selectedMood: string | null;
}

export function MoodSelector({ onMoodSelect, selectedMood }: MoodSelectorProps) {
  const { user } = useAuth();

  const handleMoodClick = async (mood: string) => {
    // Log the mood selection to database
    if (user) {
      await supabase
        .from('mood_logs')
        .insert({
          user_id: user.id,
          mood: mood
        });
    }
    
    onMoodSelect(mood);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-heading text-foreground">
        How are you feeling right now?
      </h3>
      
      <div className="grid grid-cols-4 gap-3">
        {moods.map((mood) => {
          const isSelected = selectedMood === mood.label;
          return (
            <button
              key={mood.label}
              onClick={() => handleMoodClick(mood.label)}
              className={`
                flex flex-col items-center justify-center gap-2
                p-4 rounded-xl
                transition-all duration-300 hover:scale-105 active:scale-95
                ${isSelected 
                  ? 'bg-primary text-primary-foreground scale-105 shadow-lg' 
                  : 'bg-card hover:bg-accent border border-border'
                }
              `}
            >
              <span className="text-2xl">{mood.emoji}</span>
              <span className="text-xs font-medium text-center leading-tight">
                {mood.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}