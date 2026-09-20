import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCalendarIntegrations, type ConnectedCalendar } from "@/hooks/useCalendarIntegrations";
import { useCalendarQuestImports } from "@/hooks/useCalendarQuestImports";
import { NativeCalendar } from "@/plugins/NativeCalendarPlugin";
import type { NativeReminder } from "@/plugins/NativeCalendarTypes";
import { supabase } from "@/integrations/supabase/client";
import { calendarQuestSnapshot } from "@/utils/calendarSyncMerge";
import { Button } from "@/components/ui/button";
import { ExportQuestToTaskList } from './ExportQuestToTaskList';

function taskAccessError(error: unknown, provider: string, fallback: string): string {
  if (provider !== "apple") return error instanceof Error ? error.message : fallback;
  const message = error instanceof Error ? error.message :
    typeof error === "object" && error !== null && "message" in error ? String(error.message) : "";
  if (/not implemented|unimplemented|unavailable on this platform/i.test(message)) {
    return "Apple Reminders isn't available in this version of the app. Update Cosmiq and try again. Your reminders are unchanged.";
  }
  if (/wasn't granted|Approve Reminders access first|access.*denied/i.test(message)) {
    return "Reminders access wasn't granted. You can enable it for Cosmiq in iPhone Settings.";
  }
  return "Couldn't connect to Apple Reminders. Try again, and check Cosmiq's Reminders access in iPhone Settings. Your reminders are unchanged.";
}

export function ConnectedTasks() {
  const { connections } = useCalendarIntegrations();
  const { links, invalidate } = useCalendarQuestImports();
  const cache = useQueryClient();
  const [connection, setConnection] = useState<ConnectedCalendar | null>(null);
  const [lists, setLists] = useState<Array<{ id: string; title: string; readOnly?: boolean }>>([]);
  const [tasks, setTasks] = useState<NativeReminder[]>([]);
  const [listId, setListId] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [sync, setSync] = useState(true);
  if (!connections.length) return null;
  const cloud = async (conn: ConnectedCalendar, action: string, listId?: string) => {
    const { data, error: requestError } = await supabase.functions.invoke("calendar-task-items", { body: { action, provider: conn.provider, connectionId: conn.id, listId } });
    if (requestError) throw new Error("Could not read tasks. Reconnect this account in Preferences and approve task access.");
    return data.items;
  };
  return <details className="rounded-xl border border-border/40 p-3 text-sm">
    <summary className="cursor-pointer py-2">Connected tasks and reminders</summary>
    <p className="my-3 text-muted-foreground">Choose the items to bring into Goals. Unselected tasks remain untouched.</p>
    <div className="flex flex-wrap gap-2">{connections.map((conn) => <Button key={conn.id} variant="ghost" size="sm" disabled={busy} onClick={async () => {
      setBusy(true); setError(null); setConnection(conn); setLists([]); setTasks([]); setListId('');
      try {
        if (conn.provider === "apple") {
          const permission = await NativeCalendar.requestReminderPermissions();
          if (!permission.granted) throw new Error("Reminders access wasn't granted. You can enable it in iOS Settings.");
          setLists((await NativeCalendar.listReminderLists()).lists);
        } else setLists(await cloud(conn, "lists"));
      } catch (e) { setError(taskAccessError(e, conn.provider, "Could not load task lists.")); }
      finally { setBusy(false); }
    }}>{conn.provider === "apple" ? "Apple Reminders" : conn.provider === "google" ? "Google Tasks" : "Microsoft To Do"}</Button>)}</div>
    {lists.length > 0 && <label className="block my-3">Task list<select className="ml-3 rounded border bg-background p-2" disabled={busy} value={listId} onChange={async (e) => {
      if (!connection || !e.target.value) return; setBusy(true); setError(null); setTasks([]);
      setListId(e.target.value);
      try { setTasks(connection.provider === "apple" ? (await NativeCalendar.listReminders({ listId: e.target.value })).tasks : await cloud(connection, "tasks", e.target.value)); }
      catch (e) { setError(taskAccessError(e, connection.provider, "Could not load tasks.")); } finally { setBusy(false); }
    }}><option value="" disabled>Choose a list</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.title}</option>)}</select></label>}
    {connection && listId && !lists.find((list) => list.id === listId)?.readOnly && (connection.provider === 'google' || connection.provider === 'apple') &&
      <ExportQuestToTaskList key={`${connection.id}:${listId}`} connectionId={connection.id} provider={connection.provider}
        listId={listId} listName={lists.find((list) => list.id === listId)?.title ?? 'selected list'} onBusyChange={setBusy} />}
    {tasks.length > 0 && <label className="my-3 flex items-center gap-2"><input type="checkbox" checked={sync} onChange={(e) => setSync(e.target.checked)} />Sync linked titles, due dates and completion both ways</label>}
    <ul className="max-h-80 overflow-y-auto divide-y divide-border/40">{tasks.map((task) => {
      const linked = links.some((link) => link.connection_id === connection?.id && link.resource_kind === "task" && link.calendar_id === task.listId && link.external_id === task.id);
      return <li key={task.id} className="flex items-center justify-between gap-3 py-3"><div><p>{task.title}</p><p className="text-xs text-muted-foreground">{task.completed ? "Complete" : task.dueDate || "No due date"}</p></div>
        <Button size="sm" variant="ghost" disabled={busy || linked} onClick={async () => {
          if (!connection) return; setBusy(true); setError(null);
          try {
            const { error } = await supabase.rpc("import_calendar_quest" as never, {
              p_connection_id: connection.id, p_calendar_id: task.listId, p_external_id: task.id, p_kind: "task",
              p_sync_enabled: sync, p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              p_snapshot: calendarQuestSnapshot({ task_text: task.title, task_date: task.dueDate, notes: task.notes, completed: task.completed, estimated_duration: 30 }),
            } as never);
            if (error) throw error;
            await invalidate(); void cache.invalidateQueries({ queryKey: ["calendar-quest-imports"] });
          } catch { setError("Could not link this task. Please retry; the original is unchanged."); } finally { setBusy(false); }
        }}>{linked ? "Linked" : "Add to Goals"}</Button></li>;
    })}</ul>
    {busy && <p role="status" className="text-muted-foreground">Loading…</p>}
    {error && <p role="alert" className="text-muted-foreground mt-3">{error}</p>}
  </details>;
}
