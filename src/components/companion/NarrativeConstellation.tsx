import { motion, useReducedMotion } from "framer-motion";
import { BookMarked, CircleDot, Loader2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useCompanionNarrativeMemories } from "@/hooks/useCompanionNarrativeMemories";
import type { LivingNarrativeMemoryType } from "@/types/livingNarrative";

const memoryLabels: Record<LivingNarrativeMemoryType, string> = {
  choice: "Choice",
  discovery: "Discovery",
  promise: "Promise",
  reflection: "Wisdom",
  item: "Keepsake",
  relationship: "Bond",
};

interface NarrativeConstellationProps {
  companionId: string;
  companionName: string;
}

export function NarrativeConstellation({
  companionId,
  companionName,
}: NarrativeConstellationProps) {
  const shouldReduceMotion = useReducedMotion();
  const { data: memories = [], isLoading, error } = useCompanionNarrativeMemories(companionId);

  if (error || (!isLoading && memories.length === 0)) return null;

  return (
    <Card className="relative overflow-hidden border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-background to-cyan-500/5 p-5">
      <div
        aria-hidden="true"
        className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-violet-500/15 blur-3xl"
      />
      <div className="relative flex items-start gap-3">
        <div className="rounded-full border border-violet-500/25 bg-violet-500/10 p-2">
          <BookMarked className="h-4 w-4 text-violet-600 dark:text-violet-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Constellation of Choices</h2>
              <p className="text-xs text-muted-foreground">
                What you and {companionName} have made true together.
              </p>
            </div>
            {!isLoading && (
              <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
                {memories.length} remembered
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground" aria-busy="true">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Tracing your canon…
            </div>
          ) : (
            <ul className="mt-4 grid gap-3 md:grid-cols-3">
              {memories.slice(0, 3).map((memory, index) => (
                <motion.li
                  key={memory.id}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={shouldReduceMotion ? undefined : { delay: index * 0.08 }}
                  className="rounded-xl border border-violet-500/15 bg-background/60 p-3"
                >
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                    {memory.memory_type === "promise" ? (
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <CircleDot className="h-3 w-3" aria-hidden="true" />
                    )}
                    {memoryLabels[memory.memory_type]}
                  </div>
                  <p className="line-clamp-4 text-xs leading-relaxed text-foreground/80">
                    {memory.summary}
                  </p>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
