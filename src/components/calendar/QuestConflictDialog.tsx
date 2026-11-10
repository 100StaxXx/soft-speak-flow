import { AlertTriangle, CalendarClock, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { QuestScheduleAnalysis } from "@/utils/questScheduleConflicts";

export interface QuestConflictReview {
  title: string;
  date: string;
  analysis?: QuestScheduleAnalysis;
  incomplete?: boolean;
}

export function QuestConflictDialog({ review, onChoose, onChooseAnotherDay }: {
  onChooseAnotherDay?: () => void;
  review: QuestConflictReview | null; onChoose: (choice: "keep" | "next" | "cancel") => void;
}) {
  if (!review) return null;
  const analysis = review?.analysis;
  const loading = !!review && !analysis;
  const nextLabel = analysis?.nextTime && review ? format(parseISO(`${review.date}T${analysis.nextTime}`), "h:mm a") : null;
  return <AlertDialog open={!!review} onOpenChange={open => { if (!open) onChoose("cancel"); }}>
    <AlertDialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border-amber-200/20 bg-gradient-to-br from-slate-900 to-slate-950 p-5 text-slate-100 shadow-2xl sm:rounded-3xl">
      <AlertDialogHeader className="text-left">
        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-200/10 text-amber-200">
          {loading ? <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" /> : <CalendarClock className="h-5 w-5" />}
        </div>
        <AlertDialogTitle className="text-xl">{loading ? "Checking your schedule" : analysis?.invalidTime ? "Choose another time" : analysis?.conflicts.length ? "A little overlap" : "Check your schedule"}</AlertDialogTitle>
        <AlertDialogDescription className="text-slate-300">
          {loading ? "Looking at your quests and connected calendars…" : analysis?.invalidTime
            ? "This local time does not exist because the clocks change. Go back and choose another time."
            : `Before saving “${review?.title}”, choose the time that works for you.`}
        </AlertDialogDescription>
      </AlertDialogHeader>
      {!!analysis?.conflicts.length && <ul className="space-y-2" aria-label="Overlapping items">
        {analysis.conflicts.slice(0, 4).map((conflict, index) => <li key={`${conflict.id}:${index}`} className="rounded-2xl border border-amber-200/10 bg-amber-200/5 p-3 text-sm">
          <span className="flex items-start gap-2"><AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" /><span className="break-words font-medium">{conflict.title}</span></span>
          <span className="mt-1 block pl-6 text-xs text-slate-300">{format(parseISO(conflict.date), "MMM d")} · {conflict.overlapMinutes} min overlap{conflict.source === "calendar" ? " · Calendar" : conflict.source === "commitment" ? " · Fixed commitment" : ""}</span>
        </li>)}
        {analysis.conflicts.length > 4 && <li className="text-xs text-slate-300">And {analysis.conflicts.length - 4} more overlaps.</li>}
      </ul>}
      {analysis?.recurring && <p className="text-xs text-slate-300">Repeats checked through {format(parseISO(analysis.throughDate), "MMM d, yyyy")} (30-day window). Later dates can change.</p>}
      {review?.incomplete && <p role="status" className="rounded-xl bg-white/5 p-3 text-sm text-amber-100">Some schedule information couldn’t be checked. You can keep this time, or go back and try again when connected.</p>}
      {analysis && !analysis.invalidTime && <div className="grid gap-2">
        {nextLabel && !review?.incomplete && <Button className="h-auto min-h-12 flex-col rounded-2xl bg-amber-200 py-3 text-slate-950 hover:bg-amber-100" onClick={() => onChoose("next")}>
          <span>Next available time</span><span className="text-xs font-normal">{nextLabel}{analysis.recurring ? " · for these repeats" : " · same date"}</span>
        </Button>}
        {!analysis.nextTime && !review?.incomplete && <p className="text-xs text-slate-300">No later opening fits{analysis.recurring ? " all these repeats" : " on this date"}. Choose another date or time, or keep the overlap.</p>}
        {!analysis.nextTime && !review.incomplete && analysis.conflicts.length > 0 && onChooseAnotherDay && (
          <Button className="min-h-12 rounded-2xl bg-amber-200 text-slate-950 hover:bg-amber-100" onClick={onChooseAnotherDay}>Choose another day</Button>
        )}
        <Button variant="outline" className="min-h-12 rounded-2xl border-white/20 bg-white/5 text-slate-100 hover:bg-white/10" onClick={() => onChoose("keep")}>Keep this time</Button>
      </div>}
      <AlertDialogCancel asChild><Button variant="ghost" className="m-0 min-h-11 border-0 bg-transparent text-slate-300 shadow-none" onClick={() => onChoose("cancel")}>{loading ? "Cancel" : "Go back"}</Button></AlertDialogCancel>
    </AlertDialogContent>
  </AlertDialog>;
}
