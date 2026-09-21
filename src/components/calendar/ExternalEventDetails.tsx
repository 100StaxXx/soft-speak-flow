import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCalendarQuestImports } from "@/hooks/useCalendarQuestImports";
import { findEventConflicts, type ExternalCalendarEvent } from "@/types/externalCalendar";
import { findQuestConflicts, type AvailabilityQuest } from '@/utils/calendarAvailability';

export function ExternalEventDetails({ event, events, quests = [], onClose }: {
  event: ExternalCalendarEvent; events: ExternalCalendarEvent[]; quests?: AvailabilityQuest[]; onClose: () => void;
}) {
  const { importEvent, links } = useCalendarQuestImports();
  const [sync, setSync] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const matchingLinks = links.filter((link) => link.resource_kind !== 'task' && link.provider === event.provider && link.calendar_id === event.calendarId && link.external_id === event.id
    && (!event.connectionId || link.connection_id === event.connectionId));
  const linked = matchingLinks.length > 0;
  const conflicts = findEventConflicts(event, events);
  const questConflicts = findQuestConflicts(event, quests, matchingLinks.map((link) => link.task_id));
  const conflictNames = [...conflicts.map((other) => other.title), ...questConflicts.map((task) => task.task_text)];
  const safeLink = (url: string | null | undefined) => url && /^https?:\/\//i.test(url) ? url : null;
  const htmlLink = safeLink(event.htmlLink); const meetingUrl = safeLink(event.meetingUrl);
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>{event.title}</DialogTitle>
        <DialogDescription>{event.calendarName} · {event.isAllDay ? "All day" : new Date(event.startDate).toLocaleString()}</DialogDescription>
      </DialogHeader>
      {event.isRecurring && <p className="text-sm text-muted-foreground">Repeating event. Linking creates a quest for this occurrence only.</p>}
      {event.location && <p className="text-sm">{event.location}</p>}
      {event.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{event.notes}</p>}
      {conflictNames.length > 0 && <p className="text-sm text-muted-foreground">Overlaps on this agenda: {conflictNames.join(", ")}.</p>}
      <div className="flex flex-wrap gap-3 text-sm">
        {meetingUrl && <a className="underline" href={meetingUrl} target="_blank" rel="noreferrer">Join meeting</a>}
        {event.location && <a className="underline" href={`https://maps.apple.com/?daddr=${encodeURIComponent(event.location)}`} target="_blank" rel="noreferrer">Directions</a>}
        {htmlLink && <a className="underline" href={htmlLink} target="_blank" rel="noreferrer">Open original</a>}
      </div>
      {!linked && !importEvent.isSuccess ? <>
        <p className="text-sm text-muted-foreground">This event stays read-only unless you link it. Importing does not award XP or mark it complete.</p>
        <label className="flex items-center gap-3 text-sm py-2"><input type="checkbox" checked={sync} onChange={(e) => setSync(e.target.checked)} />Keep this quest and event updated both ways</label>
        <Button variant="secondary" disabled={importEvent.isPending} onClick={async () => {
          setMessage(null);
          try { await importEvent.mutateAsync({ event, sync }); setMessage("Quest added. Your original event is preserved."); }
          catch (error) { setMessage(error instanceof Error ? error.message : "Could not import event."); }
        }}>{importEvent.isPending ? "Adding…" : "Turn into a quest"}</Button>
      </> : <p className="text-sm">Already linked to a quest.</p>}
      {message && <p role="status" className="text-sm">{message}</p>}
    </DialogContent>
  </Dialog>;
}
