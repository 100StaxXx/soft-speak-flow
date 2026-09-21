import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { CompanionNarrativeMemory } from "@/types/livingNarrative";

export function useCompanionNarrativeMemories(companionId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["companion-narrative-memories", user?.id, companionId],
    queryFn: async () => {
      if (!user?.id || !companionId) return [];

      const { data, error } = await supabase
        .from("companion_narrative_memories")
        .select("*")
        .eq("user_id", user.id)
        .eq("companion_id", companionId)
        .eq("status", "active")
        .order("salience", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(24);

      if (error) throw error;
      return data as CompanionNarrativeMemory[];
    },
    enabled: Boolean(user?.id && companionId),
    staleTime: 5 * 60 * 1000,
  });
}
