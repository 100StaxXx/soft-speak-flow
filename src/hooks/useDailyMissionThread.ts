import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  parseDailyAdventureState,
  type DailyAdventureState,
  type DailyAdventureOutcome,
} from "@/shared/dailyAdventure";
import type { DailyMissionRecommendation } from "@/shared/dailyMissionThread";

export type DailyMissionThread = Database["public"]["Tables"]["daily_mission_threads"]["Row"];

interface SaveMissionThreadInput {
  recommendation: DailyMissionRecommendation;
  adventureState?: DailyAdventureState;
  calendarEvidence: {
    connectedCalendarCount: number;
    externalEventCount: number;
    availableMinutes: number;
  };
}

interface UpdateDailyAdventureInput {
  adventureState: DailyAdventureState;
  missionUpdate?: {
    primaryTaskId?: string | null;
    primaryTaskTitle?: string;
    primaryTaskDurationMinutes?: number;
    optionalTaskIds?: string[];
    optionalTaskTitles?: string[];
  };
}

interface ResolveDailyAdventureInput {
  adventureState: DailyAdventureState;
  reflection: {
    key: "moved_forward" | "cleared_space" | "enough_today";
    label: string;
  };
}

export function useDailyMissionThread(missionDate: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["daily-mission-thread", user?.id, missionDate] as const;
  const previousQueryKey = ["daily-mission-thread", user?.id, missionDate, "previous"] as const;

  const query = useQuery({
    queryKey,
    enabled: Boolean(user?.id && missionDate),
    queryFn: async (): Promise<DailyMissionThread | null> => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("daily_mission_threads")
        .select("*")
        .eq("user_id", user.id)
        .eq("mission_date", missionDate)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const previousQuery = useQuery({
    queryKey: previousQueryKey,
    enabled: Boolean(user?.id && missionDate),
    queryFn: async (): Promise<DailyMissionThread | null> => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("daily_mission_threads")
        .select("*")
        .eq("user_id", user.id)
        .lt("mission_date", missionDate)
        .in("status", ["completed", "reflected"])
        .order("mission_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ recommendation, adventureState, calendarEvidence }: SaveMissionThreadInput) => {
      if (!user?.id) throw new Error("Sign in to choose a daily mission.");

      const { data, error } = await supabase
        .from("daily_mission_threads")
        .upsert({
          user_id: user.id,
          mission_date: missionDate,
          intention_key: recommendation.intention,
          intention_label: recommendation.intentionLabel,
          primary_task_id: recommendation.primaryTaskId,
          primary_task_title: recommendation.primaryTaskTitle,
          primary_task_duration_minutes: recommendation.primaryTaskDurationMinutes,
          optional_task_ids: recommendation.optionalTaskIds,
          optional_task_titles: recommendation.optionalTaskTitles,
          companion_ack: recommendation.companionAck,
          calendar_summary: recommendation.calendarSummary,
          suggested_window_label: recommendation.suggestedWindowLabel,
          calendar_evidence: calendarEvidence as unknown as Json,
          adventure_state: (adventureState ?? {}) as unknown as Json,
          status: "active",
          completed_at: null,
          reflection_key: null,
          reflection_label: null,
          reflected_at: null,
        }, { onConflict: "user_id,mission_date" })
        .select("*")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (thread) => {
      queryClient.setQueryData(queryKey, thread);
      void queryClient.invalidateQueries({ queryKey: ["daily-mission-threads", user?.id] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !query.data?.id) return null;
      const completedAt = new Date().toISOString();
      const adventureState = parseDailyAdventureState(query.data.adventure_state);
      const completedAdventureState = adventureState
        ? { ...adventureState, outcome: "quest_completed" as DailyAdventureOutcome }
        : null;
      const { data, error } = await supabase
        .from("daily_mission_threads")
        .update({
          status: "completed",
          completed_at: completedAt,
          ...(completedAdventureState
            ? { adventure_state: completedAdventureState as unknown as Json }
            : {}),
        })
        .eq("id", query.data.id)
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (thread) => {
      if (thread) queryClient.setQueryData(queryKey, thread);
      void queryClient.invalidateQueries({ queryKey: ["daily-mission-threads", user?.id] });
    },
  });

  const linkTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!user?.id || !query.data?.id) return null;
      const { data, error } = await supabase
        .from("daily_mission_threads")
        .update({ primary_task_id: taskId })
        .eq("id", query.data.id)
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (thread) => {
      if (thread) queryClient.setQueryData(queryKey, thread);
    },
  });

  const updateAdventureMutation = useMutation({
    mutationFn: async ({ adventureState, missionUpdate }: UpdateDailyAdventureInput) => {
      if (!user?.id || !query.data?.id) return null;
      const { data, error } = await supabase
        .from("daily_mission_threads")
        .update({
          adventure_state: adventureState as unknown as Json,
          ...(missionUpdate?.primaryTaskId !== undefined
            ? { primary_task_id: missionUpdate.primaryTaskId }
            : {}),
          ...(missionUpdate?.primaryTaskTitle !== undefined
            ? { primary_task_title: missionUpdate.primaryTaskTitle }
            : {}),
          ...(missionUpdate?.primaryTaskDurationMinutes !== undefined
            ? { primary_task_duration_minutes: missionUpdate.primaryTaskDurationMinutes }
            : {}),
          ...(missionUpdate?.optionalTaskIds !== undefined
            ? { optional_task_ids: missionUpdate.optionalTaskIds }
            : {}),
          ...(missionUpdate?.optionalTaskTitles !== undefined
            ? { optional_task_titles: missionUpdate.optionalTaskTitles }
            : {}),
        })
        .eq("id", query.data.id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .select("*")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (thread) => {
      if (thread) queryClient.setQueryData(queryKey, thread);
      void queryClient.invalidateQueries({ queryKey: ["daily-mission-threads", user?.id] });
    },
  });

  const reflectMutation = useMutation({
    mutationFn: async (reflection: { key: string; label: string; adventureState?: DailyAdventureState }) => {
      if (!user?.id || !query.data?.id) return null;
      const { data, error } = await supabase
        .from("daily_mission_threads")
        .update({
          status: "reflected",
          reflection_key: reflection.key,
          reflection_label: reflection.label,
          reflected_at: new Date().toISOString(),
          ...(reflection.adventureState
            ? { adventure_state: reflection.adventureState as unknown as Json }
            : {}),
        })
        .eq("id", query.data.id)
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (thread) => {
      if (thread) queryClient.setQueryData(queryKey, thread);
      void queryClient.invalidateQueries({ queryKey: ["daily-mission-threads", user?.id] });
    },
  });

  const resolveAdventureMutation = useMutation({
    mutationFn: async ({ adventureState, reflection }: ResolveDailyAdventureInput) => {
      if (!user?.id || !query.data?.id) return null;
      const { data, error } = await supabase
        .from("daily_mission_threads")
        .update({
          status: "reflected",
          reflection_key: reflection.key,
          reflection_label: reflection.label,
          reflected_at: new Date().toISOString(),
          adventure_state: adventureState as unknown as Json,
        })
        .eq("id", query.data.id)
        .eq("user_id", user.id)
        .in("status", ["active", "completed"])
        .select("*")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (thread) => {
      if (thread) queryClient.setQueryData(queryKey, thread);
      void queryClient.invalidateQueries({ queryKey: ["daily-mission-threads", user?.id] });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !query.data?.id) return;
      const { error } = await supabase
        .from("daily_mission_threads")
        .delete()
        .eq("id", query.data.id)
        .eq("user_id", user.id)
        .eq("status", "active");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.setQueryData(queryKey, null);
      void queryClient.invalidateQueries({ queryKey: ["daily-mission-threads", user?.id] });
    },
  });

  return {
    thread: query.data ?? null,
    previousThread: previousQuery.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    retry: query.refetch,
    saveThread: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    markCompleted: completeMutation.mutateAsync,
    isCompleting: completeMutation.isPending,
    linkPrimaryTask: linkTaskMutation.mutateAsync,
    isLinking: linkTaskMutation.isPending,
    updateAdventure: updateAdventureMutation.mutateAsync,
    isUpdatingAdventure: updateAdventureMutation.isPending,
    reflectOnMission: reflectMutation.mutateAsync,
    isReflecting: reflectMutation.isPending,
    resolveAdventure: resolveAdventureMutation.mutateAsync,
    isResolvingAdventure: resolveAdventureMutation.isPending,
    clearThread: clearMutation.mutateAsync,
    isClearing: clearMutation.isPending,
  };
}

export function useDailyAdventureHistory(limit = 7) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["daily-mission-threads", user?.id, "adventure-history", limit],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<DailyMissionThread[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("daily_mission_threads")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["completed", "reflected"])
        .order("mission_date", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}
