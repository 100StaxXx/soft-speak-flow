/** Recheck immediately before a provider write, including after token refresh. */
export async function calendarSyncWriteAllowed(db: any, userId: string, linkId: string, revision: unknown, token: unknown) {
  if (!Number.isSafeInteger(revision) || typeof token !== "string" || !/^[0-9a-f-]{36}$/i.test(token)) return false;
  const { data: link, error } = await db.from("calendar_quest_imports")
    .select("connection_id,revision,sync_enabled,sync_token,sync_lease_until")
    .eq("id", linkId).eq("user_id", userId).maybeSingle();
  if (error || !link || !link.sync_enabled || link.revision !== revision || link.sync_token !== token
      || !(Date.parse(link.sync_lease_until) > Date.now())) return false;
  const { data: conn, error: connectionError } = await db.from("user_calendar_connections")
    .select("id").eq("id", link.connection_id).eq("user_id", userId).eq("sync_enabled", true).maybeSingle();
  return !connectionError && Boolean(conn);
}

export function validCalendarEtag(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 2048
    && value.trim() !== "*" && !/[\r\n]/.test(value);
}

export function validCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0,10) === value;
}
