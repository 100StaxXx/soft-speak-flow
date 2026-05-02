import { supabase } from "@/integrations/supabase/client";

export async function scrubCompanionChatsForDeletedEpic(
  userId: string,
  epicTitle: string | null | undefined,
  epicCreatedAt: string | null | undefined,
): Promise<void> {
  const trimmedTitle = epicTitle?.trim();
  if (!trimmedTitle) return;

  const escapedTitle = trimmedTitle.replace(/[\\%_]/g, (match) => `\\${match}`);

  try {
    let query = supabase
      .from("companion_chats")
      .delete()
      .eq("user_id", userId)
      .eq("role", "assistant")
      .ilike("content", `%${escapedTitle}%`);

    if (epicCreatedAt) {
      query = query.gte("created_at", epicCreatedAt);
    }

    const { error } = await query;
    if (error) {
      console.warn(
        "Failed to scrub companion_chats for deleted epic:",
        error,
      );
    }
  } catch (error) {
    console.warn(
      "Failed to scrub companion_chats for deleted epic:",
      error,
    );
  }
}
