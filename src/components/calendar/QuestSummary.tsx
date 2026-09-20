import { addMinutes, format, isValid, parseISO } from "date-fns";
import { Pencil, Check, Circle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QuestLocationLink } from "@/components/QuestLocationLink";
import { COMPANION_FROSTED_PLANNER_DARK_CLASS } from "@/lib/companionFrostedTheme";
import type { TaskAttachment } from "@/types/questAttachments";
import type { DailyTask } from "@/services/dailyTasksRemote";

export interface QuestSummaryTask {
  id: string;
  task_text: string;
  task_date?: string | null;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  completed?: boolean | null;
  notes?: string | null;
  location?: string | null;
  difficulty?: string | null;
  category?: string | null;
  recurrence_pattern?: string | null;
  reminder_enabled?: boolean | null;
  reminder_minutes_before?: number | null;
  attachments?: TaskAttachment[] | null;
  subtasks?: DailyTask["subtasks"] | null;
}

export function QuestSummary({ task, onClose, onEdit }: {
  task: QuestSummaryTask; onClose: () => void; onEdit: () => void;
}) {
  const date = task.task_date ? parseISO(task.task_date) : null;
  const start = task.task_date && task.scheduled_time ? parseISO(`${task.task_date}T${task.scheduled_time}`) : null;
  const duration = task.estimated_duration;
  const time = duration === 1440 ? "All day" : start && isValid(start)
    ? `${format(start, "h:mm a")}${duration ? ` – ${format(addMinutes(start, duration), "h:mm a")} (${duration} min)` : ""}`
    : "Not scheduled";
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className={`${COMPANION_FROSTED_PLANNER_DARK_CLASS} max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl p-5`}>
      <DialogHeader className="pr-7 text-left">
        <DialogDescription>Quest summary</DialogDescription>
        <DialogTitle className="break-words text-2xl font-semibold leading-tight">{task.task_text}</DialogTitle>
      </DialogHeader>
      <div className="space-y-1 rounded-xl bg-white/5 p-4 text-sm">
        <p>{date && isValid(date) ? format(date, "EEEE, MMMM d, yyyy") : "Inbox"}</p>
        <p className="text-muted-foreground">{time}</p>
        {task.completed && <p className="pt-2">Completed</p>}
      </div>
      {task.notes && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{task.notes}</p>}
      {task.location && <QuestLocationLink location={task.location} />}
      {!!task.subtasks?.length && <ul className="space-y-2 text-sm">{task.subtasks.map(subtask => <li key={subtask.id} className="flex items-center gap-2">
        {subtask.completed ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
        <span className={subtask.completed ? "line-through text-muted-foreground" : ""}>{subtask.title}</span>
      </li>)}</ul>}
      <details className="rounded-xl bg-white/5 p-4 text-sm">
        <summary className="cursor-pointer">Show more</summary>
        <dl className="mt-3 space-y-2 text-muted-foreground">
          <div><dt className="inline">Reminder: </dt><dd className="inline">{task.reminder_enabled ? `${task.reminder_minutes_before ?? 15} minutes before` : "Off"}</dd></div>
          <div><dt className="inline">Repeats: </dt><dd className="inline capitalize">{task.recurrence_pattern?.replaceAll("_", " ") || "Never"}</dd></div>
          {task.difficulty && <div className="capitalize">{task.difficulty} difficulty</div>}
          {task.category && <div className="capitalize">{task.category}</div>}
        </dl>
        {task.attachments?.filter(attachment => /^https?:\/\//i.test(attachment.fileUrl)).map(attachment => <a key={attachment.fileUrl} href={attachment.fileUrl} target="_blank" rel="noreferrer" className="mt-3 block underline">{attachment.fileName || "Attachment"}</a>)}
      </details>
      <Button variant="outline" onClick={onEdit} className="min-h-11 border-white/15 bg-white/5"><Pencil className="mr-2 h-4 w-4" />Edit quest</Button>
    </DialogContent>
  </Dialog>;
}
