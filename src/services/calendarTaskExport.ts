import { supabase } from '@/integrations/supabase/client';
import { NativeCalendar } from '@/plugins/NativeCalendarPlugin';
import type { CalendarQuestSnapshot } from '@/utils/calendarSyncMerge';
import { parseFunctionInvokeError } from '@/utils/supabaseFunctionErrors';

interface ExportIntent {
  id: string; provider: 'google' | 'apple'; status: 'ready' | 'dispatched' | 'complete';
  snapshot: CalendarQuestSnapshot; list_id: string; external_id: string | null;
}
async function bounded<T>(request: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve(request), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('The send check timed out. Check status again; an uncertain send will not create a second copy.')), 30000);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await bounded(supabase.rpc(name as never, args as never));
  if (error) throw new Error('Could not safely prepare this send. Check the connection and task details, then retry.');
  return data as T;
}

/** Only a user click calls this service. No background task creates outside items. */
export async function exportQuestToTaskList(options: { userId: string; taskId: string; connectionId: string;
  provider: 'google' | 'apple'; listId: string; sync: boolean }) {
  const verifyOwner = async () => {
    const { data, error } = await bounded(supabase.auth.getSession());
    if (error || data.session?.user.id !== options.userId) throw new Error('Sign in again before sending tasks.');
  };
  await verifyOwner();
  if (options.provider === 'apple') {
    const permission = await bounded(NativeCalendar.requestReminderPermissions());
    if (!permission.granted) throw new Error('Reminders access was not granted. Enable it in iOS Settings to send a reminder.');
    const { lists } = await bounded(NativeCalendar.listReminderLists());
    const destination = lists.find((list) => list.id === options.listId);
    if (!destination || destination.readOnly) throw new Error('Choose a writable Reminders list before sending.');
  }
  const intent = await rpc<ExportIntent>('prepare_calendar_task_export', {
    p_task_id: options.taskId, p_connection_id: options.connectionId, p_list_id: options.listId,
    p_sync_enabled: options.sync, p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  if (intent.status === 'complete') return { alreadySent: true };
  if (intent.provider !== options.provider) throw new Error('The account changed. Choose the task list again.');
  if (intent.provider === 'google') {
    const { data, error } = await bounded(supabase.functions.invoke('calendar-task-items', { body: { action: 'export', intentId: intent.id } }));
    if (error) {
      const parsed = await parseFunctionInvokeError(error);
      throw new Error(parsed.backendMessage || 'The send could not be confirmed. Check status again; no second copy will be sent.');
    }
    if (!data?.complete) throw new Error('The send is still being checked. Try checking status again.');
    return { alreadySent: false };
  }
  await verifyOwner();
  const claimed = intent.status === 'ready' ? await rpc<ExportIntent | null>('claim_calendar_task_export', { p_id: intent.id, p_user_id: options.userId }) : null;
  await verifyOwner();
  const source = claimed ?? intent;
  const { task } = await bounded(NativeCalendar.findOrCreateReminder({
    intentId: intent.id, listId: source.list_id, createIfMissing: Boolean(claimed),
    title: source.snapshot.task_text, notes: source.snapshot.notes, dueDate: source.snapshot.task_date,
    completed: source.snapshot.completed === true,
  }));
  if (!task) throw new Error('The first send is not visible in Reminders yet. Check Reminders, then check status again. No second copy was sent.');
  const complete = await rpc<boolean>('complete_calendar_task_export', { p_id: intent.id, p_user_id: options.userId, p_external_id: task.id });
  if (!complete) throw new Error('The reminder exists, but linking did not finish. Check status again to reconnect it.');
  return { alreadySent: false };
}
