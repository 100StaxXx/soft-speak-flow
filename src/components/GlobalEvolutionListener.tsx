import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CompanionEvolution } from "@/components/CompanionEvolution";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEvolution } from "@/contexts/EvolutionContext";
import { useCelebration } from "@/contexts/CelebrationContext";
import { useMentorConnection } from "@/contexts/MentorConnectionContext";
import { resolveCompanionVisualAssetUrl } from "@/lib/companionAssetResolver";
import {
  COMPANION_HATCH_STARTED_EVENT,
  isCompanionHatchStartedDetail,
} from "@/lib/companionEvolutionEvents";
import { logger } from "@/utils/logger";
import {
  didTierChange,
  getProgressionLevelDisplay,
  getProgressionTierLabelForLevel,
} from "@/config/progression";
import { useCompanionMotionSafe } from "@/contexts/CompanionMotionContext";

const EVOLUTION_RECORD_RETRY_DELAYS_MS = [0, 75, 150] as const;
const LOCAL_HATCH_DEDUPE_WINDOW_MS = 15000;

const waitForEvolutionPersistence = async ({
  companionId,
  stage,
}: {
  companionId: string;
  stage: number;
}) => {
  for (const delayMs of EVOLUTION_RECORD_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const { data, error } = await supabase
      .from("companion_evolutions")
      .select("id")
      .eq("companion_id", companionId)
      .eq("stage", stage)
      .maybeSingle();

    if (error) {
      logger.warn("Evolution listener: Failed to verify persisted evolution", {
        companionId,
        stage,
        error: error.message,
      });
      return false;
    }

    if (data?.id) {
      return true;
    }
  }

  return false;
};

