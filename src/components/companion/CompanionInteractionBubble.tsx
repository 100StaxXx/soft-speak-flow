import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CompanionInteractionPrompt } from "@/config/companionBehaviors";

export const CompanionInteractionBubble = ({
  companionName,
  message,
  prompt,
  prefersReducedMotion,
  onAnswer,
  onDismiss,
}: {
  companionName: string;
  message: string | null;
  prompt: CompanionInteractionPrompt | null;
  prefersReducedMotion: boolean;
  onAnswer: (answerKey: string) => void;
  onDismiss: () => void;
}) => (
  <AnimatePresence>
    {message ? (
      <motion.div
        key={`${prompt?.key ?? "reaction"}:${message}`}
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
        transition={{ duration: prefersReducedMotion ? 0.12 : 0.22, ease: "easeOut" }}
        className="relative z-40 mx-auto mt-3 w-[min(92%,30rem)] rounded-2xl border border-primary/25 bg-background/95 p-3.5 text-left shadow-[0_18px_48px_hsl(var(--background)/0.55)] backdrop-blur-xl"
        role="region"
        aria-label={`${companionName} interaction`}
        data-testid="companion-interaction-bubble"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
              {companionName}
            </p>
            <p
              className="mt-1 text-sm leading-relaxed text-foreground"
              role="status"
              aria-live="polite"
            >
              {message}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-2 h-8 w-8 shrink-0 rounded-full"
            onClick={onDismiss}
            aria-label="Dismiss companion message"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {prompt ? (
          <div
            className="mt-3 flex flex-wrap gap-2 pl-11"
            role="group"
            aria-label="Choose a response"
          >
            {prompt.options.map((option) => (
              <Button
                key={option.key}
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 rounded-full border-primary/25 bg-primary/5 px-4 text-xs hover:bg-primary/12"
                onClick={() => onAnswer(option.key)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        ) : null}
      </motion.div>
    ) : null}
  </AnimatePresence>
);
