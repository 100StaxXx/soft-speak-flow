import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
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
  validateCompanionStatAnalysisResponseForClient,
} from "@/shared/companionStatAnalysis";
import {
  COMPANION_COSMIQ_TITLE_CARD_PROMPT_VERSION,
  buildCompanionCosmiqTitleCardProfileKey,
} from "@/shared/companionStatCosmiqTitles";
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

const TITLE_CARD_RETRY_DELAY_MS = 5_000;
const TITLE_CARD_MAX_FAILED_ATTEMPTS = 3;
const TITLE_CARD_MAX_RETRY_DELAY_MS = 30_000;

const getTitleCardRetryDelayMs = (failedAttempts: number) =>
  Math.min(
    TITLE_CARD_MAX_RETRY_DELAY_MS,
    TITLE_CARD_RETRY_DELAY_MS * Math.max(1, failedAttempts),
  );

const isCosmiqTitleCard = (value: unknown): value is NonNullable<CompanionStatAnalysis["cosmiqTitleCard"]> =>
  isRecord(value)
  && typeof value.profileKey === "string"
  && value.profileKey.length > 0
  && (typeof value.imageUrl === "string" || value.imageUrl === null)
  && (
    value.imageUrls === undefined
    || (Array.isArray(value.imageUrls) && value.imageUrls.every((imageUrl) => typeof imageUrl === "string" && imageUrl.length > 0))
  )
  && (value.status === "ready" || value.status === "generating" || value.status === "unavailable")
  && typeof value.cached === "boolean"
  && typeof value.promptVersion === "number"
  && (value.failureCode === undefined || value.failureCode === null || typeof value.failureCode === "string")
  && (value.failureMessage === undefined || value.failureMessage === null || typeof value.failureMessage === "string")
  && (value.retryable === undefined || typeof value.retryable === "boolean")
  && (value.lastAttemptAt === undefined || value.lastAttemptAt === null || typeof value.lastAttemptAt === "string");

const getCosmiqTitleCardProfileKey = (analysis: CompanionStatAnalysis) =>
  analysis.cosmiqTitleCard?.profileKey
  ?? buildCompanionCosmiqTitleCardProfileKey({
    cosmiqTitle: analysis.cosmiqTitle,
    statBreakdowns: analysis.statBreakdowns,
    promptVersion: COMPANION_COSMIQ_TITLE_CARD_PROMPT_VERSION,
  });

