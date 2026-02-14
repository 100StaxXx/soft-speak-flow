import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface CompanionStory {
  id: string;
  companion_id: string;
  user_id: string;
  stage: number;
  chapter_title: string;
  intro_line: string;
  main_story: string;
  bond_moment: string;
  life_lesson: string;
  lore_expansion: string[];
  next_hook: string;
  tone_preference: string;
  generated_at: string;
}

export const getCompanionStoriesAllQueryKey = (companionId?: string) =>
  ["companion-stories-all", companionId] as const;

export const fetchCompanionStoriesAll = async (companionId: string): Promise<CompanionStory[]> => {
  const { data, error } = await supabase
    .from("companion_stories")
    .select("*")
    .eq("companion_id", companionId)
    .order("stage", { ascending: true });

  if (error) throw error;
  return data as CompanionStory[];
};

export const useCompanionStory = (companionId?: string, stage?: number) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: story, isLoading } = useQuery<CompanionStory | null>({
    queryKey: ["companion-story", companionId, stage],
    queryFn: async () => {
      if (!companionId || stage === undefined) return null;

      const { data, error } = await supabase
        .from("companion_stories")
        .select("*")
        .eq("companion_id", companionId)
        .eq("stage", stage)
        .maybeSingle();

      // maybeSingle() returns null for no rows - only throw on actual errors
      if (error) {
        console.error('Failed to fetch companion story:', error);
        throw error;
      }
      return data as CompanionStory | null;
    },
    enabled: !!companionId && stage !== undefined,
    placeholderData: (previousData) => previousData, // Prevent flashing during stage navigation
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const { data: allStories } = useQuery({
    queryKey: getCompanionStoriesAllQueryKey(companionId),
    queryFn: async () => {
      if (!companionId) return [];
      return fetchCompanionStoriesAll(companionId);
    },
    enabled: !!companionId,
  });

  const generateStory = useMutation({
    mutationFn: async (params: {
      companionId: string;
      stage: number;
    }) => {
      if (!user) throw new Error("Not authenticated");

      toast.loading("Your story is being written...", { id: "story-gen" });

      const { data, error } = await supabase.functions.invoke(
        "generate-companion-story",
        {
          body: { 
            companionId: params.companionId, 
            stage: params.stage,
          },
        }
      );

      if (error) {
        console.error("Story generation error:", error);
        throw new Error("Unable to write your story right now. Please try again.");
      }
      return data as CompanionStory;
    },
    onSuccess: () => {
      toast.dismiss("story-gen");
      toast.success("📖 New chapter unlocked!");
      queryClient.invalidateQueries({ queryKey: ["companion-story"] });
      queryClient.invalidateQueries({ queryKey: ["companion-stories-all"] });
    },
    onError: (error) => {
      toast.dismiss("story-gen");
      console.error("Story generation failed:", error);
      toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    },
  });

  return {
    story,
    allStories,
    isLoading,
    generateStory,
  };
};
