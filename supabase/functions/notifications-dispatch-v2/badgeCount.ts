interface BadgeQueueRow {
  id: string;
  user_id: string;
}

export async function resolveBadgeCountAfterSend(
  supabase: any,
  row: BadgeQueueRow,
): Promise<number | null> {
  const { count, error } = await supabase
    .from("push_notification_queue")
    .select("id", { count: "exact", head: true })
    .eq("user_id", row.user_id)
    .eq("status", "sent")
    .not("delivered_at", "is", null)
    .is("read_at", null);

  if (error) {
    console.error("[notifications-dispatch-v2] badge count lookup failed", row.id, error);
    return null;
  }

  return Math.max(1, (count ?? 0) + 1);
}