export const useCompanionStatAnalysis = ({ enabled = true }: UseCompanionStatAnalysisOptions = {}) => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const activeTitleCardRequestKeyRef = useRef<string | null>(null);
  const lastTitleCardAttemptKeyRef = useRef<string | null>(null);
  const titleCardFailureCountsRef = useRef<Map<string, number>>(new Map());
  const titleCardRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleCardRetryKeyRef = useRef<string | null>(null);
  const titleCardMountedRef = useRef(true);
  const [titleCardRequestSettledCount, bumpTitleCardRequestSettled] = useReducer((count: number) => count + 1, 0);
  const analysisDateKey = useMemo(() => {
    const timezone = profile?.timezone || "UTC";
    return formatDateInTimezone(new Date(), timezone);
  }, [profile?.timezone]);

  const queryKey = useMemo(
    () => ["companion-stat-analysis", user?.id, analysisDateKey] as const,
    [analysisDateKey, user?.id],
  );

  const markTitleCardUnavailable = useCallback(({
    analysisDate,
    expectedProfileKey,
    failureCode = "client_fetch_failed",
    failureMessage = "Title art request failed. Tap regenerate to try again.",
    retryable = false,
  }: {
    analysisDate: string;
    expectedProfileKey: string;
    failureCode?: string;
    failureMessage?: string;
    retryable?: boolean;
  }) => {
    queryClient.setQueryData<CompanionStatAnalysisResponse | undefined>(queryKey, (current) => {
      if (!current) return current;
      if (current.analysis.analysisDate !== analysisDate) return current;
      if (getCosmiqTitleCardProfileKey(current.analysis) !== expectedProfileKey) return current;

      return {
        ...current,
        analysis: {
          ...current.analysis,
          cosmiqTitleCard: {
            profileKey: expectedProfileKey,
            imageUrl: null,
            imageUrls: [],
            status: "unavailable",
            cached: false,
            promptVersion: COMPANION_COSMIQ_TITLE_CARD_PROMPT_VERSION,
            failureCode,
            failureMessage,
            retryable,
            lastAttemptAt: new Date().toISOString(),
          },
        },
      };
    });
  }, [queryClient, queryKey]);

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
    const validation = validateCompanionStatAnalysisResponseForClient(rawResponse);
    if (validation.ok) {
      return validation.data;
    }

    if (!forceRefresh && allowMalformedCacheRecovery && isCachedMalformedAnalysisResponse(rawResponse)) {
      const refreshedResponse = await invokeAnalysis(true);
      const refreshedValidation = validateCompanionStatAnalysisResponseForClient(refreshedResponse);
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
      titleCardFailureCountsRef.current.delete(`${data.analysis.analysisDate}:${getCosmiqTitleCardProfileKey(data.analysis)}`);
      queryClient.setQueryData(queryKey, data);
    },
  });

  const titleCardMutation = useMutation({
    mutationFn: async ({
      analysisDate,
      expectedProfileKey,
      forceRefresh = false,
    }: {
      analysisDate: string;
      expectedProfileKey: string;
      forceRefresh?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke("generate-cosmiq-title-card", {
        body: forceRefresh ? { analysisDate, forceRefresh: true } : { analysisDate },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!isCosmiqTitleCard(data?.card)) {
        throw new Error("Received malformed Cosmiq title card data");
      }
      return {
        analysisDate,
        expectedProfileKey,
        card: data.card,
      };
    },
    onSuccess: ({ analysisDate, expectedProfileKey, card }) => {
      const requestKey = `${analysisDate}:${expectedProfileKey}`;
      let nextCard = card;
      if (card.status === "ready") {
        titleCardFailureCountsRef.current.delete(requestKey);
      } else if (card.status === "unavailable" && card.retryable) {
        const failedAttempts = (titleCardFailureCountsRef.current.get(requestKey) ?? 0) + 1;
        titleCardFailureCountsRef.current.set(requestKey, failedAttempts);
        if (failedAttempts >= TITLE_CARD_MAX_FAILED_ATTEMPTS) {
          titleCardFailureCountsRef.current.delete(requestKey);
          nextCard = {
            ...card,
            failureCode: "retry_limit_reached",
            failureMessage: "Title art retries paused. Tap regenerate to try again.",
            retryable: false,
            lastAttemptAt: card.lastAttemptAt ?? new Date().toISOString(),
          };
        }
      } else if (card.status === "unavailable") {
        titleCardFailureCountsRef.current.delete(requestKey);
      }

      queryClient.setQueryData<CompanionStatAnalysisResponse | undefined>(queryKey, (current) => {
        if (!current) return current;
        if (current.analysis.analysisDate !== analysisDate) return current;
        if (getCosmiqTitleCardProfileKey(current.analysis) !== expectedProfileKey) return current;
        if (nextCard.profileKey !== expectedProfileKey) return current;

        return {
          ...current,
          analysis: {
            ...current.analysis,
            cosmiqTitleCard: nextCard,
          },
        };
      });
    },
  });
  const generateTitleCard = titleCardMutation.mutateAsync;
  const isTitleCardGenerationPending = titleCardMutation.isPending;

  const regenerateTitleCard = useCallback(async (analysis: CompanionStatAnalysis) => {
    const expectedProfileKey = getCosmiqTitleCardProfileKey(analysis);
    const requestKey = `${analysis.analysisDate}:${expectedProfileKey}`;
    titleCardFailureCountsRef.current.delete(requestKey);
    lastTitleCardAttemptKeyRef.current = null;
    if (titleCardRetryTimeoutRef.current) {
      clearTimeout(titleCardRetryTimeoutRef.current);
      titleCardRetryTimeoutRef.current = null;
    }
    titleCardRetryKeyRef.current = null;

    return await generateTitleCard({
      analysisDate: analysis.analysisDate,
      expectedProfileKey,
      forceRefresh: true,
    });
  }, [generateTitleCard]);

  useEffect(() => {
    titleCardMountedRef.current = true;

    return () => {
      titleCardMountedRef.current = false;
      if (titleCardRetryTimeoutRef.current) {
        clearTimeout(titleCardRetryTimeoutRef.current);
        titleCardRetryTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const clearRetryTimer = () => {
      if (titleCardRetryTimeoutRef.current) {
        clearTimeout(titleCardRetryTimeoutRef.current);
        titleCardRetryTimeoutRef.current = null;
      }
      titleCardRetryKeyRef.current = null;
    };

    const analysis = query.data?.analysis;
    if (!enabled || !user?.id || !analysis) {
      clearRetryTimer();
      return;
    }

    const titleCard = analysis.cosmiqTitleCard;
    if (titleCard?.status === "ready" || (titleCard?.status === "unavailable" && !titleCard.retryable)) {
      clearRetryTimer();
      return;
    }

    const expectedProfileKey = getCosmiqTitleCardProfileKey(analysis);
    const requestKey = `${analysis.analysisDate}:${expectedProfileKey}`;
    const failedAttempts = titleCardFailureCountsRef.current.get(requestKey) ?? 0;
    if (titleCard?.status === "unavailable" && failedAttempts >= TITLE_CARD_MAX_FAILED_ATTEMPTS) {
      clearRetryTimer();
      return;
    }

    if (activeTitleCardRequestKeyRef.current === requestKey || isTitleCardGenerationPending) return;

    const requestTitleCard = () => {
      if (activeTitleCardRequestKeyRef.current === requestKey) return;

      activeTitleCardRequestKeyRef.current = requestKey;
      lastTitleCardAttemptKeyRef.current = requestKey;
      void generateTitleCard({
        analysisDate: analysis.analysisDate,
        expectedProfileKey,
      })
        .catch(() => {
          const failedAttempts = (titleCardFailureCountsRef.current.get(requestKey) ?? 0) + 1;
          titleCardFailureCountsRef.current.set(requestKey, failedAttempts);

          if (failedAttempts >= TITLE_CARD_MAX_FAILED_ATTEMPTS) {
            titleCardFailureCountsRef.current.delete(requestKey);
            markTitleCardUnavailable({
              analysisDate: analysis.analysisDate,
              expectedProfileKey,
              failureCode: "client_fetch_failed",
              failureMessage: "Title art request failed. Tap regenerate to try again.",
              retryable: false,
            });
          }
        })
        .finally(() => {
          if (activeTitleCardRequestKeyRef.current === requestKey) {
            activeTitleCardRequestKeyRef.current = null;
            if (titleCardMountedRef.current) {
              bumpTitleCardRequestSettled();
            }
          }
        });
    };

    if (lastTitleCardAttemptKeyRef.current !== requestKey) {
      clearRetryTimer();
      requestTitleCard();
      return;
    }

    if (titleCardRetryTimeoutRef.current && titleCardRetryKeyRef.current === requestKey) {
      return;
    }

    clearRetryTimer();
    titleCardRetryKeyRef.current = requestKey;
    titleCardRetryTimeoutRef.current = setTimeout(() => {
      titleCardRetryTimeoutRef.current = null;
      titleCardRetryKeyRef.current = null;
      requestTitleCard();
    }, getTitleCardRetryDelayMs(failedAttempts));
  }, [
    enabled,
    generateTitleCard,
    isTitleCardGenerationPending,
    markTitleCardUnavailable,
    query.data?.analysis,
    titleCardRequestSettledCount,
    user?.id,
  ]);

  return {
    analysis: query.data?.analysis ?? null,
    cached: query.data?.cached ?? false,
    isLoading: query.isLoading,
    error: query.error ? getAnalysisErrorMessage(query.error) : null,
    refreshAnalysis: refreshMutation.mutateAsync,
    isRefreshing: refreshMutation.isPending,
    refetchAnalysis: query.refetch,
    regenerateTitleCard,
    isRegeneratingTitleCard: titleCardMutation.isPending,
  };
};
