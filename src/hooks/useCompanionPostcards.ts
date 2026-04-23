import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { requestJourneyPathGeneration } from "@/utils/journeyPathCache";
import { toast } from "@/components/ui/sonner";
import { useCallback, useState } from "react";
import { invalidateCompanionPostcardsQuery } from "@/lib/companionConversationQueryCache";
import { queryKeys } from "@/lib/queryKeys";

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

export interface PostcardUnlockInfo {
  milestoneTitle?: string;
  chapterNumber?: number;
  locationName?: string;
}

type CompanionPostcardData = {
  spirit_animal?: string;
  favorite_color?: string;
  core_element?: string;
  eye_color?: string;
  fur_color?: string;
};

type CompanionSnapshot = CompanionPostcardData & {
  id: string;
};

export const getCompanionPostcardsQueryKey = (userId?: string) =>
  queryKeys.companion.postcards(userId);

export const fetchCompanionPostcards = async (userId: string): Promise<CompanionPostcard[]> => {
  const { data, error } = await supabase
    .from("companion_postcards")
    .select("*")
    .eq("user_id", userId)
    .order("generated_at", { ascending: false });

  if (error) throw error;
  return data as CompanionPostcard[];
};

export const useCompanionPostcards = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Track when a postcard was just unlocked for celebration
  const [postcardJustUnlocked, setPostcardJustUnlocked] = useState<PostcardUnlockInfo | null>(null);

  const clearPostcardUnlocked = useCallback(() => {
    setPostcardJustUnlocked(null);
  }, []);

  const { data: postcards, isLoading, error } = useQuery({
    queryKey: getCompanionPostcardsQueryKey(user?.id),
    queryFn: async () => {
      if (!user?.id) return [];
      return fetchCompanionPostcards(user.id);
    },
    enabled: !!user?.id,
  });

  const resolveCompanionForPostcard = useCallback(
    async (
      companionId: string,
      companionData: CompanionPostcardData,
    ): Promise<CompanionSnapshot> => {
      if (companionId) {
        return {
          id: companionId,
          ...companionData,
        };
      }

      if (!user?.id) {
        throw new Error("Not authenticated");
      }

      const { data, error: companionError } = await supabase
        .from("user_companion")
        .select("id, spirit_animal, favorite_color, core_element, eye_color, fur_color")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (companionError) throw companionError;
      if (!data?.id) throw new Error("Companion not found");

      return {
        id: data.id,
        spirit_animal: companionData.spirit_animal ?? data.spirit_animal ?? undefined,
        favorite_color: companionData.favorite_color ?? data.favorite_color ?? undefined,
        core_element: companionData.core_element ?? data.core_element ?? undefined,
        eye_color: companionData.eye_color ?? data.eye_color ?? undefined,
        fur_color: companionData.fur_color ?? data.fur_color ?? undefined,
      };
    },
    [user?.id]
  );

  const generatePostcard = useMutation({
    mutationFn: async ({
      companionId,
      epicId,
      milestonePercent,
      companionData,
      chapterNumber,
      milestoneTitle,
    }: {
      companionId: string;
      epicId: string;
      milestonePercent: number;
      companionData: CompanionPostcardData;
      chapterNumber?: number;
      milestoneTitle?: string;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const resolvedCompanion = await resolveCompanionForPostcard(companionId, companionData);

      const { data, error } = await supabase.functions.invoke("generate-cosmic-postcard", {
        body: {
          companionId: resolvedCompanion.id,
          epicId,
          milestonePercent,
          companionData: {
            spirit_animal: resolvedCompanion.spirit_animal,
            favorite_color: resolvedCompanion.favorite_color,
            core_element: resolvedCompanion.core_element,
            eye_color: resolvedCompanion.eye_color,
            fur_color: resolvedCompanion.fur_color,
          },
          chapterNumber,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return { ...data, milestoneTitle };
    },
    onSuccess: async (data) => {
      const postcardAlreadyExisted = Boolean(data?.existing || data?.cached);

      await invalidateCompanionPostcardsQuery(queryClient, user?.id);

      if (postcardAlreadyExisted) {
        return;
      }

      // Set unlock info for celebration animation
      setPostcardJustUnlocked({
        milestoneTitle: data?.milestoneTitle,
        chapterNumber: data?.postcard?.chapter_number,
        locationName: data?.postcard?.location_name,
      });
      
      toast.success("📸 New cosmic postcard unlocked!", {
        description: `Your companion visited ${data?.postcard?.location_name}!`,
      });

      // Trigger journey path regeneration for the new milestone
      // The chapter_number becomes the milestoneIndex for the path
      if (typeof data?.postcard?.chapter_number === "number" && data?.postcard?.epic_id && user?.id) {
        void requestJourneyPathGeneration({
          epicId: data.postcard.epic_id,
          milestoneIndex: data.postcard.chapter_number,
          queryClient,
          userId: user.id,
        }).catch((err) => {
          console.error("Failed to regenerate journey path:", err);
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
      companionData: CompanionPostcardData
    ) => {
      if (!user?.id) return;

      // Fetch the milestone to check if it's a postcard milestone
      const { data: milestone, error } = await supabase
        .from("epic_milestones")
        .select("id, title, milestone_percent, is_postcard_milestone, chapter_number")
        .eq("id", milestoneId)
        .maybeSingle();

      if (error) {
        console.error("Failed to fetch milestone:", error);
        return;
      }

      if (!milestone) {
        console.log("Milestone not found");
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

      // Generate the postcard with milestone title for celebration
      generatePostcard.mutate({
        companionId,
        epicId,
        milestonePercent: milestone.milestone_percent,
        companionData,
        chapterNumber: milestone.chapter_number ?? undefined,
        milestoneTitle: milestone.title,
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
    postcardJustUnlocked,
    clearPostcardUnlocked,
  };
};
