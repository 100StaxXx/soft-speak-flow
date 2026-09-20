import { calendarAccessToken } from '../_shared/calendarConnectionAccess.ts';

const base = 'https://tasks.googleapis.com/tasks/v1';
export const taskExportMarker = (id: string) => `[Cosmiq task link: ${id}]`;
type Result = { status: number; body: Record<string, unknown> };
const result = (status: number, body: Record<string, unknown>): Result => ({ status, body });
const uncertain = () => result(409, { code: 'EXPORT_UNCERTAIN', error: 'The first send may still be processing. Check Google Tasks, then check status again. Cosmiq will not send another copy.' });

/** One durable intent permits at most one unconfirmed create. Recovery is read-only. */
export async function exportGoogleTask(db: any, userId: string, intentId: unknown,
  deps: { fetch: typeof fetch; env: (key: string) => string | undefined }): Promise<Result> {
  if (typeof intentId !== 'string' || !/^[0-9a-f-]{36}$/i.test(intentId)) return result(400, { error: 'Choose a quest to send.' });
  const { data: intent, error } = await db.from('calendar_task_exports').select('*').eq('id', intentId).eq('user_id', userId).maybeSingle();
  if (error) return result(503, { error: 'Task sending is temporarily unavailable.' });
  if (!intent || intent.provider !== 'google') return result(404, { error: 'Task send not found.' });
  if (intent.status === 'complete') return result(200, { complete: true, externalId: intent.external_id });
  const { data: conn, error: connectionError } = await db.from('user_calendar_connections').select('*')
    .eq('id', intent.connection_id).eq('user_id', userId).eq('provider', 'google').eq('sync_enabled', true).maybeSingle();
  if (connectionError || !conn) return result(409, { error: 'Reconnect Google in Preferences before sending.' });
  const access = await calendarAccessToken(db, conn, deps.env, deps.fetch);
  const request = (url: string, init: RequestInit = {}) => deps.fetch(url, { ...init,
    headers: { Authorization: `Bearer ${access}`, ...init.headers }, signal: AbortSignal.timeout(20000) });
  const finish = async (externalId: string) => {
    const { data, error } = await db.rpc('complete_calendar_task_export', { p_id: intent.id, p_user_id: userId, p_external_id: externalId });
    return error || !data ? result(503, { error: 'The task was found but linking could not finish. Check status again; do not create another copy.' })
      : result(200, { complete: true, externalId });
  };
  const tasksUrl = `${base}/lists/${encodeURIComponent(intent.list_id)}/tasks`;
  if (intent.status === 'dispatched') {
    let pageToken: string | undefined;
    const found = new Set<string>();
    for (let page = 0; page < 20; page++) {
      const url = new URL(tasksUrl); url.search = new URLSearchParams({ showCompleted: 'true', showHidden: 'true', maxResults: '100', ...(pageToken ? { pageToken } : {}) }).toString();
      const response = await request(url.toString());
      if (!response.ok) return result(503, { error: 'Could not check the first send. Reconnect Google if task access has changed.' });
      const data = await response.json();
      for (const task of data.items ?? []) {
        if (!task.deleted && typeof task.id === 'string' && typeof task.notes === 'string'
          && task.notes.split('\n').includes(taskExportMarker(intent.id))) found.add(task.id);
      }
      pageToken = typeof data.nextPageToken === 'string' ? data.nextPageToken : undefined;
      if (!pageToken) {
        if (found.size === 1) return finish([...found][0]);
        if (found.size > 1) return result(409, { error: 'More than one matching task was found. Review the copies in Google Tasks before linking.' });
        return uncertain();
      }
    }
    return result(422, { error: 'This task list is too large to check safely. No new copy was sent.' });
  }
  // Resolve authorization/list errors before consuming the one create attempt.
  const list = await request(`${base}/users/@me/lists/${encodeURIComponent(intent.list_id)}`);
  if (!list.ok) return result(409, { error: 'This task list is unavailable. Reconnect Google and choose an accessible list.' });
  const { data: claimed, error: claimError } = await db.rpc('claim_calendar_task_export', { p_id: intent.id, p_user_id: userId });
  if (claimError) return result(503, { error: 'Could not safely start sending. Please retry.' });
  if (!claimed) return uncertain();
  const snap = claimed.snapshot;
  let response: Response;
  try {
    response = await request(tasksUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      title: snap.task_text, notes: [snap.notes, taskExportMarker(intent.id)].filter(Boolean).join('\n\n'),
      status: snap.completed ? 'completed' : 'needsAction',
      ...(snap.task_date ? { due: `${snap.task_date}T00:00:00Z` } : {}),
    }) });
  } catch { return uncertain(); }
  if (!response.ok) {
    if ([400,401,403,404].includes(response.status)) {
      await db.rpc('reset_rejected_calendar_task_export', { p_id: intent.id, p_user_id: userId, p_attempt_id: claimed.attempt_id });
      return result(409, { error: 'Google rejected the task. Check task details and account access, then retry.' });
    }
    return uncertain();
  }
  let task: any;
  try { task = await response.json(); } catch { return uncertain(); }
  if (typeof task.id !== 'string' || !task.id) return uncertain();
  return finish(task.id);
}
