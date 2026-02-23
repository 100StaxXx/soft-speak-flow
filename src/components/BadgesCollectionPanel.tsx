import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { Award, Lock } from "lucide-react";
import { BADGE_CATALOG, BadgeCategory, CATEGORY_LABELS, TIER_COLORS, BadgeDefinition } from "@/data/badgeCatalog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type FilterCategory = 'all' | BadgeCategory;

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

export const BadgesCollectionPanel = () => {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [selectedBadge, setSelectedBadge] = useState<{ badge: BadgeDefinition; earned: boolean } | null>(null);

  const { data: earnedAchievements, isLoading } = useQuery({
    queryKey: ["achievements", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("achievements")
        .select("achievement_type, earned_at")
        .eq("user_id", user.id);
      if (error) throw error;
      return data || [];
    },
  });

  const earnedTypes = useMemo(() => {
    return new Set(earnedAchievements?.map(a => a.achievement_type) || []);
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

  const filterCategories: FilterCategory[] = ['all', 'streaks', 'companion', 'starpaths', 'firsts', 'special'];

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
    <div className="space-y-6 mt-6">
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
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
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
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
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
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
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
