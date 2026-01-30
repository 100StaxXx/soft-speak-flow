import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCallback } from "react";

interface JourneyPath {
  id: string;
  epic_id: string;
  milestone_index: number;
  image_url: string;
  prompt_context: Record<string, unknown> | null;
  generated_at: string;
}

export const useJourneyPathImage = (epicId: string | undefined) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch the latest journey path for this epic
  const { data: journeyPath, isLoading, error } = useQuery({
    queryKey: ["journey-path", epicId],
    queryFn: async () => {
      if (!epicId || !user?.id) return null;

      const { data, error } = await supabase
        .from("epic_journey_paths")
        .select("*")
        .eq("epic_id", epicId)
        .order("milestone_index", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching journey path:", error);
        throw error;
      }

      return data as JourneyPath | null;
    },
    enabled: !!epicId && !!user?.id,
    staleTime: 10 * 60 * 1000, // 10 minutes - journey path images rarely change
  });

  // Generate a new journey path
  const generatePath = useMutation({
    mutationFn: async ({ milestoneIndex }: { milestoneIndex: number }) => {
      if (!epicId || !user?.id) throw new Error("Missing epic or user");

      const { data, error } = await supabase.functions.invoke("generate-journey-path", {
        body: {
          epicId,
          milestoneIndex,
          userId: user.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journey-path", epicId] });
    },
    onError: (error) => {
      console.error("Failed to generate journey path:", error);
    },
  });

  // Helper to trigger initial path generation
  const generateInitialPath = useCallback(() => {
    if (!epicId || !user?.id) return;
    
    // Only generate if no path exists yet
    if (!journeyPath && !isLoading) {
      generatePath.mutate({ milestoneIndex: 0 });
    }
  }, [epicId, user?.id, journeyPath, isLoading, generatePath]);

  // Helper to trigger path regeneration after milestone
  const regeneratePathForMilestone = useCallback((milestoneIndex: number) => {
    if (!epicId || !user?.id) return;
    generatePath.mutate({ milestoneIndex });
  }, [epicId, user?.id, generatePath]);

  return {
    pathImageUrl: journeyPath?.image_url || null,
    currentMilestoneIndex: journeyPath?.milestone_index ?? -1,
    isLoading,
    isGenerating: generatePath.isPending,
    error,
    generateInitialPath,
    regeneratePathForMilestone,
  };
};
