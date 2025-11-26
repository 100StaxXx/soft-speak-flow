import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Lock, Check } from "lucide-react";
import { useReferrals } from "@/hooks/useReferrals";
import { cn } from "@/lib/utils";

export const CompanionSkins = () => {
  const { availableSkins, unlockedSkins, equipSkin, unequipSkin, referralStats } = useReferrals();

  const isUnlocked = (skinId: string) => {
    return unlockedSkins?.some(us => us.skin_id === skinId);
  };

  const isEquipped = (skinId: string) => {
    return unlockedSkins?.some(us => us.skin_id === skinId && us.is_equipped);
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'text-yellow-500 border-yellow-500/50';
      case 'epic': return 'text-purple-500 border-purple-500/50';
      case 'rare': return 'text-blue-500 border-blue-500/50';
      default: return 'text-gray-500 border-gray-500/50';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Companion Skins
        </h3>
        <div className="text-sm text-muted-foreground">
          {unlockedSkins?.length || 0} / {availableSkins?.length || 0} Unlocked
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {availableSkins?.map((skin) => {
          const unlocked = isUnlocked(skin.id);
          const equipped = isEquipped(skin.id);
          const referralCount = referralStats?.referral_count || 0;
          const progress = Math.min(referralCount, skin.unlock_requirement || 0);

          return (
            <Card
              key={skin.id}
              className={cn(
                "p-4 space-y-3 transition-all",
                unlocked ? "border-primary/50" : "opacity-60",
                equipped && "ring-2 ring-primary"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h4 className="font-semibold">{skin.name}</h4>
                  <Badge variant="outline" className={getRarityColor(skin.rarity)}>
                    {skin.rarity}
                  </Badge>
                </div>
                {equipped && (
                  <Check className="h-5 w-5 text-primary" />
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                {skin.description}
              </p>

              {unlocked ? (
                <Button
                  size="sm"
                  variant={equipped ? "outline" : "default"}
                  className="w-full"
                  onClick={() => {
                    if (equipped) {
                      unequipSkin.mutate();
                    } else {
                      equipSkin.mutate(skin.id);
                    }
                  }}
                >
                  {equipped ? "Unequip" : "Equip"}
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Lock className="h-4 w-4" />
                    <span>
                      Refer {skin.unlock_requirement} friend{skin.unlock_requirement! > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{
                        width: `${(progress / (skin.unlock_requirement || 1)) * 100}%`
                      }}
                    />
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    {progress} / {skin.unlock_requirement}
                  </p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
