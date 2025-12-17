// Story Universe and Character Hooks

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { StoryUniverse, StoryCharacter, MentorStoryRelationship } from "@/types/narrativeTypes";

// Fetch user's story universe
export const useStoryUniverse = () => {
  const { user } = useAuth();

  const { data: universe, isLoading } = useQuery({
    queryKey: ['story-universe', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('story_universe')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching story universe:', error);
        throw error;
      }

      return data as StoryUniverse | null;
    },
    enabled: !!user?.id,
  });

  return { universe, isLoading };
};

// Fetch user's story characters
export const useStoryCharacters = (epicId?: string) => {
  const { user } = useAuth();

  const { data: characters, isLoading } = useQuery({
    queryKey: ['story-characters', user?.id, epicId],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('story_characters')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('times_encountered', { ascending: false });

      if (epicId) {
        query = query.or(`first_appeared_epic_id.eq.${epicId},last_seen_epic_id.eq.${epicId}`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching story characters:', error);
        throw error;
      }

      return (data || []) as StoryCharacter[];
    },
    enabled: !!user?.id,
  });

  return { characters: characters || [], isLoading };
};

// Fetch mentor story relationship
export const useMentorStoryRelationship = () => {
  const { user } = useAuth();

  const { data: relationship, isLoading } = useQuery({
    queryKey: ['mentor-story-relationship', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('mentor_story_relationship')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching mentor relationship:', error);
        throw error;
      }

      if (!data) return null;

      return {
        ...data,
        mentor_transitions: (data.mentor_transitions as unknown as MentorStoryRelationship['mentor_transitions']) || [],
      } as MentorStoryRelationship;
    },
    enabled: !!user?.id,
  });

  return { relationship, isLoading };
};

// Update character after encounter
export const useUpdateCharacter = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      characterId,
      updates,
    }: {
      characterId: string;
      updates: Partial<StoryCharacter>;
    }) => {
      const { data, error } = await supabase
        .from('story_characters')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', characterId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story-characters'] });
    },
  });
};

// Record mentor transition
export const useRecordMentorTransition = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fromMentorId,
      fromMentorName,
      toMentorId,
      toMentorName,
    }: {
      fromMentorId: string;
      fromMentorName: string;
      toMentorId: string;
      toMentorName: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Get current relationship
      const { data: current } = await supabase
        .from('mentor_story_relationship')
        .select('mentor_transitions')
        .eq('user_id', user.id)
        .maybeSingle();

      const transitions = (current?.mentor_transitions as any[]) || [];
      transitions.push({
        from_mentor_id: fromMentorId,
        from_mentor_name: fromMentorName,
        to_mentor_id: toMentorId,
        to_mentor_name: toMentorName,
        transitioned_at: new Date().toISOString(),
      });

      const { data, error } = await supabase
        .from('mentor_story_relationship')
        .upsert({
          user_id: user.id,
          mentor_id: toMentorId,
          mentor_transitions: transitions,
          current_since: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mentor-story-relationship'] });
    },
  });
};
