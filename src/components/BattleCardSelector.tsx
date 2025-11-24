import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

interface BattleCard {
  id: string;
  card_id: string;
  evolution_stage: number;
  creature_name: string;
  element: string;
  stats: any;
  rarity: string;
  image_url: string | null;
}

interface BattleCardSelectorProps {
  cards: BattleCard[];
  selectedCards: string[];
  onCardSelect: (cardId: string) => void;
}

const ENERGY_COSTS: Record<number, number> = {
  0: 1,
  5: 2,
  10: 3,
  15: 4,
  20: 5,
};

const RARITY_COLORS: Record<string, string> = {
  common: "bg-gray-500",
  uncommon: "bg-green-500",
  rare: "bg-blue-500",
  epic: "bg-purple-500",
  legendary: "bg-orange-500",
};

export const BattleCardSelector = ({
  cards,
  selectedCards,
  onCardSelect,
}: BattleCardSelectorProps) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card) => {
        const isSelected = selectedCards.includes(card.id);
        const energyCost = ENERGY_COSTS[card.evolution_stage] || 1;

        return (
          <button
            key={card.id}
            onClick={() => onCardSelect(card.id)}
            className={`relative transition-all ${
              isSelected
                ? "ring-2 ring-primary scale-[1.02]"
                : "hover:scale-[1.02] opacity-80 hover:opacity-100"
            }`}
          >
            <Card className="overflow-hidden">
              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 bg-primary rounded-full p-1">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              )}

              {/* Card Image */}
              <div className="aspect-square bg-gradient-to-br from-accent/20 to-primary/10 relative">
                {card.image_url ? (
                  <img
                    src={card.image_url}
                    alt={card.creature_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">
                    🐉
                  </div>
                )}
                
                {/* Energy Cost Badge */}
                <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-bold text-white border border-primary/50">
                  ⚡{energyCost}
                </div>
              </div>

              {/* Card Info */}
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold text-sm truncate">
                    {card.creature_name}
                  </h4>
                  <Badge
                    variant="secondary"
                    className={`${RARITY_COLORS[card.rarity] || "bg-gray-500"} text-white text-xs`}
                  >
                    S{card.evolution_stage}
                  </Badge>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-1 text-xs">
                  <div className="text-center">
                    <div className="text-muted-foreground">🧠</div>
                    <div className="font-bold">{card.stats?.mind || 10}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground">💪</div>
                    <div className="font-bold">{card.stats?.body || 10}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground">🔥</div>
                    <div className="font-bold">{card.stats?.soul || 50}</div>
                  </div>
                </div>
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
};
