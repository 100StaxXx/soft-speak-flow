import { ArrowRight, Compass, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { DailyChapterConstellation, type DailyChapterStatus } from "@/components/DailyChapterConstellation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDailyMissionThread } from "@/hooks/useDailyMissionThread";
import { getEffectiveMissionDate } from "@/utils/timezone";

export function DailyChapterOverviewCard() {
  const navigate = useNavigate();
  const { thread, isLoading } = useDailyMissionThread(getEffectiveMissionDate());
  const status = (thread?.status ?? "unstarted") as DailyChapterStatus;
  const title = thread?.primary_task_title?.trim() || "Choose what today should become";

  return (
    <Card className="overflow-hidden border-cyan-300/16 bg-gradient-to-br from-cyan-400/[0.07] via-background/90 to-violet-500/[0.09] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/85">
            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            Daily Chapter
          </div>
          <h3 className="mt-2 line-clamp-2 text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {status === "reflected"
              ? "Today’s choice is part of your companion’s memory."
              : status === "completed"
                ? "One final reflection will close the chapter."
                : status === "active"
                  ? "Your intention is set. Complete the linked quest to move the story."
                  : "Set an intention, take one meaningful action, then reflect."}
          </p>
        </div>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-cyan-100" aria-label="Loading Daily Chapter" /> : null}
      </div>

      <div className="mt-4">
        <DailyChapterConstellation status={status} />
      </div>

      <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => navigate("/journeys")}>
        {status === "unstarted" ? "Begin today’s chapter" : "Open today’s chapter"}
        <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
      </Button>
    </Card>
  );
}
