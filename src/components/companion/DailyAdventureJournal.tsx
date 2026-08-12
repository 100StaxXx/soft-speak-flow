import { format, parseISO } from "date-fns";
import { BookMarked, CheckCircle2, Clock3, Orbit } from "lucide-react";

import { Card } from "@/components/ui/card";
import { useDailyAdventureHistory } from "@/hooks/useDailyMissionThread";
import { parseDailyAdventureState, type DailyAdventureOutcome } from "@/shared/dailyAdventure";

const outcomeLabel = (outcome: DailyAdventureOutcome | null) => {
  if (outcome === "quest_completed") return "Quest completed";
  if (outcome === "carried_forward") return "Carried forward";
  if (outcome === "released") return "Day released";
  return "Chapter closed";
};

export function DailyAdventureJournal({ companionName }: { companionName: string }) {
  const { data: threads = [], isLoading, error } = useDailyAdventureHistory(7);

  return (
    <Card className="overflow-hidden border-cyan-200/15 bg-gradient-to-br from-cyan-300/[0.07] via-background/90 to-violet-300/[0.08] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/80">
            <BookMarked className="h-3.5 w-3.5" aria-hidden="true" />
            Adventure Log
          </p>
          <h2 className="mt-1.5 text-lg font-semibold">The days you shaped together</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Daily choices become shared history. {companionName} can carry these routes into future conversations.
          </p>
        </div>
        <Orbit className="h-5 w-5 shrink-0 text-cyan-100/70" aria-hidden="true" />
      </div>

      {isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock3 className="h-4 w-4 animate-pulse" aria-hidden="true" />
          Recalling your recent routes…
        </div>
      ) : error ? (
        <p className="mt-4 text-xs text-muted-foreground">Recent adventures are temporarily off-map.</p>
      ) : threads.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-white/8 bg-black/10 px-3 py-3 text-sm text-muted-foreground">
          Your first completed Daily Adventure will appear here.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {threads.map((thread) => {
            const state = parseDailyAdventureState(thread.adventure_state);
            const decisions = [
              state?.morningChoice?.label,
              state?.crossroadsChoice?.label,
              state?.eveningChoice?.label,
            ].filter((decision): decision is string => Boolean(decision));
            return (
              <article key={thread.id} className="rounded-2xl border border-white/8 bg-black/10 px-3.5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100/65">
                      {format(parseISO(thread.mission_date), "EEE, MMM d")}
                    </p>
                    <h3 className="mt-1 truncate text-sm font-semibold text-foreground">
                      {state?.chapterTitle || thread.primary_task_title}
                    </h3>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-100/15 bg-emerald-300/[0.07] px-2 py-1 text-[10px] font-medium text-emerald-100/75">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    {outcomeLabel(state?.outcome ?? null)}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-foreground/80">{thread.primary_task_title}</p>
                {decisions.length > 0 ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    {decisions.join(" → ")}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </Card>
  );
}
