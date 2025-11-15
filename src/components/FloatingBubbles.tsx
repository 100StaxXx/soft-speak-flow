import { useState, useEffect } from "react";
import { EMOTIONAL_TRIGGERS } from "@/config/categories";

interface FloatingBubblesProps {
  onBubbleClick: (value: string, type: "trigger" | "category") => void;
  selectedValue: string | null;
}

const CATEGORIES = ["discipline", "confidence", "physique", "focus", "mindset", "business"];

export const FloatingBubbles = ({ onBubbleClick, selectedValue }: FloatingBubblesProps) => {
  const [hoveredBubble, setHoveredBubble] = useState<string | null>(null);

  // Combine triggers and categories
  const allBubbles = [
    ...EMOTIONAL_TRIGGERS.map(trigger => ({ label: trigger, type: "trigger" as const })),
    ...CATEGORIES.map(cat => ({ label: cat.charAt(0).toUpperCase() + cat.slice(1), value: cat, type: "category" as const })),
  ];

  // Randomize positions but keep them consistent
  const [bubblePositions] = useState(() =>
    allBubbles.map((_, index) => ({
      left: `${(index * 23) % 90}%`,
      top: `${(index * 37) % 85}%`,
      delay: `${(index * 0.2) % 2}s`,
      duration: `${15 + (index % 5) * 3}s`,
    }))
  );

  const getBubbleSize = (index: number) => {
    const sizes = ["text-xs px-3 py-1.5", "text-sm px-4 py-2", "text-xs px-3 py-1.5"];
    return sizes[index % sizes.length];
  };

  const getBubbleColor = (type: "trigger" | "category", label: string) => {
    if (selectedValue === label || selectedValue === label.toLowerCase()) {
      return "bg-gradient-to-r from-blush-rose to-soft-mauve text-white shadow-lg scale-110 border-2 border-white";
    }
    
    if (type === "trigger") {
      return "bg-white/70 text-warm-charcoal/80 hover:bg-white/90 border border-petal-pink/30 hover:border-blush-rose/50";
    }
    return "bg-gradient-to-br from-lavender-mist/60 to-petal-pink/40 text-warm-charcoal hover:from-lavender-mist/80 hover:to-petal-pink/60 border border-petal-pink/20";
  };

  return (
    <div className="relative w-full h-[400px] mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-cream-glow/50 via-petal-pink/10 to-lavender-mist/20 backdrop-blur-sm border border-petal-pink/20">
      {allBubbles.map((bubble, index) => {
        const value = bubble.type === "category" ? (bubble as any).value : bubble.label;
        const isSelected = selectedValue === bubble.label || selectedValue === value;
        
        return (
          <button
            key={`${bubble.type}-${value}`}
            onClick={() => onBubbleClick(value, bubble.type)}
            onMouseEnter={() => setHoveredBubble(value)}
            onMouseLeave={() => setHoveredBubble(null)}
            className={`absolute rounded-full font-medium transition-all duration-300 cursor-pointer whitespace-nowrap
              ${getBubbleSize(index)} ${getBubbleColor(bubble.type, value)}
              ${hoveredBubble === value ? "shadow-xl scale-105 z-10" : "shadow-md"}
              ${isSelected ? "animate-pulse" : "animate-float"}
            `}
            style={{
              left: bubblePositions[index].left,
              top: bubblePositions[index].top,
              animationDelay: bubblePositions[index].delay,
              animationDuration: bubblePositions[index].duration,
            }}
          >
            {bubble.label}
          </button>
        );
      })}
      
      {/* Instructional text */}
      {!selectedValue && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-warm-charcoal/40 text-sm font-medium text-center px-4">
            Click a bubble to explore quotes
          </p>
        </div>
      )}
    </div>
  );
};
