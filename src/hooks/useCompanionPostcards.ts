import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useCallback } from "react";

export interface CompanionPostcard {
  id: string;
  user_id: string;
  companion_id: string;
  epic_id: string | null;
  milestone_percent: number;
  location_name: string;
  location_description: string;
  image_url: string;
  caption: string | null;
  generated_at: string;
  created_at: string;
  // Narrative fields
  chapter_number: number | null;
  chapter_title: string | null;
  story_content: string | null;
  clue_text: string | null;
  prophecy_line: string | null;
  characters_featured: string[] | null;
  seeds_planted: string[] | null;
  is_finale: boolean | null;
  location_revealed: boolean | null;
}

export const useCompanionPostcards = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: postcards, isLoading, error } = useQuery({
    queryKey: ["companion-postcards", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("companion_postcards")
        .select("*")
        .eq("user_id", user.id)
        .order("generated_at", { ascending: false });

      if (error) throw error;
      return data as CompanionPostcard[];
    },
    enabled: !!user?.id,
  });

  const generatePostcard = useMutation({
    mutationFn: async ({
      companionId,
      epicId,
      milestonePercent,
      companionData,
    }: {
      companionId: string;
      epicId: string;
      milestonePercent: number;
      companionData: {
        spirit_animal?: string;
        favorite_color?: string;
        core_element?: string;
        eye_color?: string;
        fur_color?: string;
      };
    }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("generate-cosmic-postcard", {
        body: {
          userId: user.id,
          companionId,
          epicId,
          milestonePercent,
          companionData,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      if (!data?.existing) {
        queryClient.invalidateQueries({ queryKey: ["companion-postcards"] });
        toast.success("📸 New cosmic postcard unlocked!", {
          description: `Your companion visited ${data?.postcard?.location_name}!`,
        });
      }
    },
    onError: (error) => {
      console.error("Failed to generate postcard:", error);
      // Silent fail - don't interrupt user flow
    },
  });

  // Legacy check for percentage-based postcards (still used for epics without milestones)
  const checkAndGeneratePostcard = useCallback(
    async (
      epicId: string,
      currentProgress: number,
      previousProgress: number,
      companionId: string,
      companionData: {
        spirit_animal?: string;
        favorite_color?: string;
        core_element?: string;
        eye_color?: string;
        fur_color?: string;
      }
    ) => {
      const milestones = [25, 50, 75, 100];
      
      for (const milestone of milestones) {
        // Check if we just crossed this milestone
        if (previousProgress < milestone && currentProgress >= milestone) {
          // Check if postcard already exists in cached data
          // Note: Server-side also checks for duplicates as a safety net
          const existingPostcard = postcards?.find(
            p => p.epic_id === epicId && p.milestone_percent === milestone
          );
          
          if (!existingPostcard) {
            generatePostcard.mutate({
              companionId,
              epicId,
              milestonePercent: milestone,
              companionData,
            });
            break; // Only generate one at a time
          }
        }
      }
    },
    [postcards, generatePostcard]
  );

  // NEW: Check for milestone-based postcard generation
  const checkMilestoneForPostcard = useCallback(
    async (
      milestoneId: string,
      epicId: string,
      companionId: string,
      companionData: {
        spirit_animal?: string;
        favorite_color?: string;
        core_element?: string;
        eye_color?: string;
        fur_color?: string;
      }
    ) => {
      if (!user?.id) return;

      // Fetch the milestone to check if it's a postcard milestone
      const { data: milestone, error } = await supabase
        .from("epic_milestones")
        .select("id, title, milestone_percent, is_postcard_milestone")
        .eq("id", milestoneId)
        .single();

      if (error || !milestone) {
        console.error("Failed to fetch milestone:", error);
        return;
      }

      // Only generate postcard for milestones marked as postcard milestones
      if (!milestone.is_postcard_milestone) {
        console.log("Milestone is not marked for postcard generation");
        return;
      }

      // Check if postcard already exists for this milestone
      const existingPostcard = postcards?.find(
        p => p.epic_id === epicId && p.milestone_percent === milestone.milestone_percent
      );

      if (existingPostcard) {
        console.log("Postcard already exists for this milestone");
        return;
      }

      // Generate the postcard
      generatePostcard.mutate({
        companionId,
        epicId,
        milestonePercent: milestone.milestone_percent,
        companionData,
      });
    },
    [user?.id, postcards, generatePostcard]
  );

  return {
    postcards: postcards || [],
    isLoading,
    error,
    generatePostcard,
    checkAndGeneratePostcard,
    checkMilestoneForPostcard,
    isGenerating: generatePostcard.isPending,
  };
};
