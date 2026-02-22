import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { X, Share2 } from "lucide-react";
import { downloadCardElement } from "@/utils/imageDownload";
import { cn } from "@/lib/utils";
import type { RewardCssEffect } from "@/types/epicRewards";
import { FrameCornerDecorations } from "./companion/FrameCornerDecorations";
import { ATTRIBUTE_DESCRIPTIONS, type AttributeType } from "@/config/attributeDescriptions";

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
  equippedFrame?: RewardCssEffect | null;
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

const fallbackEnergyCost = (stage: number) => {
  if (stage <= 9) return 1;
  if (stage <= 14) return 2;
  return 3;
};

interface CardStatSnapshot {
  vitality: number;
  wisdom: number;
  discipline: number;
  resolve: number;
  creativity: number;
  alignment: number;
}

const CARD_ATTRIBUTE_ORDER: AttributeType[] = [
  "vitality",
  "wisdom",
  "discipline",
  "resolve",
  "creativity",
  "alignment",
];

const LEGACY_CARD_STATS_MESSAGE = "Legacy card: regenerate to view 6 attributes.";

const toCardStatSnapshot = (input: unknown): CardStatSnapshot | null => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const record = input as Record<string, unknown>;
  const parsed: Partial<CardStatSnapshot> = {};

  for (const key of CARD_ATTRIBUTE_ORDER) {
    const value = record[key];
    if (typeof value !== "number" || Number.isNaN(value)) {
      return null;
    }
    parsed[key] = value;
  }

  return parsed as CardStatSnapshot;
};

