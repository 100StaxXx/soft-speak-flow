import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface GuildStory {
  id: string;
  epic_id: string;
  community_id: string | null;
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

      const { data, error } = await supabase
        .from("guild_stories")
        .select("*")
        .eq("epic_id", epicId)
        .order("chapter_number", { ascending: true });

      if (error) throw error;
      return (data || []).map(story => ({
        ...story,
        companion_spotlights: story.companion_spotlights as GuildStory['companion_spotlights']
      })) as GuildStory[];
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

      const { data, error } = await supabase.functions.invoke(
        "generate-guild-story",
        {
          body: { epicId }, // userId is derived from JWT on server
        }
      );

      if (error) {
        console.error("Story generation error:", error);
        throw new Error(error.message || "Unable to generate story right now");
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data.story as GuildStory;
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