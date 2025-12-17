// Cosmic Library Hook - Fetch completed books and narrative progress

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { CompletedBook, NarrativePostcard, NarrativeEpic, StorySeed } from "@/types/narrativeTypes";

// Fetch all completed books for Cosmic Library
export const useCosmicLibrary = () => {
  const { user } = useAuth();

  const { data: books, isLoading } = useQuery({
    queryKey: ['cosmic-library', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('completed_books')
        .select('*')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false });

      if (error) {
        console.error('Error fetching completed books:', error);
        throw error;
      }

      return (data || []) as CompletedBook[];
    },
    enabled: !!user?.id,
  });

  return { books: books || [], isLoading };
};

// Fetch chapters (postcards) for a specific book/epic
export const useBookChapters = (epicId: string | undefined) => {
  const { user } = useAuth();

  const { data: chapters, isLoading } = useQuery({
    queryKey: ['book-chapters', user?.id, epicId],
    queryFn: async () => {
      if (!user?.id || !epicId) return [];

      const { data, error } = await supabase
        .from('companion_postcards')
        .select('*')
        .eq('user_id', user.id)
        .eq('epic_id', epicId)
        .order('chapter_number', { ascending: true });

      if (error) {
        console.error('Error fetching book chapters:', error);
        throw error;
      }

      return (data || []) as NarrativePostcard[];
    },
    enabled: !!user?.id && !!epicId,
  });

  return { chapters: chapters || [], isLoading };
};

// Fetch narrative epic with story seed
export const useNarrativeEpic = (epicId: string | undefined) => {
  const { user } = useAuth();

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

// Complete a book (after boss defeat)
export const useCompleteBook = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      epicId,
      bookTitle,
      storyTypeSlug,
      totalChapters,
      bossDefeatedName,
      companionName,
      companionSpecies,
      mentorName,
      finalWisdom,
    }: {
      epicId: string;
      bookTitle: string;
      storyTypeSlug: string | null;
      totalChapters: number;
      bossDefeatedName?: string;
      companionName?: string;
      companionSpecies?: string;
      mentorName?: string;
      finalWisdom?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('completed_books')
        .insert({
          user_id: user.id,
          epic_id: epicId,
          book_title: bookTitle,
          story_type_slug: storyTypeSlug,
          total_chapters: totalChapters,
          boss_defeated_name: bossDefeatedName,
          boss_defeated_at: bossDefeatedName ? new Date().toISOString() : null,
          companion_name: companionName,
          companion_species: companionSpecies,
          mentor_name: mentorName,
          final_wisdom: finalWisdom,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CompletedBook;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cosmic-library'] });
    },
  });
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
