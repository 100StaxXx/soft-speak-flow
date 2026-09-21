import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "@/components/ui/sonner";
import {
  parseFunctionInvokeError,
  toUserFacingFunctionError,
} from "@/utils/supabaseFunctionErrors";

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

  const { data: story, isLoading, error, refetch } = useQuery<CompanionStory | null>({
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
    onMutate: (params: { companionId: string; stage: number }) => {
      const loadingToastId = `story-gen:${params.companionId}:${params.stage}`;
      toast.loading("Your story is being written...", { id: loadingToastId });
      return { loadingToastId };
    },
    mutationFn: async (params: {
      companionId: string;
      stage: number;
    }) => {
      if (!user) throw new Error("Not authenticated");

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
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      return data as CompanionStory & { cached?: boolean };
    },
    onSuccess: (data) => {
      if (!(data as CompanionStory & { cached?: boolean })?.cached) {
        toast.success("📖 New chapter unlocked!");
      }
      queryClient.invalidateQueries({ queryKey: ["companion-story"] });
      queryClient.invalidateQueries({ queryKey: ["companion-stories-all"] });
    },
    onError: async (error) => {
      console.error("Story generation failed:", error);
      const parsed = await parseFunctionInvokeError(error);
      toast.error("Chapter could not be written", {
        description: toUserFacingFunctionError(parsed, {
          action: "write this chapter",
        }),
      });
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context?.loadingToastId) {
        toast.dismiss(context.loadingToastId);
      }
    },
  });

  return {
    story,
    allStories,
    isLoading,
    error,
    refetch,
    generateStory,
  };
};
