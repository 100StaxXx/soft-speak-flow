import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { Award, Lock } from "lucide-react";
import { BADGE_CATALOG, BadgeCategory, CATEGORY_LABELS, BadgeDefinition } from "@/data/badgeCatalog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import type { CompanionLayoutMode } from "@/hooks/useCompanionLayoutMode";
import { normalizeAchievementType } from "@/lib/achievementTypes";
import { isSupabaseMissingRelationError } from "@/utils/supabaseSchemaErrors";

type FilterCategory = 'all' | BadgeCategory;

interface BadgesCollectionPanelProps {
  layoutMode?: CompanionLayoutMode;
}

export const BadgesCollectionPanel = ({ layoutMode = "mobile" }: BadgesCollectionPanelProps) => {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [selectedBadge, setSelectedBadge] = useState<{ badge: BadgeDefinition; earned: boolean } | null>(null);
  const isDesktop = layoutMode === "desktop";

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
      <Card className="p-5 bg-black/20 border-white/10">
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
        <DialogContent className="max-w-[340px] rounded-2xl border-white/10 bg-[#141c22]/95 font-body backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-center">
              {selectedBadge?.earned ? selectedBadge.badge.title : 'Locked Badge'}
            </DialogTitle>
          </DialogHeader>
          {selectedBadge && (
            <div className="text-center space-y-4 py-2">
              <div className={`text-6xl ${selectedBadge.earned ? '' : 'grayscale'}`}>
                {selectedBadge.earned ? (
                  <BadgePreview badge={selectedBadge.badge} className="h-40 w-40 rounded-2xl mx-auto object-contain" />
                ) : (
                  "🔒"
                )}
              </div>
              {selectedBadge.earned ? (
                <>
                  <p className="text-muted-foreground">{selectedBadge.badge.description}</p>
                  <Badge 
                    className="capitalize bg-white/5 text-muted-foreground border-white/10"
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

interface BadgeCardProps {
  badge: BadgeDefinition;
  earned: boolean;
  onSelect: (badge: BadgeDefinition) => void;
}

const BadgeCard = ({ badge, earned, onSelect }: BadgeCardProps) => {
  return (
    <button
      type="button"
      aria-label={earned ? `${badge.title}, ${badge.tier}` : `Locked badge: ${badge.unlockHint}`}
      onClick={() => onSelect(badge)}
      className={`relative rounded-xl border p-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        earned
          ? 'bg-black/20 border-white/10 hover:bg-white/5'
          : 'bg-black/10 border-white/5 text-muted-foreground hover:bg-white/5'
      }`}
    >
      {/* Badge Icon */}
      <div className={`text-3xl mb-2 ${earned ? '' : 'grayscale'}`}>
        {earned ? (
          <BadgePreview badge={badge} className="h-20 w-20 max-w-full rounded-xl mx-auto object-contain" />
        ) : (
          <Lock className="h-12 w-12 mx-auto my-4 opacity-40" aria-hidden="true" />
        )}
      </div>

      {/* Badge Title */}
      <p className={`text-xs font-medium line-clamp-2 ${earned ? 'text-foreground' : 'text-muted-foreground'}`}>
        {earned ? badge.title : '???'}
      </p>

      {/* Tier Indicator */}
      {earned && (
        <span className="mt-1 block text-[10px] capitalize text-muted-foreground">{badge.tier}</span>
      )}
    </button>
  );
};

const BadgePreview = ({ badge, className }: { badge: BadgeDefinition; className?: string }) => {
  const [failed, setFailed] = useState(false);
  const previewUrl = badge.image_url || null;

  if (previewUrl && !failed) {
    return (
      <img
        src={previewUrl}
        alt={badge.title}
        className={className}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }

  return <span className={`inline-flex items-center justify-center ${className ?? ""}`}><Award aria-label={badge.title} className="h-8 w-8 text-muted-foreground" /></span>;
};
