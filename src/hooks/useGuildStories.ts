import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDocuments, timestampToISO } from "@/lib/firebase/firestore";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface GuildStory {
  id: string;
  epic_id: string;
  chapter_number: number;
  chapter_title: string;
  intro_line: string;
  main_story: string;
  companion_spotlights: {
    user_id: string;
    companion_name: string;
    role_played: string;
  }[];
  climax_moment: string;
  bond_lesson: string;
  next_hook: string | null;
  trigger_type: string;
  generated_at: string;
  created_at: string;
}

export const useGuildStories = (epicId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all stories for an epic
  const { data: stories, isLoading } = useQuery<GuildStory[]>({
    queryKey: ["guild-stories", epicId],
    queryFn: async () => {
      if (!epicId) return [];

      const data = await getDocuments<GuildStory>(
        "guild_stories",
        [["epic_id", "==", epicId]],
        "chapter_number",
        "asc"
      );

      return data.map(story => ({
        ...story,
        generated_at: timestampToISO(story.generated_at as any) || story.generated_at || new Date().toISOString(),
        created_at: timestampToISO(story.created_at as any) || story.created_at || new Date().toISOString(),
      }));
    },
    enabled: !!epicId,
  });

  // Get latest story
  const latestStory = stories?.[stories.length - 1];

  // Generate new guild story
  const generateStory = useMutation({
    mutationFn: async (epicId: string) => {
      if (!user) throw new Error("Not authenticated");

      toast.loading("Weaving your companions' tale...", { id: "guild-story-gen" });

      // TODO: Migrate to Firebase Cloud Function
      // const response = await fetch('https://YOUR-FIREBASE-FUNCTION/generate-guild-story', {
      //   method: 'POST',
      //   body: JSON.stringify({ epicId }),
      // });
      // const data = await response.json();
      // if (data.error) {
      //   throw new Error(data.error);
      // }
      // return data.story as GuildStory;
      
      throw new Error("Guild story generation needs Firebase Cloud Function migration");
    },
    onSuccess: () => {
      toast.dismiss("guild-story-gen");
      toast.success("📖 New guild adventure unlocked!");
      queryClient.invalidateQueries({ queryKey: ["guild-stories"] });
    },
    onError: (error) => {
      toast.dismiss("guild-story-gen");
      console.error("Story generation failed:", error);
      toast.error(
        error instanceof Error 
          ? error.message 
          : "Failed to generate story. Please try again."
      );
    },
  });

  return {
    stories,
    latestStory,
    isLoading,
    generateStory,
    isGenerating: generateStory.isPending,
  };
};