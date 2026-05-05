import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { Award, Clock3, Lock, Play, Sparkles } from "lucide-react";
import { BADGE_CATALOG, BadgeCategory, CATEGORY_LABELS, TIER_COLORS, BadgeDefinition } from "@/data/badgeCatalog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import type { CompanionLayoutMode } from "@/hooks/useCompanionLayoutMode";
import { normalizeAchievementType } from "@/lib/achievementTypes";
import { isSupabaseMissingRelationError } from "@/utils/supabaseSchemaErrors";

type FilterCategory = 'all' | BadgeCategory;
type ReplayStatus = "queued" | "processing" | "succeeded";

interface EvolutionReplay {
  id: string;
  stage: number;
  image_url: string | null;
  evolved_at: string | null;
  animation_status: ReplayStatus | null;
  animation_video_url: string | null;
  animation_completed_at: string | null;
}

const EVOLUTION_REPLAYS_QUERY_KEY = "companion-evolution-replays";
const COMPANION_REPLAY_SOURCE_QUERY_KEY = "companion-replay-source";

const badgePreviewModules = import.meta.glob("/src/assets/badges/*.webp", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const badgePreviewLocalUrls = Object.fromEntries(
  Object.entries(badgePreviewModules).map(([modulePath, moduleUrl]) => {
    const filename = modulePath.split("/").pop() || "";
    const badgeId = filename.replace(/\.webp$/i, "");
    return [badgeId, moduleUrl];
  }),
) as Record<string, string>;

interface BadgesCollectionPanelProps {
  layoutMode?: CompanionLayoutMode;
}

export const BadgesCollectionPanel = ({ layoutMode = "mobile" }: BadgesCollectionPanelProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [selectedBadge, setSelectedBadge] = useState<{ badge: BadgeDefinition; earned: boolean } | null>(null);
  const isDesktop = layoutMode === "desktop";
  const showEvolutionReplays = activeFilter === "all" || activeFilter === "companion";

  const { data: earnedAchievements, isLoading } = useQuery({
    queryKey: ["achievements", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("achievements")
        .select("achievement_type, earned_at")
        .eq("user_id", user.id);
      if (isSupabaseMissingRelationError(error, "achievements")) {
        return [];
      }
      if (error) throw error;
      return data || [];
    },
  });

  const earnedTypes = useMemo(() => {
    return new Set(
      (earnedAchievements ?? [])
        .map((achievement) => normalizeAchievementType(achievement.achievement_type))
        .filter(Boolean),
    );
  }, [earnedAchievements]);

  const filteredBadges = useMemo(() => {
    if (activeFilter === 'all') return BADGE_CATALOG;
    return BADGE_CATALOG.filter(b => b.category === activeFilter);
  }, [activeFilter]);

  const earnedBadges = useMemo(() => {
    return filteredBadges.filter(b => earnedTypes.has(b.achievementType));
  }, [filteredBadges, earnedTypes]);

  const lockedBadges = useMemo(() => {
    return filteredBadges.filter(b => !earnedTypes.has(b.achievementType));
  }, [filteredBadges, earnedTypes]);

  const totalEarned = BADGE_CATALOG.filter(b => earnedTypes.has(b.achievementType)).length;
  const totalAvailable = BADGE_CATALOG.length;

  const { data: replaySource } = useQuery({
    queryKey: [COMPANION_REPLAY_SOURCE_QUERY_KEY, user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("user_companion")
        .select("id, current_stage")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return typeof data?.id === "string"
        ? {
          companionId: data.id,
          currentStage: typeof data.current_stage === "number" ? data.current_stage : 0,
        }
        : null;
    },
  });
  const companionId = replaySource?.companionId ?? null;
  const replayCurrentStage = replaySource?.currentStage ?? 0;

  const { data: evolutionReplays = [], isLoading: isLoadingEvolutionReplays } = useQuery({
    queryKey: [EVOLUTION_REPLAYS_QUERY_KEY, companionId, replayCurrentStage],
    enabled: !!companionId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      if (!companionId) return [];

      const { data, error } = await supabase
        .from("companion_evolutions")
        .select("id, stage, image_url, evolved_at, animation_status, animation_video_url, animation_completed_at")
        .eq("companion_id", companionId)
        .lte("stage", replayCurrentStage)
        .in("animation_status", ["queued", "processing", "succeeded"])
        .order("evolved_at", { ascending: false })
        .limit(12);

      if (error) throw error;

      return (data ?? []).filter((row) => (
        row.animation_status === "queued"
        || row.animation_status === "processing"
        || (row.animation_status === "succeeded" && Boolean(row.animation_video_url))
      )) as EvolutionReplay[];
    },
  });

  useEffect(() => {
    if (!companionId) return;

    const channel = supabase
      .channel(`companion-evolution-replays-${companionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "companion_evolutions",
          filter: `companion_id=eq.${companionId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: [EVOLUTION_REPLAYS_QUERY_KEY, companionId] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companionId, queryClient]);

  const filterCategories: FilterCategory[] = [
    'all',
    'streaks',
    'companion',
    'starpaths',
    'challenges',
    'firsts',
    'special',
    'astral',
  ];

  if (isLoading) {
    return (
      <div className="space-y-4 mt-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${isDesktop ? "mt-0" : "mt-6"}`}>
      {/* Header Stats */}
      <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
        <div className="flex items-center gap-3 mb-2">
          <Award className="h-6 w-6 text-primary" />
          <h3 className="text-lg font-semibold">Your Badges</h3>
        </div>
        <p className="text-2xl font-bold">
          <span className="text-primary">{totalEarned}</span>
          <span className="text-muted-foreground text-lg font-normal"> / {totalAvailable} collected</span>
        </p>
      </Card>

      {/* Filter Tabs */}
      <div className={`flex gap-2 pb-2 ${isDesktop ? "flex-wrap overflow-visible" : "overflow-x-auto scrollbar-hide"}`}>
        {filterCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeFilter === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
            }`}
          >
            {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {showEvolutionReplays && (
        <EvolutionReplayStrip
          isDesktop={isDesktop}
          isLoading={isLoadingEvolutionReplays}
          replays={evolutionReplays}
        />
      )}

      {/* Earned Badges */}
      {earnedBadges.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <span className="text-primary">✨</span> EARNED ({earnedBadges.length})
          </h4>
          <div className={`grid gap-3 ${isDesktop ? "grid-cols-4 xl:grid-cols-5" : "grid-cols-3 sm:grid-cols-4"}`}>
            {earnedBadges.map((badge) => (
              <BadgeCard key={badge.id} badge={badge} earned onSelect={(b) => setSelectedBadge({ badge: b, earned: true })} />
            ))}
          </div>
        </div>
      )}

      {/* Locked Badges */}
      {lockedBadges.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Lock className="h-4 w-4" /> LOCKED ({lockedBadges.length})
          </h4>
          <div className={`grid gap-3 ${isDesktop ? "grid-cols-4 xl:grid-cols-5" : "grid-cols-3 sm:grid-cols-4"}`}>
            {lockedBadges.map((badge) => (
              <BadgeCard key={badge.id} badge={badge} earned={false} onSelect={(b) => setSelectedBadge({ badge: b, earned: false })} />
            ))}
          </div>
        </div>
      )}

      {filteredBadges.length === 0 && (
        <Card className="p-8 text-center">
          <Award className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground">No badges in this category yet</p>
        </Card>
      )}

      {/* Badge Detail Dialog */}
      <Dialog open={!!selectedBadge} onOpenChange={() => setSelectedBadge(null)}>
        <DialogContent className="max-w-[300px] rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-center">
              {selectedBadge?.earned ? selectedBadge.badge.title : 'Locked Badge'}
            </DialogTitle>
          </DialogHeader>
          {selectedBadge && (
            <div className="text-center space-y-4 py-2">
              <div className={`text-6xl ${selectedBadge.earned ? '' : 'grayscale'}`}>
                {selectedBadge.earned ? (
                  <BadgePreview badge={selectedBadge.badge} className="h-16 w-16 rounded-xl mx-auto" />
                ) : (
                  "🔒"
                )}
              </div>
              {selectedBadge.earned ? (
                <>
                  <p className="text-muted-foreground">{selectedBadge.badge.description}</p>
                  <Badge 
                    className={`capitalize bg-gradient-to-br ${TIER_COLORS[selectedBadge.badge.tier]} text-white border-0`}
                  >
                    {selectedBadge.badge.tier}
                  </Badge>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">How to unlock:</p>
                  <p className="text-muted-foreground">{selectedBadge.badge.unlockHint}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const EvolutionReplayStrip = ({
  isDesktop,
  isLoading,
  replays,
}: {
  isDesktop: boolean;
  isLoading: boolean;
  replays: EvolutionReplay[];
}) => {
  const [selectedReplay, setSelectedReplay] = useState<EvolutionReplay | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    setVideoFailed(false);
  }, [selectedReplay?.id]);

  if (isLoading && replays.length === 0) {
    return (
      <section aria-label="Evolution replays" className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-muted-foreground">Evolution Replays</h4>
        </div>
        <div className={`grid gap-3 ${isDesktop ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="aspect-[4/3] rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  if (replays.length === 0) {
    return null;
  }

  return (
    <section aria-label="Evolution replays" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-muted-foreground">Evolution Replays</h4>
        </div>
        <span className="text-xs font-medium text-muted-foreground">{replays.length}</span>
      </div>

      <div className={`grid gap-3 ${isDesktop ? "grid-cols-4 xl:grid-cols-5" : "grid-cols-2 sm:grid-cols-3"}`}>
        {replays.map((replay) => (
          <EvolutionReplayCard
            key={replay.id}
            replay={replay}
            onSelect={setSelectedReplay}
          />
        ))}
      </div>

      <Dialog
        open={!!selectedReplay}
        onOpenChange={(open) => {
          if (!open) setSelectedReplay(null);
        }}
      >
        <DialogContent className="max-w-xl rounded-xl p-4">
          <DialogHeader>
            <DialogTitle>Stage {selectedReplay?.stage} Replay</DialogTitle>
            <DialogDescription>
              {selectedReplay?.animation_completed_at
                ? formatReplayDate(selectedReplay.animation_completed_at)
                : selectedReplay?.evolved_at
                  ? formatReplayDate(selectedReplay.evolved_at)
                  : "Evolution moment"}
            </DialogDescription>
          </DialogHeader>

          {selectedReplay && (
            <div className="overflow-hidden rounded-xl border border-border/70 bg-black">
              {selectedReplay.animation_video_url && !videoFailed ? (
                <video
                  src={selectedReplay.animation_video_url}
                  className="max-h-[70vh] w-full bg-black object-contain"
                  controls
                  autoPlay
                  muted
                  playsInline
                  poster={selectedReplay.image_url ?? undefined}
                  data-testid="evolution-replay-video"
                  onError={() => setVideoFailed(true)}
                />
              ) : selectedReplay.image_url ? (
                <img
                  src={selectedReplay.image_url}
                  alt={`Evolution still after stage ${selectedReplay.stage}`}
                  className="max-h-[70vh] w-full bg-black object-contain"
                  loading="lazy"
                  decoding="async"
                  data-testid="evolution-replay-fallback-image"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-sm text-muted-foreground">
                  Replay unavailable
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

const EvolutionReplayCard = ({
  replay,
  onSelect,
}: {
  replay: EvolutionReplay;
  onSelect: (replay: EvolutionReplay) => void;
}) => {
  const canPlay = replay.animation_status === "succeeded" && Boolean(replay.animation_video_url);

  return (
    <button
      type="button"
      disabled={!canPlay}
      onClick={() => onSelect(replay)}
      className={`group relative overflow-hidden rounded-lg border text-left transition-all active:scale-95 ${
        canPlay
          ? "border-primary/30 bg-card hover:border-primary/60"
          : "cursor-not-allowed border-border/60 bg-secondary/30 opacity-75"
      }`}
      aria-label={canPlay ? `Replay stage ${replay.stage} evolution` : `Stage ${replay.stage} evolution generating`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary/40">
        {replay.image_url ? (
          <img
            src={replay.image_url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Sparkles className="h-7 w-7 text-muted-foreground/60" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/76 via-black/10 to-transparent" />
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
          Stage {replay.stage}
        </span>
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
          {canPlay ? <Play className="h-3 w-3 fill-current" /> : <Clock3 className="h-3 w-3" />}
          {canPlay ? "Replay" : "Generating"}
        </span>
      </div>
    </button>
  );
};

const formatReplayDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Evolution moment";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

interface BadgeCardProps {
  badge: BadgeDefinition;
  earned: boolean;
  onSelect: (badge: BadgeDefinition) => void;
}

const BadgeCard = ({ badge, earned, onSelect }: BadgeCardProps) => {
  const tierGradient = TIER_COLORS[badge.tier];

  return (
    <Card
      onClick={() => onSelect(badge)}
      className={`relative p-3 text-center transition-all cursor-pointer active:scale-95 ${
        earned
          ? 'bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30 hover:border-primary/50'
          : 'bg-secondary/30 border-border/50 opacity-60 hover:opacity-80'
      }`}
    >
      {/* Badge Icon */}
      <div className={`text-3xl mb-2 ${earned ? '' : 'grayscale'}`}>
        {earned ? (
          <BadgePreview badge={badge} className="h-10 w-10 rounded-lg mx-auto" />
        ) : (
          "🔒"
        )}
      </div>

      {/* Badge Title */}
      <p className={`text-xs font-medium line-clamp-2 ${earned ? 'text-foreground' : 'text-muted-foreground'}`}>
        {earned ? badge.title : '???'}
      </p>

      {/* Tier Indicator */}
      {earned && (
        <div className={`absolute top-1 right-1 w-2 h-2 rounded-full bg-gradient-to-br ${tierGradient}`} />
      )}
    </Card>
  );
};

const BadgePreview = ({ badge, className }: { badge: BadgeDefinition; className?: string }) => {
  const previewUrl = badgePreviewLocalUrls[badge.id] || badge.image_url || null;

  if (previewUrl) {
    return (
      <img
        src={previewUrl}
        alt={badge.title}
        className={className}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return <span className={`inline-flex items-center justify-center ${className ?? ""}`}>{badge.icon}</span>;
};
