import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDocument, getDocuments, timestampToISO } from "@/lib/firebase/firestore";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { generateCompanionStory } from "@/lib/firebase/functions";

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

export const useCompanionStory = (companionId?: string, stage?: number) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: story, isLoading } = useQuery<CompanionStory | null>({
    queryKey: ["companion-story", companionId, stage],
    queryFn: async () => {
      if (!companionId || stage === undefined) return null;

      const stories = await getDocuments<CompanionStory>(
        "companion_stories",
        [
          ["companion_id", "==", companionId],
          ["stage", "==", stage],
        ]
      );

      if (stories.length === 0) return null;

      const storyData = stories[0];
      return {
        ...storyData,
        generated_at: timestampToISO(storyData.generated_at as any) || storyData.generated_at || new Date().toISOString(),
      } as CompanionStory;
    },
    enabled: !!companionId && stage !== undefined,
    placeholderData: (previousData) => previousData, // Prevent flashing during stage navigation
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const { data: allStories } = useQuery({
    queryKey: ["companion-stories-all", companionId],
    queryFn: async () => {
      if (!companionId) return [];

      const data = await getDocuments<CompanionStory>(
        "companion_stories",
        [["companion_id", "==", companionId]],
        "stage",
        "asc"
      );

      return data.map(story => ({
        ...story,
        generated_at: timestampToISO(story.generated_at as any) || story.generated_at || new Date().toISOString(),
      })) as CompanionStory[];
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

      const data = await generateCompanionStory({
        companionId: params.companionId,
        stage: params.stage,
      });

      if (!data?.story) {
        throw new Error("Failed to generate story");
      }

      return data.story as CompanionStory;
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
