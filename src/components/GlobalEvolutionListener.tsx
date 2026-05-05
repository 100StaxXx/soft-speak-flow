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
      .select("id, animation_video_url")
      .eq("companion_id", companionId)
      .eq("stage", stage)
      .maybeSingle();

    if (error) {
      logger.warn("Evolution listener: Failed to verify persisted evolution", {
        companionId,
        stage,
        error: error.message,
      });
      return null;
    }

    if (data?.id) {
      return {
        evolutionId: data.id,
        animationVideoUrl: typeof data.animation_video_url === "string" ? data.animation_video_url : null,
      };
    }
  }

  return null;
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
    presetId?: string;
    mentorSlug?: string;
    element?: string;
    evolutionId?: string;
    animationVideoUrl?: string | null;
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
    presetId,
    element,
    evolutionId,
    animationVideoUrl,
    dispatchLoadingStart = false,
    markAsLocalHatch = false,
  }: {
    companionId: string;
    previousLevel: number;
    level: number;
    previousImageUrl: string;
    imageUrl: string;
    presetId?: string;
    element?: string;
    evolutionId?: string;
    animationVideoUrl?: string | null;
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
        presetId,
        element,
        evolutionId,
        animationVideoUrl: animationVideoUrl ?? null,
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

          const persistence = await waitForEvolutionPersistence({
            companionId,
            stage: newLevel,
          });

          if (!persistence) {
            logger.warn("Evolution listener: Ignoring stage update without persisted evolution row", {
              companionId,
              oldLevel,
              newLevel,
            });
            return;
          }

          // For the initial hatch (0→1), defer the reveal until the Kling
          // animation has rendered. The always-on companion_evolutions
          // subscription above re-presents the full reveal once
          // animation_video_url is populated by the cron drainer. This
          // guards against the race where this realtime UPDATE arrives
          // before handleHatchStarted runs and seeds the local-hatch
          // dedupe key — the user shouldn't see a still-only fallback for
          // their first hatch.
          if (oldLevel === 0 && newLevel === 1 && !persistence.animationVideoUrl) {
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
            presetId: typeof newData.preset_id === "string"
              ? newData.preset_id
              : typeof oldData.preset_id === "string"
                ? oldData.preset_id
                : undefined,
            element,
            evolutionId: persistence.evolutionId,
            animationVideoUrl: persistence.animationVideoUrl,
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

  // Hot-swap the Kling MP4 once the cron drainer flips animation_video_url
  // on the active evolution row mid-presentation. CompanionEvolution renders
  // the video over the still during reveal/settle; if the URL arrives after
  // the still has appeared, the video fades in cleanly.
  useEffect(() => {
    const evolutionId = evolutionData?.evolutionId;
    if (!evolutionId || evolutionData?.animationVideoUrl) {
      return;
    }

    const channel = supabase
      .channel(`companion-evolution-row-${evolutionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "companion_evolutions",
          filter: `id=eq.${evolutionId}`,
        },
        (payload) => {
          const next = payload.new as Record<string, unknown> | null;
          const nextUrl = next && typeof next.animation_video_url === "string"
            ? next.animation_video_url
            : null;
          if (!nextUrl) return;
          setEvolutionData((current) => {
            if (!current || current.evolutionId !== evolutionId) return current;
            if (current.animationVideoUrl) return current;
            return { ...current, animationVideoUrl: nextUrl };
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [evolutionData?.evolutionId, evolutionData?.animationVideoUrl]);

  // Re-present an evolution from scratch with the Kling video. Used both by
  // the always-on realtime subscription (mid-session arrivals) and the
  // load-time check below (user closed the app between hatch and Kling).
  const presentEvolutionWithVideo = useCallback(async ({
    evolutionId,
    companionId,
    stage,
    imageUrl,
    animationVideoUrl,
  }: {
    evolutionId: string;
    companionId: string;
    stage: number;
    imageUrl: string;
    animationVideoUrl: string;
  }) => {
    if (activeEvolutionKeyRef.current === buildEvolutionKey(companionId, stage)) {
      // Already on screen — the hot-swap subscription handles this case.
      return;
    }

    // Fetch the companion identity and previous-stage portrait in parallel.
    // Halves the time-to-present for the re-present path.
    const [companionResult, previousResult] = await Promise.all([
      supabase
        .from("user_companion")
        .select("preset_id, core_element, current_image_url, initial_image_url")
        .eq("id", companionId)
        .maybeSingle(),
      supabase
        .from("companion_evolutions")
        .select("image_url")
        .eq("companion_id", companionId)
        .lt("stage", stage)
        .order("stage", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const companionRow = companionResult.data;
    const previousEvolution = previousResult.data;
    if (!companionRow) return;

    const previousImageUrl =
      (previousEvolution && typeof previousEvolution.image_url === "string"
        ? previousEvolution.image_url
        : null)
      ?? (typeof companionRow.initial_image_url === "string" ? companionRow.initial_image_url : null)
      ?? (typeof companionRow.current_image_url === "string" ? companionRow.current_image_url : null)
      ?? "";

    // Allow re-trigger by clearing the dedupe key for this evolution.
    activeEvolutionKeyRef.current = null;

    void startEvolutionPresentation({
      companionId,
      previousLevel: Math.max(0, stage - 1),
      level: stage,
      previousImageUrl,
      imageUrl,
      presetId: typeof companionRow.preset_id === "string" ? companionRow.preset_id : undefined,
      element: typeof companionRow.core_element === "string" ? companionRow.core_element : undefined,
      evolutionId,
      animationVideoUrl,
    });
  }, [buildEvolutionKey, startEvolutionPresentation]);

  // Always-on realtime subscription on the user's evolution rows. Fires when
  // the cron drainer flips animation_video_url from null to a string AFTER
  // the user has dismissed the live evolution screen — re-presents with the
  // video, mirroring the existing "bring the user back when ready" pattern
  // used by triggerManualEvolution + hatchAnimationSnapshot.
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`companion-evolution-video-ready-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "companion_evolutions",
        },
        (payload) => {
          const next = payload.new as Record<string, unknown> | null;
          const old = payload.old as Record<string, unknown> | null;
          if (!next || !old) return;

          const newUrl = typeof next.animation_video_url === "string" ? next.animation_video_url : null;
          const oldUrl = typeof old.animation_video_url === "string" ? old.animation_video_url : null;
          if (!newUrl || oldUrl) return;
          if (next.animation_seen_at) return;

          const evolutionId = typeof next.id === "string" ? next.id : null;
          const companionId = typeof next.companion_id === "string" ? next.companion_id : null;
          const stage = typeof next.stage === "number" ? next.stage : null;
          const imageUrl = typeof next.image_url === "string" ? next.image_url : null;
          if (!evolutionId || !companionId || stage === null || !imageUrl) return;

          void presentEvolutionWithVideo({
            evolutionId,
            companionId,
            stage,
            imageUrl,
            animationVideoUrl: newUrl,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, presentEvolutionWithVideo]);

  // Load-time replay: when the app boots, look for the user's most recent
  // evolution that has a Kling video AND hasn't been shown to them yet, and
  // re-present it. Covers the case where the user closed the app between the
  // hatch (still played) and Kling completion (~30-90s later). Keyed by user
  // id so account switches re-fire the check rather than silently skipping.
  const replayCheckedForUserRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    if (replayCheckedForUserRef.current === user.id) return;
    replayCheckedForUserRef.current = user.id;

    void (async () => {
      const recencyCutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: row } = await supabase
        .from("companion_evolutions")
        .select("id, companion_id, stage, image_url, animation_video_url, evolved_at, user_companion!inner(user_id)")
        .eq("user_companion.user_id", user.id)
        .not("animation_video_url", "is", null)
        .is("animation_seen_at", null)
        .gte("evolved_at", recencyCutoffIso)
        .order("evolved_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!row) return;
      const evolutionId = typeof row.id === "string" ? row.id : null;
      const companionId = typeof row.companion_id === "string" ? row.companion_id : null;
      const stage = typeof row.stage === "number" ? row.stage : null;
      const imageUrl = typeof row.image_url === "string" ? row.image_url : null;
      const animationVideoUrl = typeof row.animation_video_url === "string" ? row.animation_video_url : null;
      if (!evolutionId || !companionId || stage === null || !imageUrl || !animationVideoUrl) return;

      await presentEvolutionWithVideo({
        evolutionId,
        companionId,
        stage,
        imageUrl,
        animationVideoUrl,
      });
    })();
  }, [user?.id, presentEvolutionWithVideo]);

  useEffect(() => {
    if (!user) return;

    const handleHatchStarted = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!isCompanionHatchStartedDetail(detail)) {
        return;
      }

      // Defer the reveal until the Kling video URL is ready. Marking this
      // hatch as a "recent local hatch" suppresses the user_companion
      // realtime UPDATE handler from showing the still-only fallback when
      // current_stage flips 0→1 in the database. Once the cron drainer
      // populates animation_video_url on companion_evolutions, the always-on
      // companion_evolutions subscription above re-presents the full reveal
      // with the Kling video.
      //
      // Net effect: tapping Hatch hides the mentor tutorial card (the
      // complete_companion_hatch milestone is in MILESTONES_AUTO_HIDDEN),
      // the user can navigate freely, and CompanionEvolution mounts later
      // with the full animation in hand.
      const key = buildEvolutionKey(detail.companionId, detail.newStage);
      pruneRecentLocalHatchKeys();
      recentLocalHatchKeysRef.current.set(key, Date.now());
    };

    window.addEventListener(COMPANION_HATCH_STARTED_EVENT, handleHatchStarted as EventListener);
    return () => {
      window.removeEventListener(COMPANION_HATCH_STARTED_EVENT, handleHatchStarted as EventListener);
    };
  }, [buildEvolutionKey, pruneRecentLocalHatchKeys, user]);

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
      presetId={evolutionData.presetId}
      element={evolutionData.element}
      animationVideoUrl={evolutionData.animationVideoUrl ?? null}
      onComplete={() => {
        // Only mark animation as seen when the user actually had the Kling
        // video URL on this presentation. If they dismissed BEFORE Kling
        // landed (animationVideoUrl still null), leave animation_seen_at
        // NULL so the always-on / load-time replay can bring them back to
        // see the video once it's ready.
        if (evolutionData.evolutionId && evolutionData.animationVideoUrl) {
          void supabase.rpc("mark_companion_animation_seen", {
            p_evolution_id: evolutionData.evolutionId,
          });
        }
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
