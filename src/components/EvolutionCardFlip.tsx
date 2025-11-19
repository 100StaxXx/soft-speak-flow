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
      className="relative h-[280px] cursor-pointer perspective-1000"
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
            <div className="h-full rounded-lg bg-card relative overflow-hidden">
              {/* Background Image */}
              {card.image_url ? (
                <img 
                  src={card.image_url} 
                  alt={card.creature_name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center text-muted-foreground text-xs">
                  No Image
                </div>
              )}
              
              {/* Overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              
              {/* Stage Badge */}
              <Badge className="absolute top-2 right-2 bg-background/90 backdrop-blur-sm text-xs">
                Stage {card.evolution_stage}
              </Badge>

              {/* Bottom Info */}
              <div className="absolute bottom-0 left-0 right-0 p-3 space-y-2">
                <h3 className="font-bold text-sm text-white drop-shadow-lg">{card.creature_name}</h3>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-1 text-xs bg-black/40 backdrop-blur-sm rounded-lg p-2">
                  <div className="flex justify-between text-white/90">
                    <span>⚡</span>
                    <span className="font-semibold">{stats.power || 0}</span>
                  </div>
                  <div className="flex justify-between text-white/90">
                    <span>🛡️</span>
                    <span className="font-semibold">{stats.defense || 0}</span>
                  </div>
                  <div className="flex justify-between text-white/90">
                    <span>💨</span>
                    <span className="font-semibold">{stats.speed || 0}</span>
                  </div>
                  <div className="flex justify-between text-white/90">
                    <span>🧠</span>
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
            <div className="h-full rounded-lg bg-card p-4 flex flex-col overflow-hidden">
              <div className="space-y-2 flex-1 overflow-y-auto">
                {/* Full Name & Title */}
                <div className="text-center pb-2 border-b border-border">
                  <h3 className="font-bold text-sm">{card.creature_name}</h3>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">
                    {card.species} of {card.element}
                  </p>
                </div>

                {/* Traits */}
                {card.traits && card.traits.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold mb-1.5 text-primary">Traits</h4>
                    <div className="flex flex-wrap gap-1">
                      {card.traits.map((trait, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs px-1.5 py-0">
                          {trait}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Story/Lore */}
                <div>
                  <h4 className="text-xs font-semibold mb-1.5 text-primary">Lore</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-6">
                    {card.story_text}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center pt-2 mt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">Stage {card.evolution_stage}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
