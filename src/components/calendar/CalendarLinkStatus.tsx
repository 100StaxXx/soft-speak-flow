import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCalendarQuestImports } from "@/hooks/useCalendarQuestImports";
import { syncImportedCalendarQuest } from "@/services/calendarQuestSync";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function CalendarLinkStatus() {
  const { user } = useAuth(); const { links, invalidate } = useCalendarQuestImports();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const issues = links.filter((link) => link.sync_enabled && link.sync_status !== "linked");
  if (!links.length) return null;
  return <details className="space-y-3 text-sm" open={issues.length > 0}>
    <summary className="cursor-pointer py-2">Linked quests ({links.length}){issues.length ? ` · ${issues.length} need attention` : ''}</summary>
    {links.map((link) => <label key={link.id} className="flex items-center justify-between gap-3 py-2">
      <span>{link.baseline.task_text}<span className="block text-xs text-muted-foreground">Two-way sync · {link.provider}</span></span>
      <input type="checkbox" checked={link.sync_enabled} disabled={busy !== null} onChange={async (event) => {
        setBusy(link.id); setError(null);
        try { const { error } = await supabase.rpc("set_calendar_quest_sync" as never, { p_link_id: link.id, p_enabled: event.target.checked } as never);
          if (error) throw error; await invalidate(); } catch { setError("Could not change link settings. Please retry."); } finally { setBusy(null); }
      }} />
    </label>)}
    {issues.map((link) => <div key={link.id} className="rounded-lg border border-border/50 p-3 space-y-2">
      <p>{link.baseline.task_text}</p><p className="text-muted-foreground">{link.last_error}</p>
      <div className="flex flex-wrap gap-2">{(link.sync_status === "conflict" ? ["local", "remote"] as const : [undefined]).map((resolution) =>
        <Button key={resolution ?? "retry"} variant="ghost" size="sm" disabled={busy !== null} onClick={async () => {
          if (!user) return; setBusy(link.id); setError(null);
          try { await syncImportedCalendarQuest(link, user.id, resolution); await invalidate(); }
          catch { setError("Couldn't refresh this link. Please retry."); } finally { setBusy(null); }
        }}>{resolution === "local" ? "Keep Cosmiq version" : resolution === "remote" ? "Keep calendar version" : "Check again"}</Button>)}</div>
    </div>)}
    {error && <p role="alert">{error}</p>}
  </details>;
}
