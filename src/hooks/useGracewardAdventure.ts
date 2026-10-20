import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GRACEWARD_ADVENTURE_ENABLED } from "@/config/gracewardAdventure";

export interface AdventureCompletion {
  node_id: number; score: number; xp_awarded: number; coins_awarded: number;
}
export interface AdventureReceipt extends AdventureCompletion { already_completed: boolean }

// The new RPC signatures are kept here until deployed database types are regenerated.
interface AdventureRpc {
  rpc(name: "get_graceward_adventure_progress", args?: Record<string, never>): PromiseLike<{ data: AdventureCompletion[] | null; error: { message: string } | null }>;
  rpc(name: "complete_graceward_bible_quest", args: { p_node_id: number; p_answers: number[] }): PromiseLike<{ data: AdventureReceipt | null; error: { message: string } | null }>;
}
const api = supabase as unknown as AdventureRpc;

export function useGracewardAdventure() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = ["graceward-adventure", user?.id];
  const progress = useQuery({
    queryKey: key,
    enabled: Boolean(user) && GRACEWARD_ADVENTURE_ENABLED,
    queryFn: async () => {
      const { data, error } = await api.rpc("get_graceward_adventure_progress");
      if (error) throw new Error("Your adventure couldn't load. Please try again.");
      return data ?? [];
    },
  });
  const complete = async (nodeId: number, answers: number[]) => {
    if (!user) throw new Error("Please sign in to save your adventure.");
    const { data, error } = await api.rpc("complete_graceward_bible_quest", { p_node_id: nodeId, p_answers: answers });
    if (error || !data) throw new Error("We couldn't save your reward. Your answers are kept here; reconnect and try again.");
    queryClient.setQueryData<AdventureCompletion[]>(key, (previous = []) =>
      [...previous.filter((entry) => entry.node_id !== nodeId), data].sort((a, b) => a.node_id - b.node_id));
    void queryClient.invalidateQueries({ queryKey: ["companion"] });
    void queryClient.invalidateQueries({ queryKey: ["xp-events"] });
    return data;
  };
  return { ...progress, completions: progress.data ?? [], complete, userId: user?.id };
}
