import { getDocuments, setDocument, timestampToISO } from "./firestore";

export interface GuildStory {
  id: string;
  epic_id: string;
  chapter_number: number;
  chapter_title: string;
  intro_line: string;
  main_story: string;
  companion_spotlights?: {
    user_id: string;
    companion_name: string;
    role_played: string;
  }[];
  climax_moment: string;
  bond_lesson: string;
  next_hook?: string | null;
  trigger_type: string;
  generated_at?: string;
  created_at?: string;
}

export const getGuildStories = async (epicId: string): Promise<GuildStory[]> => {
  const stories = await getDocuments<GuildStory>(
    "guild_stories",
    [["epic_id", "==", epicId]],
    "chapter_number",
    "asc"
  );

  return stories.map((story) => ({
    ...story,
    generated_at: timestampToISO(story.generated_at as any) || story.generated_at || undefined,
    created_at: timestampToISO(story.created_at as any) || story.created_at || undefined,
  }));
};

export const markGuildStoryAsRead = async (
  userId: string,
  storyId: string
): Promise<void> => {
  const readId = `${userId}_${storyId}`;
  await setDocument(
    "guild_story_reads",
    readId,
    {
      user_id: userId,
      story_id: storyId,
      read_at: new Date().toISOString(),
    },
    false
  );
};

