import { useState } from "react";
import { motion } from "framer-motion";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { Badge } from "./ui/badge";

interface EvolutionCard {
  id: string;
  creature_name: string;
  evolution_stage: number;
  image_url: string | null;
  rarity: string;
  stats: any;
  story_text: string;
  traits: string[] | null;
  element: string;
  species: string;
}

interface Props {
  card: EvolutionCard;
}

const RARITY_COLORS: Record<string, string> = {
  common: "from-gray-400 to-gray-600",
  uncommon: "from-green-400 to-green-600",
  rare: "from-blue-400 to-blue-600",
  epic: "from-purple-400 to-purple-600",
  legendary: "from-amber-400 to-amber-600",
};

export function EvolutionCardFlip({ card }: Props) {
  const [isFlipped, setIsFlipped] = useState(false);
  const { tap } = useHapticFeedback();

  const stats = card.stats as { power?: number; defense?: number; speed?: number; wisdom?: number };

  const handleFlip = () => {
    tap();
    setIsFlipped(!isFlipped);
  };

  return (
    <div 
      className="relative h-[420px] cursor-pointer perspective-1000"
      onClick={handleFlip}
    >
      <motion.div
        className="relative w-full h-full preserve-3d"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring" }}
      >
        {/* Front */}
        <div className="absolute w-full h-full backface-hidden">
          <div className={`h-full rounded-xl border-2 bg-gradient-to-br ${RARITY_COLORS[card.rarity]} p-[2px] shadow-lg`}>
            <div className="h-full rounded-lg bg-card flex flex-col overflow-hidden">
              {/* Image */}
              <div className="relative h-[260px] bg-muted overflow-hidden">
                {card.image_url ? (
                  <img 
                    src={card.image_url} 
                    alt={card.creature_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    No Image
                  </div>
                )}
                <Badge className="absolute top-2 right-2 bg-background/80 backdrop-blur">
                  Stage {card.evolution_stage}
                </Badge>
              </div>

              {/* Info */}
              <div className="flex-1 p-4 space-y-3">
                <div>
                  <h3 className="font-bold text-lg truncate">{card.creature_name}</h3>
                  <p className="text-sm text-muted-foreground capitalize">{card.species} • {card.element}</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Power</span>
                    <span className="font-semibold">{stats.power || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Defense</span>
                    <span className="font-semibold">{stats.defense || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Speed</span>
                    <span className="font-semibold">{stats.speed || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Wisdom</span>
                    <span className="font-semibold">{stats.wisdom || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Back */}
        <div className="absolute w-full h-full backface-hidden rotate-y-180">
          <div className={`h-full rounded-xl border-2 bg-gradient-to-br ${RARITY_COLORS[card.rarity]} p-[2px] shadow-lg`}>
            <div className="h-full rounded-lg bg-card p-4 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">{card.creature_name}</h3>
                <Badge variant="outline" className="capitalize">{card.rarity}</Badge>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-2">Lore</h4>
                  <p className="text-sm leading-relaxed">{card.story_text}</p>
                </div>

                {card.traits && card.traits.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">Traits</h4>
                    <div className="flex flex-wrap gap-2">
                      {card.traits.map((trait, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {trait}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t space-y-1 text-xs text-muted-foreground">
                  <p>Element: <span className="text-foreground capitalize">{card.element}</span></p>
                  <p>Species: <span className="text-foreground capitalize">{card.species}</span></p>
                  <p>Stage: <span className="text-foreground">{card.evolution_stage}</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
