import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { queryKeys } from "@/lib/queryKeys";

export interface DailyMissionPulse {
  mission_date: string;
  caller_faction: string | null;
  faction_completion_percentage: number;
  network_average_completion_percentage: number;
  faction_vs_network_average_pp: number;
}

interface UseDailyMissionPulseOptions {
  missionDate: string;
  enabled?: boolean;
}

export const useDailyMissionPulse = ({ missionDate, enabled = true }: UseDailyMissionPulseOptions) => {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.dailyMissionPulse.byDate(missionDate, user?.id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_daily_mission_pulse", {
        p_mission_date: missionDate,
      });

      if (error) throw error;

      return ((data as DailyMissionPulse[] | null) ?? [])[0] ?? null;
    },
    enabled: enabled && !!user && missionDate.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    pulse: data ?? null,
    isLoading,
    error,
  };
};
