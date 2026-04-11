import type { Database } from "@/integrations/supabase/types";

type RemoteEpicInsert = Database["public"]["Tables"]["epics"]["Insert"];

type EpicRemotePayloadCandidate = Partial<RemoteEpicInsert> & Record<string, unknown>;

export function toRemoteEpicInsertPayload(epic: EpicRemotePayloadCandidate): RemoteEpicInsert {
  return {
    id: typeof epic.id === "string" ? epic.id : undefined,
    user_id: epic.user_id as string,
    title: epic.title as string,
    description: epic.description as string | null | undefined,
    status: epic.status as string | undefined,
    progress_percentage: epic.progress_percentage as number | null | undefined,
    target_days: epic.target_days as number | undefined,
    start_date: epic.start_date as string | undefined,
    end_date: epic.end_date as string | null | undefined,
    xp_reward: epic.xp_reward as number | undefined,
    invite_code: epic.invite_code as string | null | undefined,
    theme_color: epic.theme_color as string | null | undefined,
    story_type_slug: epic.story_type_slug as string | null | undefined,
    story_seed: epic.story_seed as RemoteEpicInsert["story_seed"],
    created_at: epic.created_at as string | null | undefined,
    completed_at: epic.completed_at as string | null | undefined,
    updated_at: epic.updated_at as string | null | undefined,
    is_public: epic.is_public as boolean | null | undefined,
    community_id: epic.community_id as string | null | undefined,
    discord_channel_id: epic.discord_channel_id as string | null | undefined,
    discord_invite_url: epic.discord_invite_url as string | null | undefined,
    discord_ready: epic.discord_ready as boolean | null | undefined,
    book_title: epic.book_title as string | null | undefined,
    total_chapters: epic.total_chapters as number | null | undefined,
  };
}
