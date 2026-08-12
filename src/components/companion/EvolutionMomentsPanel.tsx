import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Share2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import {
  PROGRESSION_VISUAL_BOUNDARY_LEVELS,
  isTierBoundaryLevel,
} from "@/config/progression";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { CompanionLayoutMode } from "@/hooks/useCompanionLayoutMode";
import { isSupabaseMissingRelationError } from "@/utils/supabaseSchemaErrors";
import { shouldContainCompanionSceneImage } from "@/lib/companionImageFocal";
import { cn } from "@/lib/utils";
import {
  DEFAULT_EVOLUTION_SHARE_TEXT,
  isShareCancelled,
  renderEvolutionShareVideo,
  shareRenderedMedia,
} from "@/utils/shareMedia";

type EvolutionMomentStatus = "queued" | "processing" | "succeeded";

interface EvolutionMoment {
  id: string;
  stage: number;
  image_url: string | null;
  evolved_at: string | null;
  animation_status: EvolutionMomentStatus | null;
  animation_video_url: string | null;
  animation_completed_at: string | null;
}

interface AnimationJobMomentSource {
  id: string;
  evolution_id: string | null;
  stage: number;
  source_image_url: string | null;
  status: EvolutionMomentStatus | string | null;
  video_url: string | null;
  completed_at: string | null;
  requested_at: string | null;
  updated_at: string | null;
}

interface EvolutionMomentsPanelProps {
  layoutMode?: CompanionLayoutMode;
}

const EVOLUTION_MOMENTS_QUERY_KEY = "companion-evolution-moments";
const COMPANION_MOMENT_SOURCE_QUERY_KEY = "companion-moment-source";
const ANIMATABLE_MOMENT_STAGES = [...PROGRESSION_VISUAL_BOUNDARY_LEVELS];

const normalizeMomentStatus = (
  value: unknown,
): EvolutionMomentStatus | null => {
  if (value === "queued" || value === "processing" || value === "succeeded") {
    return value;
  }

  return null;
};

const hasVisibleMomentState = (moment: EvolutionMoment) =>
  moment.animation_status === "queued" ||
  moment.animation_status === "processing" ||
  (moment.animation_status === "succeeded" &&
    Boolean(moment.animation_video_url));

const hasAnimatableMomentStage = (stage: unknown): stage is number =>
  typeof stage === "number" && isTierBoundaryLevel(stage);

