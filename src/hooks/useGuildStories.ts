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

interface UseGuildStoriesOptions {
  epicId?: string;
  communityId?: string;
}

export const useGuildStories = (options: UseGuildStoriesOptions | string = {}) => {
  // Support both old signature (epicId string) and new options object
  const { epicId, communityId } = typeof options === 'string' 
    ? { epicId: options, communityId: undefined } 
    : options;

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const queryKeyId = communityId || epicId;
  const queryKeyType = communityId ? 'community' : 'epic';

  // Fetch all stories for an epic or community
  const { data: stories, isLoading } = useQuery<GuildStory[]>({
    queryKey: ["guild-stories", queryKeyType, queryKeyId],
    queryFn: async () => {
      if (!epicId && !communityId) return [];

      let query = supabase
        .from("guild_stories")
        .select("*")
        .order("chapter_number", { ascending: true });

      if (communityId) {
        query = query.eq("community_id", communityId);
      } else if (epicId) {
        query = query.eq("epic_id", epicId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []).map(story => ({
        ...story,
        companion_spotlights: story.companion_spotlights as GuildStory['companion_spotlights']
      })) as GuildStory[];
    },
    enabled: !!(epicId || communityId),
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