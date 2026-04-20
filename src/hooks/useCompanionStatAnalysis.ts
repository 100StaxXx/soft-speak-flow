import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import {
  type CompanionStatAnalysis,
  type CompanionStatAnalysisResponse,
  type CompanionStatBand,
  type CompanionStatBreakdown,
  type CompanionStatDriver,
  validateCompanionStatAnalysisResponse,
} from "@/shared/companionStatAnalysis";
import type { CompanionStatAttribute } from "@/shared/companionStatSignals";

export type {
  CompanionStatAnalysis,
  CompanionStatAnalysisResponse,
  CompanionStatBand,
  CompanionStatBreakdown,
  CompanionStatDriver,
};
export type { CompanionStatAttribute };

export function formatDateInTimezone(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

const getAnalysisErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load stat analysis";
};

interface UseCompanionStatAnalysisOptions {
  enabled?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCachedMalformedAnalysisResponse = (value: unknown) =>
  isRecord(value) && value.cached === true;

const getMalformedAnalysisMessage = (error: string, refreshed: boolean) =>
  refreshed
    ? `Received malformed refreshed stat analysis data: ${error}`
    : `Received malformed stat analysis data: ${error}`;

export const useCompanionStatAnalysis = ({ enabled = true }: UseCompanionStatAnalysisOptions = {}) => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const analysisDateKey = useMemo(() => {
    const timezone = profile?.timezone || "UTC";
    return formatDateInTimezone(new Date(), timezone);
  }, [profile?.timezone]);

  const queryKey = ["companion-stat-analysis", user?.id, analysisDateKey] as const;

  const invokeAnalysis = async (forceRefresh: boolean) => {
    const { data, error } = await supabase.functions.invoke("generate-companion-stat-analysis", {
      body: { forceRefresh },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    return data;
  };

  const loadAnalysis = async ({
    forceRefresh,
    allowMalformedCacheRecovery,
  }: {
    forceRefresh: boolean;
    allowMalformedCacheRecovery: boolean;
  }): Promise<CompanionStatAnalysisResponse> => {
    const rawResponse = await invokeAnalysis(forceRefresh);
    const validation = validateCompanionStatAnalysisResponse(rawResponse);
    if (validation.ok) {
      return validation.data;
    }

    if (!forceRefresh && allowMalformedCacheRecovery && isCachedMalformedAnalysisResponse(rawResponse)) {
      const refreshedResponse = await invokeAnalysis(true);
      const refreshedValidation = validateCompanionStatAnalysisResponse(refreshedResponse);
      if (refreshedValidation.ok) {
        return refreshedValidation.data;
      }

      throw new Error(getMalformedAnalysisMessage(refreshedValidation.error, true));
    }

    throw new Error(getMalformedAnalysisMessage(validation.error, forceRefresh));
  };

  const query = useQuery({
    queryKey,
    enabled: enabled && !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: () => loadAnalysis({ forceRefresh: false, allowMalformedCacheRecovery: true }),
  });

  const refreshMutation = useMutation({
    mutationFn: () => loadAnalysis({ forceRefresh: true, allowMalformedCacheRecovery: false }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
    },
  });

  return {
    analysis: query.data?.analysis ?? null,
    cached: query.data?.cached ?? false,
    isLoading: query.isLoading,
    error: query.error ? getAnalysisErrorMessage(query.error) : null,
    refreshAnalysis: refreshMutation.mutateAsync,
    isRefreshing: refreshMutation.isPending,
    refetchAnalysis: query.refetch,
  };
};
