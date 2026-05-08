import { useQuery } from "@tanstack/react-query";

import { getCurrentVisualStageBoundaryLevel } from "@/config/progression";
import { supabase } from "@/integrations/supabase/client";
import type { Companion } from "@/hooks/useCompanion";
import { isSupabaseMissingRelationError } from "@/utils/supabaseSchemaErrors";

export interface CompanionEvolutionReplay {
  stage: number;
  videoUrl: string;
  imageUrl: string | null;
  completedAt: string | null;
  source: "evolution" | "job";
  evolutionId?: string | null;
}

type EvolutionReplayRow = {
  id: string;
  stage: number;
  image_url: string | null;
  evolved_at: string | null;
  animation_video_url: string | null;
  animation_completed_at: string | null;
};

type AnimationJobReplayRow = {
  id: string;
  evolution_id: string | null;
  stage: number;
  source_image_url: string | null;
  video_url: string | null;
  completed_at: string | null;
  requested_at: string | null;
  updated_at: string | null;
};

const EVOLUTION_REPLAY_QUERY_LIMIT = 3;

const toPlayableUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const getCurrentCompanionEvolutionReplayStage = (
  companion: Pick<Companion, "current_stage"> | null | undefined,
) => {
  if (!companion) return null;
  const boundaryStage = getCurrentVisualStageBoundaryLevel(companion.current_stage);
  return boundaryStage > 0 ? boundaryStage : null;
};

export const getCompanionCurrentEvolutionReplayQueryKey = ({
  companionId,
  stage,
}: {
  companionId: string | null | undefined;
  stage: number | null | undefined;
}) => ["companion-evolution-moments", "current-replay", companionId ?? "none", stage ?? "none"] as const;

export const fetchLatestCompanionEvolutionReplay = async ({
  companionId,
  stage,
}: {
  companionId: string;
  stage: number;
}): Promise<CompanionEvolutionReplay | null> => {
  if (!companionId || stage <= 0) return null;

  const { data: evolutionRows, error: evolutionError } = await supabase
    .from("companion_evolutions")
    .select(
      "id, stage, image_url, evolved_at, animation_video_url, animation_completed_at",
    )
    .eq("companion_id", companionId)
    .eq("stage", stage)
    .eq("animation_status", "succeeded")
    .order("animation_completed_at", { ascending: false })
    .order("evolved_at", { ascending: false })
    .limit(EVOLUTION_REPLAY_QUERY_LIMIT);

  if (evolutionError) {
    throw evolutionError;
  }

  const evolutionReplay = ((evolutionRows ?? []) as EvolutionReplayRow[])
    .map((row): CompanionEvolutionReplay | null => {
      const videoUrl = toPlayableUrl(row.animation_video_url);
      if (!videoUrl) return null;

      return {
        stage: row.stage,
        videoUrl,
        imageUrl: row.image_url ?? null,
        completedAt: row.animation_completed_at ?? row.evolved_at ?? null,
        source: "evolution",
        evolutionId: row.id,
      };
    })
    .find((row): row is CompanionEvolutionReplay => row !== null);

  if (evolutionReplay) {
    return evolutionReplay;
  }

  const { data: jobRows, error: jobError } = await supabase
    .from("companion_animation_jobs")
    .select(
      "id, evolution_id, stage, source_image_url, video_url, completed_at, requested_at, updated_at",
    )
    .eq("companion_id", companionId)
    .eq("stage", stage)
    .eq("status", "succeeded")
    .order("completed_at", { ascending: false })
    .order("requested_at", { ascending: false })
    .limit(EVOLUTION_REPLAY_QUERY_LIMIT);

  if (jobError) {
    if (isSupabaseMissingRelationError(jobError, "companion_animation_jobs")) {
      return null;
    }
    throw jobError;
  }

  return ((jobRows ?? []) as AnimationJobReplayRow[])
    .map((row): CompanionEvolutionReplay | null => {
      const videoUrl = toPlayableUrl(row.video_url);
      if (!videoUrl) return null;

      return {
        stage: row.stage,
        videoUrl,
        imageUrl: row.source_image_url ?? null,
        completedAt: row.completed_at ?? row.requested_at ?? row.updated_at ?? null,
        source: "job",
        evolutionId: row.evolution_id,
      };
    })
    .find((row): row is CompanionEvolutionReplay => row !== null) ?? null;
};

export const useCompanionCurrentEvolutionReplay = ({
  companion,
  enabled = true,
}: {
  companion: Companion | null | undefined;
  enabled?: boolean;
}) => {
  const stage = getCurrentCompanionEvolutionReplayStage(companion);
  const companionId = companion?.id ?? null;

  return useQuery({
    queryKey: getCompanionCurrentEvolutionReplayQueryKey({ companionId, stage }),
    enabled: enabled && Boolean(companionId) && Boolean(stage),
    staleTime: 30 * 1000,
    queryFn: () => {
      if (!companionId || !stage) return Promise.resolve(null);
      return fetchLatestCompanionEvolutionReplay({ companionId, stage });
    },
  });
};
