import { useState, useRef } from "react";
import { Moon, Sparkles } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEveningReflection } from "@/hooks/useEveningReflection";
import { useIOSKeyboardAvoidance } from "@/hooks/useIOSKeyboardAvoidance";

const MOOD_OPTIONS = [
  { emoji: "😊", label: "Great", value: "great" },
  { emoji: "🙂", label: "Good", value: "good" },
  { emoji: "😐", label: "Okay", value: "okay" },
  { emoji: "😔", label: "Low", value: "low" },
  { emoji: "😢", label: "Rough", value: "rough" },
];

interface EveningReflectionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EveningReflectionDrawer = ({ open, onOpenChange }: EveningReflectionDrawerProps) => {
  const { submitReflection, isSubmitting } = useEveningReflection();
  const [mood, setMood] = useState<string>("");
  const [wins, setWins] = useState("");
  const [gratitude, setGratitude] = useState("");
  
  const winsRef = useRef<HTMLTextAreaElement>(null);
  const gratitudeRef = useRef<HTMLTextAreaElement>(null);
  const { containerStyle, inputStyle, scrollInputIntoView } = useIOSKeyboardAvoidance({ offsetBuffer: 10 });

  // Reset form when drawer closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setMood("");
      setWins("");
      setGratitude("");
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = () => {
    if (!mood) return;
    
    submitReflection({
      mood,
      wins: wins.trim() || undefined,
      gratitude: gratitude.trim() || undefined,
    });

    // Reset form
    setMood("");
    setWins("");
    setGratitude("");
  };

  const isValid = mood.length > 0;

  return (
    <Drawer open={open} onOpenChange={handleOpenChange} shouldScaleBackground={false} handleOnly={true} repositionInputs={false}>
      <DrawerContent className="max-h-[85dvh]" style={containerStyle}>
        <div 
          className="mx-auto w-full max-w-lg px-4 pb-8 overflow-y-auto overscroll-contain"
          style={{ 
            WebkitOverflowScrolling: 'touch',
            maxHeight: 'calc(85dvh - 80px)'
          }}
          data-vaul-no-drag
        >
          <DrawerHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Moon className="h-6 w-6 text-purple-400" />
              <DrawerTitle className="text-xl">Evening Reflection</DrawerTitle>
            </div>
            <DrawerDescription>
              Take a moment to reflect on your day
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-6">
            {/* Mood Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                How are you feeling tonight?
              </label>
              <div className="flex justify-center gap-2">
                {MOOD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setMood(option.value)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                      mood === option.value
                        ? "bg-primary/20 border-2 border-primary scale-105"
                        : "bg-muted/50 border-2 border-transparent hover:bg-muted"
                    }`}
                  >
                    <span className="text-2xl">{option.emoji}</span>
                    <span className="text-xs text-muted-foreground">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Wins */}
            <div className="space-y-2" data-vaul-no-drag>
              <label className="text-sm font-medium text-foreground">
                What went well today? <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                ref={winsRef}
                placeholder="A small win, a moment of joy, something you accomplished..."
                value={wins}
                onChange={(e) => setWins(e.target.value.slice(0, 280))}
                onFocus={() => scrollInputIntoView(winsRef)}
                className="resize-none h-20 bg-muted/30 border-border/50"
                style={inputStyle}
              />
              <p className="text-xs text-muted-foreground text-right">{wins.length}/280</p>
            </div>

            {/* Gratitude */}
            <div className="space-y-2" data-vaul-no-drag>
              <label className="text-sm font-medium text-foreground">
                What are you grateful for? <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                ref={gratitudeRef}
                placeholder="Something or someone you appreciate today..."
                value={gratitude}
                onChange={(e) => setGratitude(e.target.value.slice(0, 280))}
                onFocus={() => scrollInputIntoView(gratitudeRef)}
                className="resize-none h-20 bg-muted/30 border-border/50"
                style={inputStyle}
              />
              <p className="text-xs text-muted-foreground text-right">{gratitude.length}/280</p>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
              className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
            >
              {isSubmitting ? (
                "Saving..."
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Complete Reflection
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/20">+3 XP</span>
                </span>
              )}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};