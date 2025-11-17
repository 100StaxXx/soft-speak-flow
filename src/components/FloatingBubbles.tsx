import { EMOTIONAL_TRIGGERS } from "@/config/categories";

interface FloatingBubblesProps {
  onBubbleClick: (value: string, type: "trigger" | "category") => void;
  selectedValue: string | null;
}

const CATEGORIES = ["discipline", "confidence", "physique", "focus", "mindset", "business"];

export const FloatingBubbles = ({ onBubbleClick, selectedValue }: FloatingBubblesProps) => {
  const triggers = EMOTIONAL_TRIGGERS.map(trigger => ({ 
    label: trigger, 
    value: trigger,
    type: "trigger" as const 
  }));
  
  const categories = CATEGORIES.map(cat => ({ 
    label: cat.charAt(0).toUpperCase() + cat.slice(1), 
    value: cat, 
    type: "category" as const 
  }));

  const getBubbleStyle = (value: string, type: "trigger" | "category") => {
    const isSelected = selectedValue === value;
    
    if (isSelected) {
      return "bg-gradient-to-r from-blush-rose to-soft-mauve text-white border-blush-rose shadow-lg";
    }
    
    if (type === "trigger") {
      return "bg-white/90 text-foreground border-petal-pink/40 hover:border-blush-rose/60 hover:bg-white hover:shadow-md font-semibold";
    }
    return "bg-gradient-to-br from-lavender-mist/70 to-petal-pink/50 text-foreground border-petal-pink/30 hover:from-lavender-mist hover:to-petal-pink hover:shadow-md font-semibold";
  };

  return (
    <div className="mb-8 space-y-6">
      {/* Emotional Triggers Section */}
      <div>
        <h3 className="text-sm font-medium text-warm-charcoal/70 mb-3">How are you feeling?</h3>
        <div className="flex flex-wrap gap-2">
          {triggers.map((trigger) => (
            <button
              key={trigger.value}
              onClick={() => onBubbleClick(trigger.value, trigger.type)}
              className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all duration-200 ${getBubbleStyle(trigger.value, trigger.type)}`}
            >
              {trigger.label}
            </button>
          ))}
        </div>
      </div>

      {/* Categories Section */}
      <div>
        <h3 className="text-sm font-medium text-warm-charcoal/70 mb-3">What area do you want to focus on?</h3>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.value}
              onClick={() => onBubbleClick(category.value, category.type)}
              className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all duration-200 ${getBubbleStyle(category.value, category.type)}`}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
