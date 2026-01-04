import { useState, memo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Lock, Check, ChevronDown } from "lucide-react";
import { useReferrals } from "@/hooks/useReferrals";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export const CompanionSkins = memo(() => {
  const { availableSkins, unlockedSkins, equipSkin, unequipSkin, referralStats } = useReferrals();
  const [isOpen, setIsOpen] = useState(false);

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
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-4 hover:bg-accent/5 transition-colors">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Companion Skins</h3>
              <Badge variant="secondary">
                {unlockedSkins?.length || 0} / {availableSkins?.length || 0}
              </Badge>
            </div>
            <ChevronDown className={cn(
              "h-5 w-5 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )} />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 pt-0 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                      Refer {skin.unlock_requirement ?? 0} friend{(skin.unlock_requirement ?? 0) > 1 ? 's' : ''}
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
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
});
CompanionSkins.displayName = 'CompanionSkins';
