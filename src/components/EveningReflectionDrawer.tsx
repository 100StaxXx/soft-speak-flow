import { useRef, useState } from "react";
import { ChevronDown, Moon, Sparkles } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useEveningReflection } from "@/hooks/useEveningReflection";
import { useIOSKeyboardAvoidance } from "@/hooks/useIOSKeyboardAvoidance";
import { useToast } from "@/hooks/use-toast";

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

const MAX_REFLECTION_LENGTH = 800;

export const EveningReflectionDrawer = ({ open, onOpenChange }: EveningReflectionDrawerProps) => {
  const { submitReflection, isSubmitting } = useEveningReflection();
  const { toast } = useToast();
  const [mood, setMood] = useState<string>("");
  const [wins, setWins] = useState("");
  const [additionalReflection, setAdditionalReflection] = useState("");
  const [tomorrowAdjustment, setTomorrowAdjustment] = useState("");
  const [gratitude, setGratitude] = useState("");
  const [isDeeperOpen, setIsDeeperOpen] = useState(false);
  
  const winsRef = useRef<HTMLTextAreaElement>(null);
  const additionalReflectionRef = useRef<HTMLTextAreaElement>(null);
  const tomorrowAdjustmentRef = useRef<HTMLTextAreaElement>(null);
  const gratitudeRef = useRef<HTMLTextAreaElement>(null);
  const { containerStyle, inputStyle, scrollInputIntoView } = useIOSKeyboardAvoidance({ offsetBuffer: 10 });

  const resetForm = () => {
    setMood("");
    setWins("");
    setAdditionalReflection("");
    setTomorrowAdjustment("");
    setGratitude("");
    setIsDeeperOpen(false);
  };

  // Reset form when drawer closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async () => {
    if (!mood) return;

    try {
      await submitReflection({
        mood,
        wins: wins.trim() || undefined,
        additionalReflection: additionalReflection.trim() || undefined,
        tomorrowAdjustment: tomorrowAdjustment.trim() || undefined,
        gratitude: gratitude.trim() || undefined,
      });

      resetForm();
    } catch (error) {
      toast({
        title: "Unable to save reflection",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
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
                placeholder="A small win, a moment of joy, something you appreciated about today..."
                value={wins}
                maxLength={MAX_REFLECTION_LENGTH}
                onChange={(e) => setWins(e.target.value.slice(0, MAX_REFLECTION_LENGTH))}
                onFocus={() => scrollInputIntoView(winsRef)}
                className="resize-none min-h-24 bg-muted/30 border-border/50"
                style={inputStyle}
              />
              <p className="text-xs text-muted-foreground text-right">{wins.length}/{MAX_REFLECTION_LENGTH}</p>
            </div>

            <Collapsible open={isDeeperOpen} onOpenChange={setIsDeeperOpen} data-vaul-no-drag>
              <div className="rounded-2xl border border-border/50 bg-muted/20">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-muted/20"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Go a little deeper</p>
                      <p className="text-xs text-muted-foreground">
                        Optional space for anything else on your mind tonight.
                      </p>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                        isDeeperOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent className="space-y-4 px-4 pb-4">
                  <div className="space-y-2" data-vaul-no-drag>
                    <label className="text-sm font-medium text-foreground">
                      Anything else you'd like to reflect on from today? <span className="text-muted-foreground">(optional)</span>
                    </label>
                    <Textarea
                      ref={additionalReflectionRef}
                      placeholder="Anything else that feels worth naming tonight..."
                      value={additionalReflection}
                      maxLength={MAX_REFLECTION_LENGTH}
                      onChange={(e) => setAdditionalReflection(e.target.value.slice(0, MAX_REFLECTION_LENGTH))}
                      onFocus={() => scrollInputIntoView(additionalReflectionRef)}
                      className="resize-none min-h-24 bg-muted/30 border-border/50"
                      style={inputStyle}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {additionalReflection.length}/{MAX_REFLECTION_LENGTH}
                    </p>
                  </div>

                  <div className="space-y-2" data-vaul-no-drag>
                    <label className="text-sm font-medium text-foreground">
                      What's one small adjustment you'd like to make tomorrow? <span className="text-muted-foreground">(optional)</span>
                    </label>
                    <Textarea
                      ref={tomorrowAdjustmentRef}
                      placeholder="One small shift, boundary, or choice you'd like to try tomorrow..."
                      value={tomorrowAdjustment}
                      maxLength={MAX_REFLECTION_LENGTH}
                      onChange={(e) => setTomorrowAdjustment(e.target.value.slice(0, MAX_REFLECTION_LENGTH))}
                      onFocus={() => scrollInputIntoView(tomorrowAdjustmentRef)}
                      className="resize-none min-h-24 bg-muted/30 border-border/50"
                      style={inputStyle}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {tomorrowAdjustment.length}/{MAX_REFLECTION_LENGTH}
                    </p>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Gratitude */}
            <div className="space-y-2" data-vaul-no-drag>
              <label className="text-sm font-medium text-foreground">
                What are you grateful for? <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                ref={gratitudeRef}
                placeholder="Something or someone you appreciate today..."
                value={gratitude}
                maxLength={MAX_REFLECTION_LENGTH}
                onChange={(e) => setGratitude(e.target.value.slice(0, MAX_REFLECTION_LENGTH))}
                onFocus={() => scrollInputIntoView(gratitudeRef)}
                className="resize-none min-h-24 bg-muted/30 border-border/50"
                style={inputStyle}
              />
              <p className="text-xs text-muted-foreground text-right">{gratitude.length}/{MAX_REFLECTION_LENGTH}</p>
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
