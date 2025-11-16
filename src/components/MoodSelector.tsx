import { useState } from "react";

const moods = [
  { label: "Unmotivated", emoji: "😴" },
  { label: "Overthinking", emoji: "🤯" },
  { label: "Confident", emoji: "💪" },
  { label: "Focused", emoji: "🎯" },
  { label: "Frustrated", emoji: "😤" },
  { label: "Inspired", emoji: "✨" },
  { label: "Heavy / Low", emoji: "😔" },
  { label: "In Transition", emoji: "🌊" }
];

interface MoodSelectorProps {
  onMoodSelect: (mood: string) => void;
  selectedMood: string | null;
}

export function MoodSelector({ onMoodSelect, selectedMood }: MoodSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-heading text-foreground">
        How are you feeling right now?
      </h3>
      
      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory">
        {moods.map((mood) => {
          const isSelected = selectedMood === mood.label;
          return (
            <button
              key={mood.label}
              onClick={() => onMoodSelect(mood.label)}
              className={`
                flex-shrink-0 snap-center
                flex flex-col items-center justify-center gap-2
                w-24 h-24 rounded-full
                transition-all duration-300 hover:scale-105 active:scale-95
                ${isSelected 
                  ? 'bg-primary text-primary-foreground scale-110 shadow-lg' 
                  : 'bg-card hover:bg-accent border border-border'
                }
              `}
            >
              <span className="text-3xl">{mood.emoji}</span>
              <span className="text-xs font-medium text-center px-1">
                {mood.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}