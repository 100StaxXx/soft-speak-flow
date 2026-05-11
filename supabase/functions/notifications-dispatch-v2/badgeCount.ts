interface BadgeQueueRow {
  id: string;
  user_id: string;
}

export async function resolveRemainingDailyTaskBadgeCount(
  supabase: any,
  userId: string,
  now = new Date(),
): Promise<number | null> {
  const { data, error } = await supabase.rpc("get_remaining_today_badge_count", {
    p_user_id: userId,
    p_now: now.toISOString(),
  });

  if (error) {
    console.error("[notifications-dispatch-v2] badge remaining count lookup failed", userId, error);
    return null;
  }

  const count = Number(data ?? 0);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

export async function resolveBadgeCountAfterSend(
  supabase: any,
  row: BadgeQueueRow,
  now = new Date(),
): Promise<number | null> {
  return resolveRemainingDailyTaskBadgeCount(supabase, row.user_id, now);
}
