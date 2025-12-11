import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";
import { getResolvedMentorId } from "@/utils/mentor";

export interface Mentor {
  id: string;
  name: string;
  slug: string;
  avatar_url: string | null;
  primary_color: string | null;
  description?: string | null;
  theme_config?: unknown;
}

/**
 * Lightweight mentor data hook that prioritizes cached data, then refreshes in the background.
 * This hook intentionally avoids onboarding logic and only reads existing mentor selection.
 */
export const useMentor = () => {
  const { profile, loading: profileLoading } = useProfile();
  const queryClient = useQueryClient();

  const mentorId = useMemo(() => getResolvedMentorId(profile), [profile]);

  const cachedMentor = useMemo(() => {
    if (!mentorId) return null;
    return queryClient.getQueryData<Mentor>(["mentor", mentorId]) ?? null;
  }, [mentorId, queryClient]);

  const {
    data: mentor,
    isLoading: mentorLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["mentor", mentorId],
    enabled: !!mentorId,
    initialData: cachedMentor,
    placeholderData: cachedMentor,
    staleTime: 5 * 60 * 1000, // 5 minutes to avoid thrashing when switching tabs
    gcTime: 30 * 60 * 1000, // keep mentor data warm for longer sessions
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!mentorId) return null;

      const { data, error: fetchError } = await supabase
        .from("mentors")
        .select("id, name, slug, avatar_url, primary_color, description, theme_config")
        .eq("id", mentorId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      return data as Mentor | null;
    },
  });

  return {
    mentorId,
    mentor,
    isLoading: mentorLoading || profileLoading,
    isFetching,
    error,
    refetch,
  };
};