export const GlobalEvolutionListener = () => {
  const { user } = useAuth();
  const { mentorId: resolvedMentorId } = useMentorConnection();
  const queryClient = useQueryClient();
  const { setIsEvolvingLoading, onEvolutionComplete } = useEvolution();
  const { setEvolutionInProgress } = useCelebration();
  const { triggerEvent } = useCompanionMotionSafe();
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolutionData, setEvolutionData] = useState<{
    companionId: string;
    previousLevel: number;
    level: number;
    previousImageUrl: string;
    imageUrl: string;
    mentorSlug?: string;
    element?: string;
  } | null>(null);
  const activeEvolutionKeyRef = useRef<string | null>(null);
  const recentLocalHatchKeysRef = useRef(new Map<string, number>());

  const buildEvolutionKey = useCallback((companionId: string, stage: number) => (
    `${companionId}:${stage}`
  ), []);

  const pruneRecentLocalHatchKeys = useCallback(() => {
    const now = Date.now();
    recentLocalHatchKeysRef.current.forEach((timestamp, key) => {
      if (now - timestamp > LOCAL_HATCH_DEDUPE_WINDOW_MS) {
        recentLocalHatchKeysRef.current.delete(key);
      }
    });
  }, []);

  const resolveMentorSlug = useCallback(async () => {
    if (!resolvedMentorId) return undefined;

    const { data: mentor } = await supabase
      .from("mentors")
      .select("slug")
      .eq("id", resolvedMentorId)
      .maybeSingle();

    return mentor?.slug;
  }, [resolvedMentorId]);

  const recordEvolutionMemory = useCallback(({
    companionId,
    previousLevel,
    level,
  }: {
    companionId: string;
    previousLevel: number;
    level: number;
  }) => {
    if (!user?.id) return;

    const today = new Date().toISOString().split("T")[0];
    const isFirstEvolution = level === 1;
    const tierLabel = getProgressionTierLabelForLevel(level);
    supabase.from("companion_memories").insert({
      user_id: user.id,
      companion_id: companionId,
      memory_type: isFirstEvolution ? "first_evolution" : "evolution",
      memory_date: today,
      memory_context: {
        title: isFirstEvolution ? "First Hatch" : `Reached ${getProgressionLevelDisplay(level)}`,
        description: isFirstEvolution
          ? "The shell cracked open, and your companion finally emerged."
          : `Your companion crossed into the ${tierLabel} tier.`,
        emotion: isFirstEvolution ? "pride" : "joy",
        details: {
          level,
          previousLevel,
          tier: tierLabel,
        },
      },
      referenced_count: 0,
    }).then(({ error }) => {
      if (error) logger.error("Failed to create evolution memory:", error);
    });
  }, [user?.id]);

  const startEvolutionPresentation = useCallback(({
    companionId,
    previousLevel,
    level,
    previousImageUrl,
    imageUrl,
    element,
    dispatchLoadingStart = false,
    markAsLocalHatch = false,
  }: {
    companionId: string;
    previousLevel: number;
    level: number;
    previousImageUrl: string;
    imageUrl: string;
    element?: string;
    dispatchLoadingStart?: boolean;
    markAsLocalHatch?: boolean;
  }) => {
    const key = buildEvolutionKey(companionId, level);

    if (activeEvolutionKeyRef.current === key) {
      return false;
    }

    activeEvolutionKeyRef.current = key;

    if (markAsLocalHatch) {
      recentLocalHatchKeysRef.current.set(key, Date.now());
    }

    try {
      setEvolutionData({
        companionId,
        previousLevel,
        level,
        previousImageUrl,
        imageUrl,
        element,
      });
      triggerEvent({
        type: "evolution_start",
        intensity: level >= 56 ? "heroic" : "medium",
        element,
        stage: level,
      });
      setIsEvolving(true);
      setEvolutionInProgress(true);

      if (dispatchLoadingStart) {
        window.dispatchEvent(new CustomEvent("evolution-loading-start"));
      }

      recordEvolutionMemory({
        companionId,
        previousLevel,
        level,
      });

      void resolveMentorSlug()
        .then((mentorSlug) => {
          if (!mentorSlug) {
            return;
          }

          setEvolutionData((current) => {
            if (
              !current
              || current.companionId !== companionId
              || current.previousLevel !== previousLevel
              || current.level !== level
            ) {
              return current;
            }

            if (current.mentorSlug === mentorSlug) {
              return current;
            }

            return {
              ...current,
              mentorSlug,
            };
          });
        })
        .catch((error) => {
          logger.warn("Evolution listener: Failed to resolve mentor slug", {
            companionId,
            level,
            error: error instanceof Error ? error.message : String(error),
          });
        });

      return true;
    } catch (error) {
      activeEvolutionKeyRef.current = null;
      logger.error("Evolution listener: Failed to start evolution presentation", {
        companionId,
        level,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }, [
    buildEvolutionKey,
    recordEvolutionMemory,
    resolveMentorSlug,
    setEvolutionInProgress,
    triggerEvent,
  ]);

  useEffect(() => {
    if (!user) return;

    const invalidateCompanionQueries = () => {
      queryClient.invalidateQueries({ queryKey: ["companion"] });
      queryClient.invalidateQueries({ queryKey: ["companion-health"] });
      queryClient.invalidateQueries({ queryKey: ["companion-care-signals"] });
      queryClient.invalidateQueries({ queryKey: ["companion-attributes"] });
      queryClient.invalidateQueries({ queryKey: ["companion-story"] });
      queryClient.invalidateQueries({ queryKey: ["companion-stories-all"] });
      queryClient.invalidateQueries({ queryKey: ["companion-memories"] });
      queryClient.invalidateQueries({ queryKey: ["companion-bond"] });
      queryClient.invalidateQueries({ queryKey: ["companion-evolution-image"] });
      queryClient.invalidateQueries({ queryKey: ["current-evolution-card"] });
      queryClient.invalidateQueries({ queryKey: ["evolution-cards"] });
    };

    const channel = supabase
      .channel(`companion-evolution-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_companion",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          invalidateCompanionQueries();

          if (payload.eventType !== "UPDATE") {
            return;
          }

          const newData = payload.new as Record<string, unknown> | null;
          const oldData = payload.old as Record<string, unknown> | null;

          if (!newData || !oldData) {
            logger.warn("Evolution listener: Missing payload data");
            return;
          }

          const newLevel = typeof newData.current_stage === "number" ? newData.current_stage : null;
          const oldLevel = typeof oldData.current_stage === "number" ? oldData.current_stage : null;

          if (newLevel === null || oldLevel === null) {
            logger.warn("Evolution listener: Invalid stage values");
            return;
          }

          if (newLevel <= oldLevel || !didTierChange(oldLevel, newLevel)) {
            return;
          }

          const companionId = typeof newData.id === "string" ? newData.id : null;
          if (!companionId) {
            logger.warn("Evolution listener: Missing companion id");
            return;
          }

          const evolutionKey = buildEvolutionKey(companionId, newLevel);
          pruneRecentLocalHatchKeys();

          const localHatchStartedAt = recentLocalHatchKeysRef.current.get(evolutionKey);
          if (localHatchStartedAt && Date.now() - localHatchStartedAt <= LOCAL_HATCH_DEDUPE_WINDOW_MS) {
            recentLocalHatchKeysRef.current.delete(evolutionKey);
            return;
          }

          const hasPersistedEvolution = await waitForEvolutionPersistence({
            companionId,
            stage: newLevel,
          });

          if (!hasPersistedEvolution) {
            logger.warn("Evolution listener: Ignoring stage update without persisted evolution row", {
              companionId,
              oldLevel,
              newLevel,
            });
            return;
          }

          const currentImageUrl = typeof newData.current_image_url === "string" ? newData.current_image_url : "";
          const element = typeof newData.core_element === "string" ? newData.core_element : undefined;
          const imageUrl = resolveCompanionVisualAssetUrl({
            preset_id: typeof newData.preset_id === "string" ? newData.preset_id : null,
            current_stage: newLevel,
            core_element: element ?? null,
            current_image_url: currentImageUrl,
            dormant_image_url: typeof newData.dormant_image_url === "string" ? newData.dormant_image_url : null,
            neglected_image_url: typeof newData.neglected_image_url === "string" ? newData.neglected_image_url : null,
          }) ?? currentImageUrl;
          const previousImageUrl = resolveCompanionVisualAssetUrl({
            preset_id: typeof oldData.preset_id === "string"
              ? oldData.preset_id
              : typeof newData.preset_id === "string"
                ? newData.preset_id
                : null,
            current_stage: oldLevel,
            core_element: typeof oldData.core_element === "string"
              ? oldData.core_element
              : element ?? null,
            current_image_url: typeof oldData.current_image_url === "string"
              ? oldData.current_image_url
              : currentImageUrl,
            dormant_image_url: typeof oldData.dormant_image_url === "string"
              ? oldData.dormant_image_url
              : typeof newData.dormant_image_url === "string"
                ? newData.dormant_image_url
                : null,
            neglected_image_url: typeof oldData.neglected_image_url === "string"
              ? oldData.neglected_image_url
              : typeof newData.neglected_image_url === "string"
                ? newData.neglected_image_url
                : null,
          }) ?? currentImageUrl;

          await startEvolutionPresentation({
            companionId,
            previousLevel: oldLevel,
            level: newLevel,
            previousImageUrl,
            imageUrl,
            element,
            dispatchLoadingStart: true,
          });
        },
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logger.warn("Evolution listener subscription error", { status, error: err?.message });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    buildEvolutionKey,
    pruneRecentLocalHatchKeys,
    queryClient,
    startEvolutionPresentation,
    user,
    user?.id,
  ]);

  useEffect(() => {
    if (!user) return;

    const handleHatchStarted = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!isCompanionHatchStartedDetail(detail)) {
        return;
      }

      void startEvolutionPresentation({
        companionId: detail.companionId,
        previousLevel: detail.previousStage,
        level: detail.newStage,
        previousImageUrl: detail.previousImageUrl,
        imageUrl: detail.newImageUrl,
        element: detail.element ?? undefined,
        markAsLocalHatch: true,
      });
    };

    window.addEventListener(COMPANION_HATCH_STARTED_EVENT, handleHatchStarted as EventListener);
    return () => {
      window.removeEventListener(COMPANION_HATCH_STARTED_EVENT, handleHatchStarted as EventListener);
    };
  }, [startEvolutionPresentation, user]);

  if (!isEvolving || !evolutionData) {
    return null;
  }

  return (
    <CompanionEvolution
      isEvolving={isEvolving}
      previousStage={evolutionData.previousLevel}
      newStage={evolutionData.level}
      previousImageUrl={evolutionData.previousImageUrl}
      newImageUrl={evolutionData.imageUrl}
      mentorSlug={evolutionData.mentorSlug}
      element={evolutionData.element}
      userId={user?.id}
      onComplete={() => {
        setIsEvolving(false);
        setEvolutionData(null);
        activeEvolutionKeyRef.current = null;
        setIsEvolvingLoading(false);
        setEvolutionInProgress(false);

        if (onEvolutionComplete) {
          onEvolutionComplete();
        }
      }}
    />
  );
};
