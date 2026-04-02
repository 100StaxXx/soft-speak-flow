import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CompanionEvolution } from "@/components/CompanionEvolution";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEvolution } from "@/contexts/EvolutionContext";
import { useCelebration } from "@/contexts/CelebrationContext";
import { useMentorConnection } from "@/contexts/MentorConnectionContext";
import { resolveCompanionVisualAssetUrl } from "@/lib/companionAssetResolver";
import { logger } from "@/utils/logger";
import {
  didTierChange,
  getProgressionLevelDisplay,
  getProgressionTierLabelForLevel,
} from "@/config/progression";
import { useCompanionMotionSafe } from "@/contexts/CompanionMotionContext";

export const GlobalEvolutionListener = () => {
  const { user } = useAuth();
  const { mentorId: resolvedMentorId } = useMentorConnection();
  const queryClient = useQueryClient();
  const { setIsEvolvingLoading, onEvolutionComplete } = useEvolution();
  const { setEvolutionInProgress } = useCelebration();
  const { triggerEvent } = useCompanionMotionSafe();
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolutionData, setEvolutionData] = useState<{
    level: number;
    imageUrl: string;
    mentorSlug?: string;
    element?: string;
  } | null>(null);

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

          let mentorSlug: string | undefined;
          if (resolvedMentorId) {
            const { data: mentor } = await supabase
              .from("mentors")
              .select("slug")
              .eq("id", resolvedMentorId)
              .maybeSingle();

            mentorSlug = mentor?.slug;
          }

          setEvolutionData({
            level: newLevel,
            imageUrl,
            mentorSlug,
            element,
          });
          triggerEvent({
            type: "evolution_start",
            intensity: newLevel >= 56 ? "heroic" : "medium",
            element,
            stage: newLevel,
          });
          setIsEvolving(true);
          setEvolutionInProgress(true);
          window.dispatchEvent(new CustomEvent("evolution-loading-start"));

          const today = new Date().toISOString().split("T")[0];
          const isFirstEvolution = newLevel === 1;
          const tierLabel = getProgressionTierLabelForLevel(newLevel);
          supabase.from("companion_memories").insert({
            user_id: user.id,
            companion_id: companionId,
            memory_type: isFirstEvolution ? "first_evolution" : "evolution",
            memory_date: today,
            memory_context: {
              title: isFirstEvolution ? "First Hatch" : `Reached ${getProgressionLevelDisplay(newLevel)}`,
              description: isFirstEvolution
                ? "The shell cracked open, and your companion finally emerged."
                : `Your companion crossed into the ${tierLabel} tier.`,
              emotion: isFirstEvolution ? "pride" : "joy",
              details: {
                level: newLevel,
                previousLevel: oldLevel,
                tier: tierLabel,
              },
            },
            referenced_count: 0,
          }).then(({ error }) => {
            if (error) logger.error("Failed to create evolution memory:", error);
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
  }, [user, user?.id, resolvedMentorId, queryClient, setEvolutionInProgress, triggerEvent]);

  if (!isEvolving || !evolutionData) {
    return null;
  }

  return (
    <CompanionEvolution
      isEvolving={isEvolving}
      newStage={evolutionData.level}
      newImageUrl={evolutionData.imageUrl}
      mentorSlug={evolutionData.mentorSlug}
      element={evolutionData.element}
      userId={user?.id}
      onComplete={() => {
        setIsEvolving(false);
        setEvolutionData(null);
        setIsEvolvingLoading(false);
        setEvolutionInProgress(false);

        if (onEvolutionComplete) {
          onEvolutionComplete();
        }
      }}
    />
  );
};
