import { useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Moon, Sparkles } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useDailyGuideThread } from "@/hooks/useDailyGuideThread";

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
  const { thread: dailyGuideThread } = useDailyGuideThread({ enabled: open });
  const { toast } = useToast();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [mood, setMood] = useState<string>("");
  const [wins, setWins] = useState("");
  const [additionalReflection, setAdditionalReflection] = useState("");
  const [tomorrowAdjustment, setTomorrowAdjustment] = useState("");
  const [gratitude, setGratitude] = useState("");
  const [isDeeperOpen, setIsDeeperOpen] = useState(false);
  const focusScrollPadding = 16;

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
      handleOpenChange(false);
    } catch (error) {
      toast({
        title: "Unable to save reflection",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const isValid = mood.length > 0;

  const keepFocusedFieldVisible = (target: HTMLTextAreaElement) => {
    requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (!container || !target.isConnected) return;

      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const clippedTop = targetRect.top < containerRect.top + focusScrollPadding;
      const clippedBottom = targetRect.bottom > containerRect.bottom - focusScrollPadding;

      if (!clippedTop && !clippedBottom) {
        return;
      }

      let nextTop = container.scrollTop;

      if (clippedTop) {
        nextTop -= containerRect.top + focusScrollPadding - targetRect.top;
      } else if (clippedBottom) {
        nextTop += targetRect.bottom - (containerRect.bottom - focusScrollPadding);
      }

      const clampedTop = Math.max(0, nextTop);
      if (Math.abs(clampedTop - container.scrollTop) < 1) {
        return;
      }

      container.scrollTo({ top: clampedTop, behavior: "auto" });
    });
  };

  const handleTextareaFocus = (event: React.FocusEvent<HTMLTextAreaElement>) => {
    keepFocusedFieldVisible(event.currentTarget);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={handleOpenChange}
      shouldScaleBackground={false}
      handleOnly={true}
      repositionInputs={false}
    >
      <DrawerContent className="max-h-[85dvh]">
        <div 
          ref={scrollContainerRef}
          className="mx-auto w-full max-w-lg px-4 pb-8 overflow-y-auto overscroll-contain"
          style={{ 
            WebkitOverflowScrolling: 'touch',
            maxHeight: 'calc(85dvh - 80px)'
          }}
          data-vaul-no-drag
        >
          <DrawerHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Moon className="h-6 w-6 text-primary" />
              <DrawerTitle className="text-xl">Evening Reflection</DrawerTitle>
            </div>
            <DrawerDescription>
              Start with a quick check-in. Everything else is optional.
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-6">
            {dailyGuideThread?.focus_label ? (
              <div className="rounded-2xl border border-primary/25 bg-primary/[0.07] p-4 text-left">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-full bg-primary/15 p-2 text-primary">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                      Returning to today’s thread
                    </p>
                    <p className="mt-1 text-sm leading-6 text-foreground/80">
                      This morning, you chose <span className="font-semibold text-foreground">{dailyGuideThread.focus_label}</span>
                      {dailyGuideThread.mentor_name ? ` with ${dailyGuideThread.mentor_name}` : " with your Guide"}.
                      {dailyGuideThread.practice_completed_at
                        ? " You also completed the connected Faithful Step."
                        : " The focus can still matter even if the practice remained unfinished."}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Mood Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                How are you ending the day?
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
                {dailyGuideThread?.focus_label
                  ? `Where did “${dailyGuideThread.focus_label}” show up—or where did you need more grace?`
                  : "Where did you notice grace or goodness today?"} <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                placeholder="A kindness, provision, moment of beauty, or small good worth receiving…"
                value={wins}
                maxLength={MAX_REFLECTION_LENGTH}
                onChange={(e) => setWins(e.target.value.slice(0, MAX_REFLECTION_LENGTH))}
                onFocus={handleTextareaFocus}
                className="resize-none min-h-24 bg-muted/30 border-border/50"
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
                      Optional space for difficulty, repair, and tomorrow.
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
                      What was difficult, or may need confession or repair? <span className="text-muted-foreground">(optional)</span>
                    </label>
                    <Textarea
                      placeholder="Name what was hard without rushing past it. What might need care or repair?"
                      value={additionalReflection}
                      maxLength={MAX_REFLECTION_LENGTH}
                      onChange={(e) => setAdditionalReflection(e.target.value.slice(0, MAX_REFLECTION_LENGTH))}
                      onFocus={handleTextareaFocus}
                      className="resize-none min-h-24 bg-muted/30 border-border/50"
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {additionalReflection.length}/{MAX_REFLECTION_LENGTH}
                    </p>
                  </div>

                  <div className="space-y-2" data-vaul-no-drag>
                    <label className="text-sm font-medium text-foreground">
                      What is one small faithful step for tomorrow? <span className="text-muted-foreground">(optional)</span>
                    </label>
                    <Textarea
                      placeholder="A small act of love, boundary, responsibility, rest, or return…"
                      value={tomorrowAdjustment}
                      maxLength={MAX_REFLECTION_LENGTH}
                      onChange={(e) => setTomorrowAdjustment(e.target.value.slice(0, MAX_REFLECTION_LENGTH))}
                      onFocus={handleTextareaFocus}
                      className="resize-none min-h-24 bg-muted/30 border-border/50"
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
                What would you like to thank God for? <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                placeholder="A person, gift, mercy, or ordinary thing you received today…"
                value={gratitude}
                maxLength={MAX_REFLECTION_LENGTH}
                onChange={(e) => setGratitude(e.target.value.slice(0, MAX_REFLECTION_LENGTH))}
                onFocus={handleTextareaFocus}
                className="resize-none min-h-24 bg-muted/30 border-border/50"
              />
              <p className="text-xs text-muted-foreground text-right">{gratitude.length}/{MAX_REFLECTION_LENGTH}</p>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
              className="w-full h-12"
            >
              {isSubmitting ? (
                "Saving..."
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Save reflection
                </span>
              )}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
