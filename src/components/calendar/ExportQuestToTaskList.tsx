import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { exportQuestToTaskList } from '@/services/calendarTaskExport';
import { Button } from '@/components/ui/button';

export function ExportQuestToTaskList({ connectionId, provider, listId, listName, onBusyChange }: {
  connectionId: string; provider: 'google' | 'apple'; listId: string; listName: string; onBusyChange: (busy: boolean) => void;
}) {
  const { user } = useAuth(); const cache = useQueryClient();
  const [open, setOpen] = useState(false); const [taskId, setTaskId] = useState('');
  const [sync, setSync] = useState(false); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null); const [needsCheck, setNeedsCheck] = useState(false);
  const quests = useQuery({ queryKey: ['calendar-export-quests',user?.id], enabled: open && !!user,
    queryFn: async () => {
      const { data,error } = await supabase.from('daily_tasks').select('id,task_text,task_date').eq('user_id',user!.id)
        .eq('completed',false).order('created_at',{ascending:false}).limit(100);
      if (error) throw error; return data ?? [];
    }, staleTime: 0 });
  const destination = provider === 'google' ? 'Google Tasks' : 'Apple Reminders';
  return <details className="my-3 border-t border-border/40 pt-3" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer py-2">Send a quest to {destination}</summary>
    <p className="my-2 text-xs text-muted-foreground">Creates one task in {listName}. The due date is included; calendar times, repeat rules and alarms stay in Cosmiq.</p>
    <label className="block py-2">Quest to send<select className="mt-2 w-full rounded border bg-background p-2" value={taskId} disabled={busy || needsCheck} onChange={(event) => { setTaskId(event.target.value); setMessage(null); }}>
      <option value="">Choose a quest</option>{quests.data?.map((task) => <option key={task.id} value={task.id}>{task.task_text}{task.task_date ? ` · ${task.task_date}` : ''}</option>)}
    </select></label>
    <p className="text-xs text-muted-foreground">Your 100 most recent unfinished quests.</p>
    {quests.isError && <p role="alert" className="my-2 text-sm">Quests could not load. Close and reopen this section to retry.</p>}
    <label className="my-3 flex items-center gap-2"><input type="checkbox" checked={sync} disabled={busy || needsCheck} onChange={(event) => setSync(event.target.checked)}/>Keep title, due date and completion updated both ways</label>
    <Button size="sm" variant="secondary" disabled={!taskId || busy || !user} onClick={async () => {
      if (!user) return; setBusy(true); onBusyChange(true); setMessage(null);
      try {
        const result = await exportQuestToTaskList({ userId:user.id, taskId, connectionId, provider, listId, sync });
        setMessage(result?.alreadySent ? `This quest was already sent to ${destination}. No extra copy was created.`
          : `Sent to ${destination}. Your quest is still in Cosmiq.`); setNeedsCheck(false); setTaskId('');
        await cache.invalidateQueries({ queryKey: ['calendar-quest-imports',user.id] });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'The send could not be confirmed. Check status again.'); setNeedsCheck(true);
      } finally { setBusy(false); onBusyChange(false); }
    }}>{busy ? 'Checking…' : needsCheck ? 'Check send status' : 'Send selected quest'}</Button>
    {needsCheck && <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setNeedsCheck(false); setTaskId(''); setMessage(null); }}>Choose another quest</Button>}
    {message && <p role="status" className="my-3 text-sm text-muted-foreground">{message}</p>}
  </details>;
}