const getMomentSortTime = (moment: EvolutionMoment) => {
  const value = moment.animation_completed_at ?? moment.evolved_at;
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const EvolutionMomentsPanel = ({
  layoutMode = "mobile",
}: EvolutionMomentsPanelProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isDesktop = layoutMode === "desktop";

  const { data: momentSource, isLoading: isLoadingMomentSource } = useQuery({
    queryKey: [COMPANION_MOMENT_SOURCE_QUERY_KEY, user?.id],
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("user_companion")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return typeof data?.id === "string"
        ? {
            companionId: data.id,
          }
        : null;
    },
  });
  const companionId = momentSource?.companionId ?? null;

  const { data: evolutionMoments = [], isLoading } = useQuery({
    queryKey: [EVOLUTION_MOMENTS_QUERY_KEY, companionId, user?.id],
    enabled: !!companionId && !!user?.id,
    staleTime: 30 * 1000,
    refetchInterval: (query) => {
      const moments = query.state.data as EvolutionMoment[] | undefined;
      return moments?.some(
        (moment) =>
          moment.animation_status === "queued" ||
          moment.animation_status === "processing",
      )
        ? 5_000
        : false;
    },
    queryFn: async () => {
      if (!companionId || !user?.id) return [];

      const { data, error } = await supabase
        .from("companion_evolutions")
        .select(
          "id, stage, image_url, evolved_at, animation_status, animation_video_url, animation_completed_at",
        )
        .eq("companion_id", companionId)
        .in("animation_status", ["queued", "processing", "succeeded"])
        .in("stage", ANIMATABLE_MOMENT_STAGES)
        .order("evolved_at", { ascending: false })
        .limit(12);

      if (error) throw error;

      const { data: jobData, error: jobError } = await supabase
        .from("companion_animation_jobs")
        .select(
          "id, evolution_id, stage, source_image_url, status, video_url, completed_at, requested_at, updated_at",
        )
        .eq("user_id", user.id)
        .eq("companion_id", companionId)
        .in("status", ["queued", "processing", "succeeded"])
        .in("stage", ANIMATABLE_MOMENT_STAGES)
        .order("requested_at", { ascending: false })
        .limit(12);

      if (
        jobError &&
        !isSupabaseMissingRelationError(jobError, "companion_animation_jobs")
      ) {
        throw jobError;
      }

      const momentsByEvolutionId = new Map<string, EvolutionMoment>();
      const momentsById = new Map<string, EvolutionMoment>();

      ((data ?? []) as EvolutionMoment[]).forEach((row) => {
        if (!hasAnimatableMomentStage(row.stage)) return;

        const status = normalizeMomentStatus(row.animation_status);
        if (!status) return;

        const moment: EvolutionMoment = {
          ...row,
          animation_status: status,
          animation_video_url:
            status === "succeeded" ? row.animation_video_url : null,
        };
        if (!hasVisibleMomentState(moment)) return;

        momentsById.set(moment.id, moment);
        momentsByEvolutionId.set(moment.id, moment);
      });

      if (!jobError) {
        ((jobData ?? []) as AnimationJobMomentSource[]).forEach((job) => {
          if (!hasAnimatableMomentStage(job.stage)) return;

          const status = normalizeMomentStatus(job.status);
          if (!status) return;

          const videoUrl =
            status === "succeeded" && job.video_url ? job.video_url : null;
          const existing = job.evolution_id
            ? momentsByEvolutionId.get(job.evolution_id)
            : null;

          if (existing) {
            const merged: EvolutionMoment = {
              ...existing,
              image_url: existing.image_url ?? job.source_image_url ?? null,
              evolved_at:
                existing.evolved_at ??
                job.requested_at ??
                job.updated_at ??
                null,
              animation_status: videoUrl
                ? "succeeded"
                : existing.animation_status,
              animation_video_url: existing.animation_video_url ?? videoUrl,
              animation_completed_at:
                existing.animation_completed_at ?? job.completed_at ?? null,
            };
            if (!hasVisibleMomentState(merged)) return;

            momentsById.set(merged.id, merged);
            momentsByEvolutionId.set(merged.id, merged);
            return;
          }

          const moment: EvolutionMoment = {
            id: job.evolution_id ?? `job:${job.id}`,
            stage: job.stage,
            image_url: job.source_image_url ?? null,
            evolved_at: job.requested_at ?? job.updated_at ?? null,
            animation_status: status,
            animation_video_url: videoUrl,
            animation_completed_at: job.completed_at ?? null,
          };
          if (!hasVisibleMomentState(moment)) return;

          momentsById.set(moment.id, moment);
          if (job.evolution_id) {
            momentsByEvolutionId.set(job.evolution_id, moment);
          }
        });
      }

      return Array.from(momentsById.values())
        .sort(
          (left, right) => getMomentSortTime(right) - getMomentSortTime(left),
        )
        .slice(0, 12);
    },
  });

  useEffect(() => {
    if (!companionId) return;

    const channel = supabase
      .channel(`companion-evolution-moments-${companionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "companion_evolutions",
          filter: `companion_id=eq.${companionId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: [COMPANION_MOMENT_SOURCE_QUERY_KEY, user?.id],
          });
          queryClient.invalidateQueries({
            queryKey: [EVOLUTION_MOMENTS_QUERY_KEY, companionId],
          });
        },
      )
      .subscribe();

    const jobsChannel = supabase
      .channel(`companion-animation-jobs-${companionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "companion_animation_jobs",
          filter: `companion_id=eq.${companionId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: [EVOLUTION_MOMENTS_QUERY_KEY, companionId],
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(jobsChannel);
    };
  }, [companionId, queryClient, user?.id]);

  const isLoadingMoments = isLoadingMomentSource || isLoading;

  if (isLoadingMoments && evolutionMoments.length === 0) {
    return (
      <section
        aria-label="Evolutions"
        className={`space-y-4 ${isDesktop ? "mt-0" : "mt-6"}`}
      >
        <EvolutionMomentsHeader count={0} />
        <div
          className={`grid gap-3 ${isDesktop ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}
        >
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="aspect-[4/3] rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Evolutions"
      className={`space-y-4 ${isDesktop ? "mt-0" : "mt-6"}`}
    >
      <EvolutionMomentsHeader count={evolutionMoments.length} />

      {evolutionMoments.length > 0 ? (
        <EvolutionMomentsGrid
          isDesktop={isDesktop}
          moments={evolutionMoments}
        />
      ) : (
        <Card className="p-8 text-center">
          <Sparkles className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <h4 className="text-base font-semibold">No Evolutions Yet</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep growing with your companion to unlock the first one.
          </p>
        </Card>
      )}
    </section>
  );
};

const EvolutionMomentsHeader = ({ count }: { count: number }) => (
  <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
    <div className="flex items-center gap-3 mb-2">
      <Sparkles className="h-6 w-6 text-primary" />
      <h3 className="text-lg font-semibold">Evolutions</h3>
    </div>
    <p className="text-sm text-muted-foreground">
      {count} evolution{count === 1 ? "" : "s"} collected
    </p>
  </Card>
);

const EvolutionMomentsGrid = ({
  isDesktop,
  moments,
}: {
  isDesktop: boolean;
  moments: EvolutionMoment[];
}) => {
  const [selectedMoment, setSelectedMoment] = useState<EvolutionMoment | null>(
    null,
  );
  const [videoFailed, setVideoFailed] = useState(false);
  const [sharingMomentId, setSharingMomentId] = useState<string | null>(null);

  useEffect(() => {
    setVideoFailed(false);
  }, [selectedMoment?.id]);

  const handleShareMoment = useCallback(async (moment: EvolutionMoment) => {
    if (!moment.animation_video_url) return;

    setSharingMomentId(moment.id);

    try {
      const renderedVideo = await renderEvolutionShareVideo({
        sourceVideoUrl: moment.animation_video_url,
        posterImageUrl: moment.image_url,
        stage: moment.stage,
        template: "aesthetic-reveal",
      });

      const result = await shareRenderedMedia({
        uriOrFile: renderedVideo,
        title: `Stage ${moment.stage} Evolution`,
        text: DEFAULT_EVOLUTION_SHARE_TEXT,
        dialogTitle: "Share evolution video",
      });

      if (result.status === "cancelled") return;

      const captionText = result.captionCopied ? " Caption copied." : "";
      toast.success(
        result.status === "downloaded"
          ? `Evolution video downloaded.${captionText}`
          : `Evolution video ready to share.${captionText}`,
      );
    } catch (error) {
      if (isShareCancelled(error)) return;
      console.error("Failed to share evolution moment:", error);
      toast.error("Could not prepare this evolution video for sharing.");
    } finally {
      setSharingMomentId(null);
    }
  }, []);

  return (
    <>
      <div
        className={`grid gap-3 ${isDesktop ? "grid-cols-4 xl:grid-cols-5" : "grid-cols-2 sm:grid-cols-3"}`}
      >
        {moments.map((moment) => (
          <EvolutionMomentCard
            key={moment.id}
            moment={moment}
            onSelect={setSelectedMoment}
            onShare={handleShareMoment}
            isSharing={sharingMomentId === moment.id}
          />
        ))}
      </div>

      <Dialog
        open={!!selectedMoment}
        onOpenChange={(open) => {
          if (!open) setSelectedMoment(null);
        }}
      >
        <DialogContent className="max-w-xl rounded-xl p-4">
          <DialogHeader>
            <DialogTitle>Stage {selectedMoment?.stage} Evolution</DialogTitle>
            <DialogDescription>
              {selectedMoment?.animation_completed_at
                ? formatMomentDate(selectedMoment.animation_completed_at)
                : selectedMoment?.evolved_at
                  ? formatMomentDate(selectedMoment.evolved_at)
                  : "Evolution moment"}
            </DialogDescription>
          </DialogHeader>

          {selectedMoment && (
            <div className="overflow-hidden rounded-xl border border-border/70 bg-black">
              {selectedMoment.animation_video_url && !videoFailed ? (
                <video
                  src={selectedMoment.animation_video_url}
                  className="max-h-[70vh] w-full bg-black object-contain"
                  autoPlay
                  muted
                  playsInline
                  poster={selectedMoment.image_url ?? undefined}
                  data-testid="evolution-moment-video"
                  onError={() => setVideoFailed(true)}
                />
              ) : selectedMoment.image_url ? (
                <img
                  src={selectedMoment.image_url}
                  alt={`Evolution still after stage ${selectedMoment.stage}`}
                  className="max-h-[70vh] w-full bg-black object-contain"
                  loading="lazy"
                  decoding="async"
                  data-testid="evolution-moment-fallback-image"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-sm text-muted-foreground">
                  Evolution unavailable
                </div>
              )}
            </div>
          )}

          {selectedMoment?.animation_video_url ? (
            <div className="flex justify-end pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleShareMoment(selectedMoment)}
                disabled={sharingMomentId === selectedMoment.id}
              >
                {sharingMomentId === selectedMoment.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
                Share Evolution
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};

const EvolutionMomentCard = ({
  moment,
  onSelect,
  onShare,
  isSharing,
}: {
  moment: EvolutionMoment;
  onSelect: (moment: EvolutionMoment) => void;
  onShare: (moment: EvolutionMoment) => void;
  isSharing: boolean;
}) => {
  const canPlay =
    moment.animation_status === "succeeded" &&
    Boolean(moment.animation_video_url);
  const usesContainedSceneImage = shouldContainCompanionSceneImage(moment.image_url);

  return (
    <div
      className={`group relative overflow-hidden rounded-lg border transition-all active:scale-95 ${
        canPlay
          ? "border-primary/30 bg-card hover:border-primary/60"
          : "cursor-not-allowed border-border/60 bg-secondary/30 opacity-75"
      }`}
    >
      <button
        type="button"
        disabled={!canPlay}
        onClick={() => onSelect(moment)}
        className="block w-full text-left"
        aria-label={
          canPlay
            ? `Stage ${moment.stage} evolution`
            : `Stage ${moment.stage} evolution generating`
        }
      >
        <div
          className={cn(
            "relative aspect-[4/3] overflow-hidden",
            usesContainedSceneImage ? "bg-black" : "bg-secondary/40",
          )}
        >
          {moment.image_url ? (
            <img
              src={moment.image_url}
              alt=""
              className={cn(
                "h-full w-full",
                usesContainedSceneImage ? "object-contain" : "object-cover",
              )}
              data-companion-image-fit={usesContainedSceneImage ? "contain" : "cover"}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Sparkles className="h-7 w-7 text-muted-foreground/60" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/[0.76] via-black/10 to-transparent" />
          <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
            Stage {moment.stage}
          </span>
        </div>
      </button>

      {canPlay ? (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label={`Share evolution for stage ${moment.stage}`}
          className="absolute right-2 top-2 h-8 w-8 border border-white/20 bg-background/70 text-foreground shadow-sm backdrop-blur hover:bg-background/85"
          onClick={(event) => {
            event.stopPropagation();
            onShare(moment);
          }}
          disabled={isSharing}
        >
          {isSharing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
        </Button>
      ) : null}
    </div>
  );
};

const formatMomentDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Evolution moment";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};
