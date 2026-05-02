function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("companion chat thread backfill migration preserves archive history invariants", async () => {
  const source = await Deno.readTextFile(
    new URL(
      "../../migrations/20260419150000_backfill_companion_chat_threads.sql",
      import.meta.url,
    ),
  );

  assert(
    source.includes("COUNT(*)::integer AS message_count"),
    "Expected the backfill to recompute per-session message counts",
  );
  assert(
    source.includes("CASE WHEN chats.role = 'user' THEN 0 ELSE 1 END"),
    "Expected thread titles to prefer the earliest user message",
  );
  assert(
    source.includes(
      "DISTINCT ON (chats.session_id, chats.user_id, chats.companion_id, chats.surface)",
    ),
    "Expected the backfill to derive one title and preview row per chat session",
  );
  assert(
    source.includes(
      "PARTITION BY stats.user_id, stats.companion_id, stats.surface",
    ),
    "Expected only one active thread per user, companion, and surface",
  );
  assert(
    source.includes(
      "CASE WHEN ranked.session_rank = 1 THEN NULL ELSE ranked.last_message_at END AS archived_at",
    ),
    "Expected older sessions to be archived while the newest session stays active",
  );
  assert(
    source.includes("ON CONFLICT (session_id) DO UPDATE"),
    "Expected the backfill migration to be safe to rerun",
  );
});