export function EvolutionCardFlip({ card, equippedFrame }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const { tap } = useHapticFeedback();
  const cardRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(() => toCardStatSnapshot(card.stats), [card.stats]);
  const statEntries = useMemo(
    () =>
      stats
        ? CARD_ATTRIBUTE_ORDER.map((key: AttributeType) => ({
            key,
            icon: ATTRIBUTE_DESCRIPTIONS[key].icon,
            name: ATTRIBUTE_DESCRIPTIONS[key].name,
            value: stats[key],
          }))
        : [],
    [stats],
  );
  const energyCost = card.energy_cost ?? fallbackEnergyCost(card.evolution_stage);
  const bondLevel = card.bond_level ?? null;

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
    if (!cardRef.current) return;
    
    await downloadCardElement(
      cardRef.current,
      `cosmiq-${card.creature_name.toLowerCase().replace(/\s+/g, '-')}-stage-${card.evolution_stage}.png`,
      {
        title: `${card.creature_name} - Cosmiq`,
        text: `Check out my ${card.creature_name}! ✨ #Cosmiq`,
        dialogTitle: 'Share Companion Card'
      }
    );
  };

  // Get frame styling from equipped frame
  const hasEnhancedFrame = equippedFrame && equippedFrame.cornerStyle;
  const glowAnimClass = equippedFrame?.glowAnimation === 'pulse' ? 'animate-frame-pulse' :
                        equippedFrame?.glowAnimation === 'breathe' ? 'animate-frame-breathe' :
                        equippedFrame?.glowAnimation === 'flicker' ? 'animate-frame-flicker' :
                        equippedFrame?.glowAnimation === 'shift' ? 'animate-frame-shift' : '';

  const frameStyle: React.CSSProperties = equippedFrame ? {
    borderColor: equippedFrame.gradientBorder ? 'transparent' : equippedFrame.borderColor,
    borderWidth: equippedFrame.borderWidth || '8px',
    borderStyle: (equippedFrame.borderStyle as React.CSSProperties['borderStyle']) || 'solid',
    boxShadow: equippedFrame.glowColor 
      ? `0 0 20px ${equippedFrame.glowColor}, 0 0 40px ${equippedFrame.glowColor}40` 
      : undefined,
  } : {};

  return (
    <>
      {/* Small Card Preview */}
      <div 
        className="relative h-[280px] cursor-pointer rounded-xl overflow-hidden"
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
        aria-label={`Open ${card.creature_name} companion card`}
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
              <div className="flex items-center justify-between text-[10px] text-white/80 bg-black/30 rounded-md px-2 py-1">
                <span className="flex items-center gap-1">
                  ⚡<span className="font-semibold">{energyCost}</span>
                </span>
                {bondLevel !== null && (
                  <span className="flex items-center gap-1">
                    🤝 <span className="font-semibold">{bondLevel}</span>
                  </span>
                )}
              </div>

              {stats ? (
                <div className="grid grid-cols-2 gap-1 text-[9px] bg-black/40 backdrop-blur-sm rounded-lg p-2">
                  {statEntries.map((entry) => (
                    <div
                      key={entry.key}
                      className="flex items-center justify-between gap-1 text-white/90 rounded bg-black/20 px-1.5 py-0.5"
                    >
                      <span className="truncate">
                        {entry.icon} {entry.name}
                      </span>
                      <span className="font-semibold">{entry.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  data-testid="legacy-stats-message"
                  className="text-[10px] text-white/85 bg-black/40 backdrop-blur-sm rounded-lg p-2 text-center leading-snug"
                >
                  {LEGACY_CARD_STATS_MESSAGE}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Modal with Flip */}
      <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setIsFlipped(false);
      }}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-transparent border-0 overflow-hidden">
          <DialogTitle className="sr-only">{card.creature_name} - Evolution Card</DialogTitle>
          <DialogDescription className="sr-only">
            Detailed view of {card.creature_name}, a {card.rarity} {card.element} {card.species} at evolution stage {card.evolution_stage}
          </DialogDescription>
          {/* Clickable backdrop to close */}
          <div 
            className="absolute inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="relative w-full h-[80vh] flex items-center justify-center">
            {/* Share Button */}
            <button
              onClick={handleShare}
              className="absolute top-4 right-20 z-50 p-3 rounded-full bg-black/70 backdrop-blur-sm text-white hover:bg-black/90 active:bg-black transition-colors touch-manipulation"
              aria-label="Share companion card"
            >
              <Share2 className="w-6 h-6" />
            </button>
            
            {/* Close Button - larger touch target */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="absolute top-4 right-4 z-50 p-3 rounded-full bg-black/70 backdrop-blur-sm text-white hover:bg-black/90 active:bg-black transition-colors touch-manipulation"
              aria-label="Close companion card"
            >
              <X className="w-6 h-6" />
            </button>

            <div 
              className="relative w-full max-w-[320px] aspect-[2.5/3.5] cursor-pointer perspective-1000"
              onClick={handleFlip}
              data-testid="evolution-card-flip-target"
            >
              <motion.div
                className="relative w-full h-full preserve-3d"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, type: "spring" }}
                data-testid="evolution-card-inner"
                data-flipped={isFlipped}
              >
                {/* Front - Full Image Trading Card */}
                <div className="absolute w-full h-full backface-hidden" style={{ transform: 'rotateY(0deg)' }}>
                  <div 
                    ref={cardRef} 
                    className={cn(
                      "h-full rounded-2xl p-0 shadow-2xl overflow-hidden relative",
                      hasEnhancedFrame 
                        ? glowAnimClass
                        : `border-[8px] bg-gradient-to-br ${RARITY_COLORS[card.rarity]}`,
                      equippedFrame?.shimmer && 'animate-frame-shimmer',
                      equippedFrame?.animatedGradient && 'animate-gradient-border'
                    )}
                    style={hasEnhancedFrame ? frameStyle : {}}
                  >
                    {/* Gradient border background for animated gradients */}
                    {equippedFrame?.gradientBorder && (
                      <div 
                        className={cn(
                          "absolute inset-0 rounded-2xl -z-10",
                          equippedFrame.animatedGradient && "animate-gradient-border"
                        )}
                        style={{
                          background: equippedFrame.gradientBorder,
                          backgroundSize: '200% 200%',
                        }}
                      />
                    )}

                    {/* Enhanced Corner Decorations */}
                    {hasEnhancedFrame && equippedFrame ? (
                      <FrameCornerDecorations cssEffect={equippedFrame} />
                    ) : (
                      <>
                        {/* Default Ornate Corner Decorations */}
                        <div className="absolute top-0 left-0 w-12 h-12 z-30 pointer-events-none backface-hidden">
                          <div className="absolute inset-0 border-t-2 border-l-2 border-white/40 rounded-tl-xl" />
                          <div className="absolute top-1 left-1 w-8 h-8 border-t border-l border-white/20 rounded-tl-lg" />
                        </div>
                        <div className="absolute top-0 right-0 w-12 h-12 z-30 pointer-events-none backface-hidden">
                          <div className="absolute inset-0 border-t-2 border-r-2 border-white/40 rounded-tr-xl" />
                          <div className="absolute top-1 right-1 w-8 h-8 border-t border-r border-white/20 rounded-tr-lg" />
                        </div>
                        <div className="absolute bottom-0 left-0 w-12 h-12 z-30 pointer-events-none backface-hidden">
                          <div className="absolute inset-0 border-b-2 border-l-2 border-white/40 rounded-bl-xl" />
                          <div className="absolute bottom-1 left-1 w-8 h-8 border-b border-l border-white/20 rounded-bl-lg" />
                        </div>
                        <div className="absolute bottom-0 right-0 w-12 h-12 z-30 pointer-events-none backface-hidden">
                          <div className="absolute inset-0 border-b-2 border-r-2 border-white/40 rounded-br-xl" />
                          <div className="absolute bottom-1 right-1 w-8 h-8 border-b border-r border-white/20 rounded-br-lg" />
                        </div>
                      </>
                    )}

                    {/* Shimmer overlay */}
                    {equippedFrame?.shimmer && (
                      <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-2xl">
                        <div 
                          className="absolute inset-0 animate-frame-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" 
                          style={{ transform: 'skewX(-20deg)', width: '200%', marginLeft: '-50%' }} 
                        />
                      </div>
                    )}
                    
                    {/* Inner Frame Lines */}
                    <div className="absolute inset-2 border border-white/20 rounded-lg z-20 pointer-events-none backface-hidden" />
                    
                    <div className="h-full rounded-xl relative overflow-hidden">
                      {/* Full Card Image Background */}
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
                      
                      {/* Gradient overlays for text readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/60" />
                      
                      {/* Top Bar - Element & Stage */}
                      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3">
                        <Badge className="bg-black/70 backdrop-blur-sm text-white text-sm px-3 py-1 border border-white/20">
                          {ELEMENT_SYMBOLS[card.element.toLowerCase()] || "✨"} {card.element}
                        </Badge>
                        <Badge className="bg-black/70 backdrop-blur-sm text-white text-sm px-3 py-1 border border-white/20">
                          Stage {card.evolution_stage}
                        </Badge>
                      </div>

                      {/* Compact Stats Grid */}
                      <div className="absolute top-14 left-2 right-2 z-10">
                        {stats ? (
                          <div className="grid grid-cols-2 gap-1">
                            {statEntries.map((entry) => (
                              <div
                                key={entry.key}
                                className="bg-black/45 backdrop-blur-sm rounded px-1.5 py-0.5 flex items-center justify-between gap-1 text-white/85 text-[9px] border border-white/10"
                              >
                                <span className="truncate">
                                  {entry.icon} {entry.name}
                                </span>
                                <span className="font-medium">{entry.value}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div
                            data-testid="legacy-stats-message-modal"
                            className="bg-black/45 backdrop-blur-sm rounded px-2 py-1 text-[10px] text-white/85 border border-white/10 text-center"
                          >
                            {LEGACY_CARD_STATS_MESSAGE}
                          </div>
                        )}
                      </div>

                      {/* Bottom Section - Name & Rarity */}
                      <div className="absolute bottom-0 left-0 right-0 z-10 p-4 space-y-2 pb-12 backface-hidden">
                        <h3 className="font-bold text-2xl text-center text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] tracking-wide">
                          ★ {card.creature_name.toUpperCase()} ★
                        </h3>
                        <div className="text-sm text-center text-white/90 drop-shadow-lg">
                          Stage {card.evolution_stage} • {card.rarity}
                        </div>
                      </div>
                    </div>
                    
                    {/* Cosmiq Branding - Centered at Bottom with Ornate Frame */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center backface-hidden">
                      <div className="relative px-6 py-2">
                        {/* Decorative side elements */}
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-[2px] bg-gradient-to-r from-transparent to-white/60" />
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-[2px] bg-gradient-to-l from-transparent to-white/60" />
                        
                        <span className="text-[11px] font-bold tracking-[0.3em] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] relative z-10">
                          ✦ COSMIQ ✦
                        </span>
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
