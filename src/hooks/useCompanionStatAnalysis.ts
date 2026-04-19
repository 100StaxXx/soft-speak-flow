import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

export type CompanionStatAttribute =
  | "vitality"
  | "wisdom"
  | "discipline"
  | "resolve"
  | "creativity"
  | "alignment";

export type CompanionStatBand = "Emerging" | "Building" | "Strong" | "Exceptional";
export type CompanionStatDriverSource = "attribute_event" | "activity" | "echo";
export type CompanionStatDriverWindow = "7d" | "30d";

export interface CompanionStatDriver {
  key: string;
  label: string;
  detail: string;
  sourceType: CompanionStatDriverSource;
  window: CompanionStatDriverWindow;
  count: number | null;
  amount: number | null;
}

export interface CompanionStatBreakdown {
  attribute: CompanionStatAttribute;
  score: number;
  band: CompanionStatBand;
  status: string;
  primaryReasons: string[];
  recentDrivers: CompanionStatDriver[];
}

export interface CompanionStatActivitySnapshot {
  activityStartDate: string;
  activityEndDate: string;
  provenanceStartDate: string;
  provenanceEndDate: string;
  morningCheckIns: number;
  eveningReflections: number;
  habitCompletions: number;
  onTimeTasks: number;
  trackedAttributeEvents: number;
  streakMilestones: number;
}

export interface CompanionStatAnalysis {
  analysisDate: string;
  timezone: string;
  generatedAt: string;
  mentor: {
    id: string | null;
    name: string;
    tone: string | null;
    avatarUrl: string | null;
    primaryColor: string | null;
  };
  companion: {
    id: string;
    currentStage: number;
    currentXp: number;
  };
  activitySnapshot: CompanionStatActivitySnapshot;
  statBreakdowns: CompanionStatBreakdown[];
  summary: string;
  suggestedAction: string;
}

export interface CompanionStatAnalysisResponse {
  analysis: CompanionStatAnalysis;
  cached: boolean;
}

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

export const useCompanionStatAnalysis = ({ enabled = true }: UseCompanionStatAnalysisOptions = {}) => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const analysisDateKey = useMemo(() => {
    const timezone = profile?.timezone || "UTC";
    return formatDateInTimezone(new Date(), timezone);
  }, [profile?.timezone]);

  const queryKey = ["companion-stat-analysis", user?.id, analysisDateKey] as const;

  const query = useQuery({
    queryKey,
    enabled: enabled && !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-companion-stat-analysis", {
        body: { forceRefresh: false },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data as CompanionStatAnalysisResponse;
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-companion-stat-analysis", {
        body: { forceRefresh: true },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data as CompanionStatAnalysisResponse;
    },
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
