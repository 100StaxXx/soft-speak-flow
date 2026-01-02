// Narrative Hooks - Fetch narrative epics and story types

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NarrativeEpic, StorySeed } from "@/types/narrativeTypes";

// Fetch narrative epic with story seed
export const useNarrativeEpic = (epicId: string | undefined) => {
  const { data: epic, isLoading } = useQuery({
    queryKey: ['narrative-epic', epicId],
    queryFn: async () => {
      if (!epicId) return null;

      const { data, error } = await supabase
        .from('epics')
        .select('*')
        .eq('id', epicId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching narrative epic:', error);
        throw error;
      }

      if (!data) return null;

      // Transform to NarrativeEpic type
      return {
        ...data,
        story_seed: data.story_seed as unknown as StorySeed | null,
      } as NarrativeEpic;
    },
    enabled: !!epicId,
  });

  return { epic, isLoading };
};

// Fetch story types for epic creation
export const useStoryTypes = () => {
  const { data: storyTypes, isLoading } = useQuery({
    queryKey: ['story-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('epic_story_types')
        .select('*')
        .order('base_chapters', { ascending: true });

      if (error) {
        console.error('Error fetching story types:', error);
        throw error;
      }

      return data || [];
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  return { storyTypes: storyTypes || [], isLoading };
};

// Generate narrative seed for new epic
export const useGenerateNarrativeSeed = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      epicId,
      epicTitle,
      epicDescription,
      targetDays,
      storyTypeSlug,
      companionData,
      mentorData,
      userGoal,
    }: {
      userId: string;
      epicId: string;
      epicTitle: string;
      epicDescription?: string;
      targetDays: number;
      storyTypeSlug: string;
      companionData?: {
        spirit_animal?: string;
        core_element?: string;
        favorite_color?: string;
        fur_color?: string;
      };
      mentorData?: {
        id?: string;
        name?: string;
        slug?: string;
        narrativeVoice?: string;
        storyRole?: string;
      };
      userGoal?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('generate-epic-narrative-seed', {
        body: {
          userId,
          epicId,
          epicTitle,
          epicDescription,
          targetDays,
          storyTypeSlug,
          companionData,
          mentorData,
          userGoal,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['narrative-epic', variables.epicId] });
      queryClient.invalidateQueries({ queryKey: ['story-characters'] });
    },
  });
};
