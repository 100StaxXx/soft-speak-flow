import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

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

  const checkAndGeneratePostcard = async (
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
        // Check if postcard already exists
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
  };

  return {
    postcards: postcards || [],
    isLoading,
    error,
    generatePostcard,
    checkAndGeneratePostcard,
    isGenerating: generatePostcard.isPending,
  };
};
