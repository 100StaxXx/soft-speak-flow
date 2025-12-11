import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDocuments, timestampToISO } from "@/lib/firebase/firestore";
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
}

export const useCompanionPostcards = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: postcards, isLoading, error } = useQuery({
    queryKey: ["companion-postcards", user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      
      const data = await getDocuments<CompanionPostcard>(
        "companion_postcards",
        [["user_id", "==", user.uid]],
        "generated_at",
        "desc"
      );

      return data.map(postcard => ({
        ...postcard,
        generated_at: timestampToISO(postcard.generated_at as any) || postcard.generated_at || new Date().toISOString(),
        created_at: timestampToISO(postcard.created_at as any) || postcard.created_at || new Date().toISOString(),
      }));
    },
    enabled: !!user?.uid,
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
      if (!user?.uid) throw new Error("Not authenticated");

      // TODO: Migrate to Firebase Cloud Function
      // const response = await fetch('https://YOUR-FIREBASE-FUNCTION/generate-cosmic-postcard', {
      //   method: 'POST',
      //   body: JSON.stringify({
      //     userId: user.uid,
      //     companionId,
      //     epicId,
      //     milestonePercent,
      //     companionData,
      //   }),
      // });
      // const data = await response.json();
      // if (data?.error) throw new Error(data.error);
      // return data;
      
      throw new Error("Postcard generation needs Firebase Cloud Function migration");
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

  return {
    postcards: postcards || [],
    isLoading,
    error,
    generatePostcard,
    checkAndGeneratePostcard,
    isGenerating: generatePostcard.isPending,
  };
};
