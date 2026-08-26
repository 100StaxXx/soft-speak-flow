import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CompanionCinemaStatus =
  | "waiting_context"
  | "queued"
  | "rendering_portrait"
  | "rendering_video"
  | "ready"
  | "revealed"
  | "failed"
  | "cancelled"
  | "superseded";

export interface CompanionCinemaStatusRow {
  event_id: string;
  event_type: string;
  event_key: string;
  category: string;
  rarity: string;
  status: CompanionCinemaStatus;
  boundary_level: number | null;
  title: string;
  reveal_copy: string | null;
  ready_at: string | null;
  revealed_at: string | null;
}

const fetchCompanionCinemaStatuses = async (
  companionId: string,
): Promise<CompanionCinemaStatusRow[]> => {
  const rpc = supabase.rpc as unknown as (
    name: "get_companion_cinema_statuses",
    args: { p_companion_id: string },
  ) => Promise<{ data: CompanionCinemaStatusRow[] | null; error: Error | null }>;
  const { data, error } = await rpc("get_companion_cinema_statuses", {
    p_companion_id: companionId,
  });
  if (error) throw error;
  return data ?? [];
};

export const getCompanionCinemaStatusesQueryKey = (
  companionId: string | null | undefined,
) => ["companion-cinema-statuses", companionId ?? "none"] as const;

export const useCompanionCinema = (
  companionId: string | null | undefined,
  enabled = true,
) => {
  const query = useQuery({
    queryKey: getCompanionCinemaStatusesQueryKey(companionId),
    queryFn: () => fetchCompanionCinemaStatuses(companionId!),
    enabled: enabled && Boolean(companionId),
    refetchInterval: 15_000,
    staleTime: 5_000,
  });

  const nextEvolution = (query.data ?? []).find((event) =>
    event.event_type === "evolution" &&
    !["revealed", "cancelled", "superseded"].includes(event.status)
  ) ?? null;

  return { ...query, nextEvolution };
};
