import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { useXPRewards } from "./useXPRewards";
import { useAchievements } from "./useAchievements";
import { playMissionComplete } from "@/utils/soundEffects";
import { useState, useEffect, useRef } from "react";
import { getEffectiveMissionDate } from "@/utils/timezone";
import { logger } from "@/utils/logger";
import {
  isRetriableFunctionInvokeError,
  parseFunctionInvokeError,
  toUserFacingFunctionError,
} from "@/utils/supabaseFunctionErrors";

const MAX_MISSION_QUERY_RETRIES = 2;

type MissionTheme = { name: string; emoji: string };

type MissionGenerationMeta = {
  source?: "ai" | "fallback";
  degraded?: boolean;
  reason?: string;
};

type MissionGenerationResponse = {
  missions?: unknown[];
  generated?: boolean;
  theme?: MissionTheme;
  meta?: MissionGenerationMeta;
};

type MissionQueryError = Error & {
  retriable?: boolean;
};

const makeMissionQueryError = (message: string, retriable: boolean): MissionQueryError => {
  const error = new Error(message) as MissionQueryError;
  error.retriable = retriable;
  return error;
};

const isRetriableMissionDataError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: unknown }).status;
  if (status === 408) return true;
  if (typeof status === "number" && status >= 500) return true;
  const message = String((error as { message?: unknown }).message ?? "");
  return /timeout|timed out|network|connection|fetch/i.test(message);
};

const shouldRetryMissionQuery = (failureCount: number, error: unknown) => {
  const retriable = Boolean((error as MissionQueryError)?.retriable);
  return retriable && failureCount < MAX_MISSION_QUERY_RETRIES;
};

const getMissionRetryDelayMs = (attemptIndex: number) => {
  if (import.meta.env.MODE === "test") return 0;
  return Math.min(500 * 2 ** attemptIndex, 3000);
};

const log = logger.scope("useDailyMissions");

