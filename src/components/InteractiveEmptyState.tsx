import { useState, useEffect } from "react";
import { LucideIcon, Plus, Dumbbell, Briefcase, Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface QuickPreset {
  icon: LucideIcon;
  label: string;
  text: string;
  difficulty: "easy" | "medium" | "hard";
}

const quickPresets: QuickPreset[] = [
  { icon: Dumbbell, label: "Exercise", text: "Workout session", difficulty: "medium" },
  { icon: Briefcase, label: "Work", text: "Focus on work task", difficulty: "medium" },
  { icon: Heart, label: "Self-care", text: "Self-care activity", difficulty: "easy" },
];

const motivationalMessages = [
  "Every quest begins with a single step ✨",
  "Today's quests shape tomorrow's victories 🏆",
  "Small wins compound into legendary achievements 🔥",
  "Your adventure awaits, hero! ⚔️",
  "Build habits, build greatness 💪",
];

interface InteractiveEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onAddQuest?: () => void;
  onQuickAdd?: (preset: { text: string; difficulty: "easy" | "medium" | "hard" }) => void;
}

export function InteractiveEmptyState({ 
  icon: Icon, 
  title, 
  description, 
  onAddQuest,
  onQuickAdd,
}: InteractiveEmptyStateProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Rotate motivational messages
  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setMessageIndex((prev) => (prev + 1) % motivationalMessages.length);
        setIsAnimating(false);
      }, 300);
    }, 4000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <Card className="p-8 text-center space-y-6 bg-gradient-to-br from-muted/30 via-primary/5 to-muted/10 border-dashed border-2 border-primary/20 relative overflow-hidden">
      {/* Background particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-primary/30 rounded-full animate-float-particle"
            style={{
              left: `${15 + i * 18}%`,
              top: `${20 + (i % 3) * 25}%`,
              animationDelay: `${i * 0.5}s`,
            }}
          />
        ))}
      </div>
      
      {/* Animated icon */}
      <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center relative">
        <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s' }} />
        <Icon className="h-12 w-12 text-primary animate-float-slow" />
        <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-stardust-gold animate-sparkle" />
      </div>
      
      {/* Title and description */}
      <div className="space-y-2 relative z-10">
        <h3 className="text-2xl font-bold text-foreground">{title}</h3>
        <p className="text-muted-foreground max-w-md mx-auto">{description}</p>
      </div>
      
      {/* Rotating motivational message */}
      <div className="h-6 relative">
        <p 
          className={cn(
            "text-sm text-primary/80 italic transition-all duration-300",
            isAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
          )}
        >
          {motivationalMessages[messageIndex]}
        </p>
      </div>
      
      {/* Quick add presets */}
      {onQuickAdd && (
        <div className="flex flex-wrap justify-center gap-2">
          {quickPresets.map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              onClick={() => onQuickAdd({ text: preset.text, difficulty: preset.difficulty })}
              className="gap-1.5 hover:bg-primary/10 hover:border-primary/50 transition-all"
            >
              <preset.icon className="h-3.5 w-3.5" />
              {preset.label}
            </Button>
          ))}
        </div>
      )}
      
      {/* Main action button */}
      {onAddQuest && (
        <Button 
          onClick={onAddQuest} 
          size="lg" 
          className="mt-4 gap-2 animate-pulse-subtle shadow-lg shadow-primary/25"
        >
          <Plus className="h-5 w-5" />
          Add Your First Quest
        </Button>
      )}
    </Card>
  );
}
