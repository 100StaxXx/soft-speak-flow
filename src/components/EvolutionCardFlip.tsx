import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { X } from "lucide-react";

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
  Common: "from-gray-400 to-gray-600",
  Rare: "from-blue-400 to-blue-600",
  Epic: "from-purple-400 to-purple-600",
  Legendary: "from-amber-400 to-amber-600",
  Mythic: "from-pink-500 to-rose-600",
  Celestial: "from-cyan-400 to-blue-500",
  Primal: "from-emerald-400 to-teal-600",
  Origin: "from-violet-500 to-fuchsia-600",
};

const ELEMENT_SYMBOLS: Record<string, string> = {
  fire: "🔥",
  water: "💧",
  earth: "🪨",
  air: "💨",
  lightning: "⚡",
  ice: "❄️",
  nature: "🌿",
  shadow: "🌑",
  light: "✨",
};

export function EvolutionCardFlip({ card }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const { tap } = useHapticFeedback();

  const stats = card.stats as { mind?: number; body?: number; soul?: number };

  const handleCardClick = () => {
    tap();
    setIsOpen(true);
    setIsFlipped(false);
  };

  const handleFlip = (e: React.MouseEvent) => {
    e.stopPropagation();
    tap();
    setIsFlipped(!isFlipped);
  };

  return (
    <>
      {/* Small Card Preview */}
      <div 
        className="relative h-[280px] cursor-pointer rounded-xl overflow-hidden"
        onClick={handleCardClick}
      >
        <div className={`h-full rounded-xl border-2 bg-gradient-to-br ${RARITY_COLORS[card.rarity]} p-[2px] shadow-lg`}>
          <div className="h-full rounded-lg bg-card relative overflow-hidden">
            {card.image_url ? (
              <img
                src={card.image_url}
                alt={card.creature_name}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center text-muted-foreground text-xs">
                No Image
              </div>
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            
            <Badge className="absolute top-2 left-2 bg-background/90 backdrop-blur-sm text-xs">
              {ELEMENT_SYMBOLS[card.element.toLowerCase()] || "✨"}
            </Badge>
            
            <Badge className="absolute top-2 right-2 bg-background/90 backdrop-blur-sm text-xs">
              Stage {card.evolution_stage}
            </Badge>

            <div className="absolute bottom-0 left-0 right-0 p-3 space-y-2">
              <h3 className="font-bold text-sm text-white drop-shadow-lg">{card.creature_name}</h3>
              
              <div className="grid grid-cols-3 gap-1 text-xs bg-black/40 backdrop-blur-sm rounded-lg p-2">
                <div className="flex flex-col items-center text-white/90">
                  <span>🧠</span>
                  <span className="font-semibold">{stats.mind || 0}</span>
                </div>
                <div className="flex flex-col items-center text-white/90">
                  <span>💪</span>
                  <span className="font-semibold">{stats.body || 0}</span>
                </div>
                <div className="flex flex-col items-center text-white/90">
                  <span>🔥</span>
                  <span className="font-semibold">{stats.soul || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Modal with Flip */}
      <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setIsFlipped(false);
      }}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-transparent border-0 overflow-hidden" aria-describedby="evolution-card-description">
          <DialogTitle className="sr-only">{card.creature_name} - Evolution Card</DialogTitle>
          <span id="evolution-card-description" className="sr-only">
            Detailed view of {card.creature_name}, a {card.rarity} {card.element} {card.species} at evolution stage {card.evolution_stage}
          </span>
          <div className="relative w-full h-[80vh] flex items-center justify-center">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div 
              className="relative w-full max-w-md h-[600px] cursor-pointer perspective-1000"
              onClick={handleFlip}
            >
              <motion.div
                className="relative w-full h-full preserve-3d"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, type: "spring" }}
              >
                {/* Front */}
                <div className="absolute w-full h-full backface-hidden">
                  <div className={`h-full rounded-2xl border-4 bg-gradient-to-br ${RARITY_COLORS[card.rarity]} p-1 shadow-2xl`}>
                    <div className="h-full rounded-xl bg-card relative overflow-hidden">
                      {card.image_url ? (
                        <img
                          src={card.image_url}
                          alt={card.creature_name}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
                          No Image
                        </div>
                      )}
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                      
                      <Badge className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm text-base px-3 py-1">
                        {ELEMENT_SYMBOLS[card.element.toLowerCase()] || "✨"} {card.element}
                      </Badge>
                      
                      <Badge className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm text-base px-3 py-1">
                        Stage {card.evolution_stage}
                      </Badge>

                      <div className="absolute bottom-0 left-0 right-0 p-6 space-y-4">
                        <h3 className="font-bold text-2xl text-white drop-shadow-lg">{card.creature_name}</h3>
                        
                        <div className="grid grid-cols-3 gap-3 text-base bg-black/50 backdrop-blur-sm rounded-xl p-4">
                          <div className="flex flex-col items-center text-white">
                            <span className="text-2xl mb-1">🧠</span>
                            <span className="text-xs opacity-80">Mind</span>
                            <span className="font-bold text-lg">{stats.mind || 0}</span>
                          </div>
                          <div className="flex flex-col items-center text-white">
                            <span className="text-2xl mb-1">💪</span>
                            <span className="text-xs opacity-80">Body</span>
                            <span className="font-bold text-lg">{stats.body || 0}</span>
                          </div>
                          <div className="flex flex-col items-center text-white">
                            <span className="text-2xl mb-1">🔥</span>
                            <span className="text-xs opacity-80">Soul</span>
                            <span className="font-bold text-lg">{stats.soul || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Back */}
                <div className="absolute w-full h-full backface-hidden rotate-y-180">
                  <div className={`h-full rounded-2xl border-4 bg-gradient-to-br ${RARITY_COLORS[card.rarity]} p-1 shadow-2xl`}>
                    <div className="h-full rounded-xl bg-card p-6 flex flex-col overflow-hidden">
                      <div className="space-y-4 flex-1 overflow-y-auto">
                        <div className="text-center pb-4 border-b border-border">
                          <h3 className="font-bold text-xl">{card.creature_name}</h3>
                          <p className="text-sm text-muted-foreground capitalize mt-1">
                            {card.species} of {card.element}
                          </p>
                        </div>

                        {card.traits && card.traits.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2 text-primary">Traits</h4>
                            <div className="flex flex-wrap gap-2">
                              {card.traits.map((trait, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {trait}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <h4 className="text-sm font-semibold mb-2 text-primary">Lore</h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {card.story_text}
                          </p>
                        </div>
                      </div>

                      <div className="text-center pt-4 mt-4 border-t border-border">
                        <p className="text-sm text-muted-foreground">Stage {card.evolution_stage} • Rarity: {card.rarity}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
