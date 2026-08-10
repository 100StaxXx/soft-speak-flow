import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Compass, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { useLivingNarrativeChoice } from "@/hooks/useLivingNarrativeChoice";
import type {
  LivingNarrativePrompt,
  LivingNarrativeSourceType,
} from "@/types/livingNarrative";

interface LivingNarrativeChoiceCardProps {
  sourceType: LivingNarrativeSourceType;
  sourceId: string;
  companionId: string;
  companionName: string;
  prompt: LivingNarrativePrompt;
  epicId?: string | null;
  stage?: number | null;
  chapterNumber?: number | null;
  tone?: "default" | "dark";
}

export function LivingNarrativeChoiceCard({
  sourceType,
  sourceId,
  companionId,
  companionName,
  prompt,
  epicId,
  stage,
  chapterNumber,
  tone = "default",
}: LivingNarrativeChoiceCardProps) {
  const [note, setNote] = useState("");
  const shouldReduceMotion = useReducedMotion();
  const isDark = tone === "dark";
  const {
    choice,
    isLoading,
    error,
    recordChoice,
    updateSideQuest,
    acceptSideQuest: acceptSideQuestMutation,
  } = useLivingNarrativeChoice(
    { sourceType, sourceId, companionId, epicId, stage, chapterNumber },
    prompt,
  );

  const selectedOption = prompt.options.find((option) => option.key === choice?.option_key);

  const choose = async (optionKey: string) => {
    const option = prompt.options.find((candidate) => candidate.key === optionKey);
    if (!option) return;
    try {
      await recordChoice.mutateAsync({ option, responseNote: note });
    } catch (choiceError) {
      console.error("Failed to save narrative choice:", choiceError);
      toast.error("Choice not saved", {
        description: "Your story is safe. Check your connection and try again.",
      });
    }
  };

  const acceptSideQuest = async () => {
    if (!choice?.side_quest_title) return;
    try {
      await acceptSideQuestMutation.mutateAsync();
      toast.success("Side quest added to your Inbox");
    } catch (sideQuestError) {
      console.error("Failed to add companion side quest:", sideQuestError);
      toast.error("Side quest not added", {
        description: "Your Inbox is unchanged. Check your connection and try again.",
      });
    }
  };

  const dismissSideQuest = async () => {
    try {
      await updateSideQuest.mutateAsync({ status: "dismissed" });
    } catch (sideQuestError) {
      console.error("Failed to dismiss companion side quest:", sideQuestError);
      toast.error("Couldn’t update the side quest", {
        description: "Nothing else changed. Please try again.",
      });
    }
  };

  if (isLoading) {
    return (
      <Card className={cn("p-4", isDark && "bg-white/5 border-white/10")} aria-busy="true">
        <div className={cn("flex items-center gap-2 text-sm", isDark ? "text-white/60" : "text-muted-foreground")}>
          <Loader2 className="w-4 h-4 animate-spin" />
          Listening for the story’s next thread…
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("p-4", isDark && "bg-white/5 border-white/10")} role="status">
        <p className={cn("text-sm", isDark ? "text-white/60" : "text-muted-foreground")}>
          This story choice is temporarily unavailable. The chapter itself is still safe.
        </p>
      </Card>
    );
  }

  if (choice) {
    return (
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className={cn(
          "p-5 border-primary/25 bg-primary/5",
          isDark && "bg-cyan-500/10 border-cyan-400/25",
        )}>
          <div className="flex items-center gap-2 mb-2">
            <Check className={cn("w-4 h-4", isDark ? "text-cyan-300" : "text-primary")} />
            <span className={cn("text-sm font-semibold", isDark && "text-cyan-200")}>
              You chose: {choice.option_label}
            </span>
          </div>
          {selectedOption?.detail && (
            <p className={cn("text-sm mb-3", isDark ? "text-white/70" : "text-foreground/75")}>
              {selectedOption.detail}
            </p>
          )}
          {choice.companion_reply && (
            <blockquote className={cn(
              "border-l-2 pl-3 text-sm italic",
              isDark ? "border-cyan-300/50 text-white/90" : "border-primary/40 text-foreground/90",
            )}>
              “{choice.companion_reply}”
              <footer className="mt-1 text-xs not-italic opacity-70">— {companionName}</footer>
            </blockquote>
          )}

          {choice.side_quest_title && choice.side_quest_status === "proposed" && (
            <div className={cn("mt-4 pt-4 border-t", isDark ? "border-white/10" : "border-border/60")}>
              <div className="flex items-start gap-2 mb-3">
                <Compass className={cn("w-4 h-4 mt-0.5 shrink-0", isDark ? "text-cyan-300" : "text-primary")} />
                <div>
                  <p className={cn("text-xs font-semibold uppercase tracking-wide", isDark ? "text-cyan-200" : "text-primary")}>
                    Optional side quest
                  </p>
                  <p className={cn("text-sm", isDark ? "text-white/80" : "text-foreground/85")}>
                    {choice.side_quest_title}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => void acceptSideQuest()}
                  disabled={acceptSideQuestMutation.isPending || updateSideQuest.isPending}
                >
                  {acceptSideQuestMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Add to Inbox
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void dismissSideQuest()}
                  disabled={updateSideQuest.isPending}
                  className={cn(isDark && "text-white/70 hover:text-white hover:bg-white/10")}
                >
                  <X className="w-4 h-4 mr-2" />
                  Not now
                </Button>
              </div>
            </div>
          )}

          {choice.side_quest_status === "accepted" && (
            <p className={cn("mt-4 text-xs font-medium", isDark ? "text-emerald-300" : "text-emerald-600 dark:text-emerald-400")}>
              Side quest saved to your Inbox.
            </p>
          )}
        </Card>
      </motion.div>
    );
  }

  return (
    <Card className={cn(
      "p-5 border-primary/20 bg-gradient-to-br from-primary/5 to-violet-500/5",
      isDark && "bg-gradient-to-br from-cyan-500/10 to-violet-500/10 border-white/10",
    )}>
      <fieldset disabled={recordChoice.isPending}>
        <legend className={cn("text-base font-semibold mb-1", isDark && "text-white")}>
          {prompt.question}
        </legend>
        <p className={cn("text-xs mb-4", isDark ? "text-white/55" : "text-muted-foreground")}>
          Your answer becomes part of the story’s canon.
        </p>
        <div className="grid gap-2">
          {prompt.options.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => void choose(option.key)}
              className={cn(
                "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isDark
                  ? "border-white/15 bg-white/5 hover:bg-white/10 text-white"
                  : "border-border/70 bg-background/60 hover:bg-primary/5 hover:border-primary/35",
              )}
            >
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className={cn("block text-xs mt-1 line-clamp-2", isDark ? "text-white/60" : "text-muted-foreground")}>
                {option.detail}
              </span>
            </button>
          ))}
        </div>
        <label className={cn("block mt-4 text-xs font-medium", isDark ? "text-white/65" : "text-muted-foreground")}>
          Add a private note (optional)
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value.slice(0, 1000))}
            placeholder="What did this moment mean to you?"
            className={cn("mt-2 min-h-20", isDark && "bg-black/20 border-white/15 text-white placeholder:text-white/35")}
          />
        </label>
        {recordChoice.isPending && (
          <div className={cn("flex items-center gap-2 mt-3 text-xs", isDark ? "text-white/60" : "text-muted-foreground")}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Weaving your answer into the canon…
          </div>
        )}
      </fieldset>
    </Card>
  );
}
