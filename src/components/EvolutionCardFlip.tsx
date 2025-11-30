import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { X, Share2 } from "lucide-react";
import { downloadImage } from "@/utils/imageDownload";

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
  energy_cost?: number | null;
  bond_level?: number | null;
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

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!card.image_url) return;
    
    await downloadImage(
      card.image_url,
      `cosmiq-${card.creature_name.toLowerCase().replace(/\s+/g, '-')}-stage-${card.evolution_stage}.png`,
      {
        title: `${card.creature_name} - Cosmiq`,
        text: `Check out my ${card.creature_name}! ✨ #Cosmiq`,
        dialogTitle: 'Share Companion Card'
      }
    );
  };

  return (
    <>
      {/* Small Card Preview - Trading Card Style */}
      <div 
        className="relative aspect-[2.5/3.5] w-full max-w-[320px] cursor-pointer rounded-xl overflow-hidden"
        onClick={handleCardClick}
      >
        <div className={`h-full rounded-xl border-4 bg-gradient-to-br ${RARITY_COLORS[card.rarity]} p-1 shadow-lg`}>
          <div className="h-full rounded-lg bg-gradient-to-b from-background via-background to-background/95 relative overflow-hidden flex flex-col">
            {/* Top Bar - Element & Stage */}
            <div className="relative z-10 flex items-center justify-between p-2">
              <Badge className="bg-background/90 backdrop-blur-sm text-xs">
                {ELEMENT_SYMBOLS[card.element.toLowerCase()] || "✨"} {card.element}
              </Badge>
              <Badge className="bg-background/90 backdrop-blur-sm text-xs">
                Stage {card.evolution_stage}
              </Badge>
            </div>

            {/* Companion Image - Full Size */}
            <div className="relative flex-1 overflow-hidden">
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>

            {/* Bottom Section - Name & Branding */}
            <div className="relative z-10 p-3 space-y-1 bg-gradient-to-t from-background to-background/95">
              <h3 className="font-bold text-base text-center text-foreground drop-shadow-lg">
                ★ {card.creature_name.toUpperCase()} ★
              </h3>
              <div className="text-xs text-center text-muted-foreground">
                {card.rarity}
              </div>
              <div className="text-center pt-2 border-t border-border/30">
                <span className="text-xs font-bold tracking-wider text-primary">✦ COSMIQ ✦</span>
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
            {/* Share Button */}
            <button
              onClick={handleShare}
              className="absolute top-4 right-16 z-50 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-colors"
            >
              <Share2 className="w-6 h-6" />
            </button>
            
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div 
              className="relative w-full max-w-[320px] aspect-[2.5/3.5] cursor-pointer perspective-1000"
              onClick={handleFlip}
            >
              <motion.div
                className="relative w-full h-full preserve-3d"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, type: "spring" }}
              >
                {/* Front - Trading Card Style */}
                <div className="absolute w-full h-full backface-hidden">
                  <div className={`h-full rounded-2xl border-[6px] bg-gradient-to-br ${RARITY_COLORS[card.rarity]} p-1 shadow-2xl`}>
                    <div className="h-full rounded-xl bg-gradient-to-b from-background via-background to-background/95 relative overflow-hidden flex flex-col">
                      {/* Top Bar - Element & Stage */}
                      <div className="relative z-10 flex items-center justify-between p-3">
                        <Badge className="bg-background/90 backdrop-blur-sm text-sm px-3 py-1">
                          {ELEMENT_SYMBOLS[card.element.toLowerCase()] || "✨"} {card.element}
                        </Badge>
                        <Badge className="bg-background/90 backdrop-blur-sm text-sm px-3 py-1">
                          Stage {card.evolution_stage}
                        </Badge>
                      </div>

                      {/* Companion Image - Full Size */}
                      <div className="relative flex-1 overflow-hidden mx-2">
                        {card.image_url ? (
                          <img
                            src={card.image_url}
                            alt={card.creature_name}
                            className="absolute inset-0 w-full h-full object-cover rounded-lg"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center rounded-lg">
                            No Image
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent rounded-lg" />
                      </div>

                      {/* Bottom Section - Name, Rarity & Branding */}
                      <div className="relative z-10 p-4 space-y-2 bg-gradient-to-t from-background to-background/95">
                        <h3 className="font-bold text-xl text-center text-foreground drop-shadow-lg tracking-wide">
                          ★ {card.creature_name.toUpperCase()} ★
                        </h3>
                        <div className="text-sm text-center text-muted-foreground">
                          Stage {card.evolution_stage} • {card.rarity}
                        </div>
                        <div className="text-center pt-3 border-t-2 border-primary/30">
                          <span className="text-base font-bold tracking-widest bg-gradient-to-r from-primary via-primary to-primary bg-clip-text text-transparent drop-shadow-lg">
                            ✦ COSMIQ ✦
                          </span>
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
