import { motion } from "framer-motion";
import { CheckCircle2, ChevronRight, Compass } from "lucide-react";

import type { DailyAdventureDecision, DailyAdventureState } from "@/lib/dailyAdventure";
import { cn } from "@/lib/utils";

interface DailyAdventureChoicesProps {
  decision: DailyAdventureDecision;
  state: DailyAdventureState;
  disabled?: boolean;
  prefersReducedMotion?: boolean;
  onChoose: (optionId: string) => void;
}

export function DailyAdventureChoices({
  decision,
  state,
  disabled = false,
  prefersReducedMotion = false,
  onChoose,
}: DailyAdventureChoicesProps) {
  return (
    <section
      className="overflow-hidden rounded-[1.4rem] border border-primary/25 bg-background/72 p-3.5 text-left shadow-[0_18px_50px_rgba(14,45,27,0.12)] backdrop-blur-xl sm:p-4"
      data-testid="daily-adventure-choices"
      data-decision-kind={decision.kind}
      aria-labelledby="daily-adventure-prompt"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
          {state.eveningChoice ? (
            <CheckCircle2 className="h-4.5 w-4.5" aria-hidden="true" />
          ) : (
            <Compass className="h-4.5 w-4.5" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            {decision.eyebrow}
          </p>
          <p id="daily-adventure-prompt" className="mt-1 text-sm font-semibold leading-6 text-foreground sm:text-[15px]">
            {decision.prompt}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2" role="group" aria-label="Choose the next story decision">
        {decision.options.map((option, index) => (
          <motion.button
            key={option.id}
            type="button"
            className={cn(
              "group flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold leading-5 transition-colors",
              "border-primary/20 bg-card/88 text-foreground hover:border-primary/45 hover:bg-primary/[0.08]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-55",
            )}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.22, delay: prefersReducedMotion ? 0 : index * 0.045 }}
            disabled={disabled}
            onClick={() => onChoose(option.id)}
          >
            <span>{option.label}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-primary/70 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </motion.button>
        ))}
      </div>

      {state.path ? (
        <p className="mt-3 text-center text-[11px] font-medium text-foreground/60">
          {state.path.title} · {state.storyBeats.length} {state.storyBeats.length === 1 ? "choice" : "choices"} recorded today
        </p>
      ) : null}
    </section>
  );
}