export const useDailyMissions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { awardCustomXP } = useXPRewards();
  const { checkFirstTimeAchievements } = useAchievements();
  const today = getEffectiveMissionDate(); // Uses 2 AM reset in user's timezone
  const [generationErrorMessage, setGenerationErrorMessage] = useState<string | null>(null);

  const [missionTheme, setMissionTheme] = useState<MissionTheme | null>(null);
  const lastErrorToastKeyRef = useRef<string | null>(null);
  const lastFallbackToastKeyRef = useRef<string | null>(null);

  const maybeToastFallbackInfo = (meta?: MissionGenerationMeta) => {
    if (!meta?.degraded || meta.source !== "fallback" || !user?.id) return;
    const reason = meta.reason ?? "fallback";
    const fallbackKey = `${user.id}:${today}:${reason}`;
    if (lastFallbackToastKeyRef.current === fallbackKey) return;
    lastFallbackToastKeyRef.current = fallbackKey;
    toast({
      title: "Backup missions loaded",
      description: "Daily missions are available using backup generation while live generation recovers.",
    });
  };

  const generateMissionsForQuery = async (userId: string) => {
    const { data: generated, error: generationError } = await supabase.functions.invoke('generate-daily-missions', {
      body: { userId }
    });

    if (generationError) {
      const parsedError = await parseFunctionInvokeError(generationError);
      log.error("Mission generation fallback failed", {
        userId,
        missionDate: today,
        status: parsedError.status,
        code: parsedError.code ?? parsedError.responsePayload?.code,
        category: parsedError.category,
        backendMessage: parsedError.backendMessage,
      });
      const message = toUserFacingFunctionError(parsedError, { action: "refresh your missions" });
      setGenerationErrorMessage(message);
      throw makeMissionQueryError(message, isRetriableFunctionInvokeError(generationError));
    }

    const generationPayload = (generated ?? {}) as MissionGenerationResponse;
    maybeToastFallbackInfo(generationPayload.meta);

    const newMissions = generationPayload.missions || [];
    if (newMissions.length === 0) {
      const message = 'No missions available right now. Please try again soon.';
      setGenerationErrorMessage(message);
      throw makeMissionQueryError(message, false);
    }
    
    // Capture theme from edge function response
    if (generationPayload.theme) {
      setMissionTheme(generationPayload.theme);
    }

    return newMissions;
  };

  const { data: missions, isLoading, error } = useQuery({
    queryKey: ['daily-missions', today, user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      setGenerationErrorMessage(null);
      
      // Try to get existing missions
      const { data: existing, error: existingError } = await supabase
        .from('daily_missions')
        .select('*')
        .eq('user_id', user.id)
        .eq('mission_date', today);

      if (existingError) {
        const retriable = isRetriableMissionDataError(existingError);
        if (retriable) {
          throw makeMissionQueryError(
            "Unable to load daily missions right now. Please try again in a moment.",
            true,
          );
        }

        const missionReadError = existingError as {
          code?: string;
          message?: string;
          details?: string;
          hint?: string;
          status?: number;
        };
        log.error("daily_missions read failed; attempting generation fallback", {
          userId: user.id,
          missionDate: today,
          code: missionReadError.code,
          message: missionReadError.message,
          details: missionReadError.details,
          hint: missionReadError.hint,
          status: missionReadError.status,
        });

        return generateMissionsForQuery(user.id);
      }

      // If no missions exist, generate them server-side
      if (!existing || existing.length === 0) {
        return generateMissionsForQuery(user.id);
      }

      setGenerationErrorMessage(null);
      return existing;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes - missions are daily, don't change often
    refetchOnWindowFocus: false,
    retry: shouldRetryMissionQuery,
    retryDelay: getMissionRetryDelayMs,
  });

  // Handle errors with useEffect instead of deprecated onError
  useEffect(() => {
    if (error) {
      const title = generationErrorMessage ? "Mission refresh failed" : "Unable to load daily missions";
      const description = generationErrorMessage || error.message;
      const toastKey = `${user?.id ?? "anon"}:${today}:${title}:${description}`;
      if (lastErrorToastKeyRef.current === toastKey) return;
      lastErrorToastKeyRef.current = toastKey;
      toast({
        title,
        description,
        variant: "destructive",
      });
    }
  }, [error, generationErrorMessage, toast, user?.id, today]);

  useEffect(() => {
    if (!error) {
      lastErrorToastKeyRef.current = null;
    }
  }, [error, user?.id, today]);

  const regenerateMissions = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      setGenerationErrorMessage(null);

      const { data: generated, error } = await supabase.functions.invoke('generate-daily-missions', {
        body: { userId: user.id, forceRegenerate: true }
      });

      if (error) {
        const parsedError = await parseFunctionInvokeError(error);
        const message = toUserFacingFunctionError(parsedError, { action: "refresh your missions" });
        setGenerationErrorMessage(message);
        throw new Error(message);
      }

      const generationPayload = (generated ?? {}) as MissionGenerationResponse;
      maybeToastFallbackInfo(generationPayload.meta);

      const newMissions = generationPayload.missions || [];
      if (newMissions.length === 0) {
        const message = 'No missions were ready. Please try again soon.';
        setGenerationErrorMessage(message);
        throw new Error(message);
      }

      return newMissions;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-missions'] });
      toast({
        title: "Daily missions refreshed",
        description: "Fresh challenges are ready for you!",
      });
      setGenerationErrorMessage(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Mission refresh failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const completeMission = useMutation({
    mutationFn: async (missionId: string) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      const mission = missions?.find(m => m.id === missionId);
      if (!mission) throw new Error("Mission not found");

      // Check if already completed to prevent XP spam
      if (mission.completed) {
        throw new Error("Mission already completed");
      }

      const { data, error } = await supabase
        .from('daily_missions')
        .update({ 
          completed: true, 
          completed_at: new Date().toISOString() 
        })
        .eq('id', missionId)
        .eq('user_id', user.id)
        .eq('completed', false) // Only update if not already completed
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Mission already completed");
      
      // Award XP with display reason
      await awardCustomXP(
        mission.xp_reward, 
        `mission_${mission.mission_type}`, 
        "Mission Complete!",
        { mission_id: mission.id }
      );
      
      // Check for first mission achievement
      const { count } = await supabase
        .from('daily_missions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('completed', true);
      
      if (count === 1) {
        await checkFirstTimeAchievements('mission');
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-missions'] });
      toast({ title: "Mission Complete!", description: "XP awarded!" });
      playMissionComplete();
      
      // Trigger astral encounter check
      window.dispatchEvent(new CustomEvent('quest-completed'));
    },
    onError: (error: Error) => {
      toast({
        title: "Mission not completed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const completedCount = missions?.filter(m => m.completed).length || 0;
  const totalCount = missions?.length || 0;

  return {
    missions: missions || [],
    isLoading,
    completeMission: completeMission.mutateAsync,
    isCompleting: completeMission.isPending,
    completedCount,
    totalCount,
    allComplete: completedCount === totalCount && totalCount > 0,
    regenerateMissions: regenerateMissions.mutateAsync,
    isRegenerating: regenerateMissions.isPending,
    generationErrorMessage,
    missionTheme,
  };
};
