import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronRight, X } from "lucide-react";
import starfallImg from "@/assets/faction-starfall.png";
import voidImg from "@/assets/faction-void.png";
import stellarImg from "@/assets/faction-stellar.png";

export type FactionType = "starfall" | "void" | "stellar";

interface Faction {
  id: FactionType;
  name: string;
  subtitle: string;
  motto: string;
  philosophy: string[];
  image: string;
  color: string;
}

const factions: Faction[] = [
  {
    id: "starfall",
    name: "Starfall Fleet",
    subtitle: "Blazing Through the Unknown",
    motto: "We don't follow paths—we burn new ones.",
    philosophy: [
      "Action over hesitation",
      "Bold moves create breakthroughs",
      "Fear is fuel for the fearless",
    ],
    image: starfallImg,
    color: "hsl(24, 100%, 50%)",
  },
  {
    id: "void",
    name: "Void Collective",
    subtitle: "Masters of the In-Between",
    motto: "In stillness, we find infinite power.",
    philosophy: [
      "Depth over speed",
      "Reflection reveals truth",
      "The void holds all answers",
    ],
    image: voidImg,
    color: "hsl(270, 70%, 50%)",
  },
  {
    id: "stellar",
    name: "Stellar Voyagers",
    subtitle: "Dreamers Among the Stars",
    motto: "Every star was once a dream.",
    philosophy: [
      "Vision shapes reality",
      "Wonder fuels discovery",
      "Dreams are destinations",
    ],
    image: stellarImg,
    color: "hsl(200, 90%, 60%)",
  },
];

interface FactionSelectorProps {
  onComplete: (faction: FactionType) => void;
}

export const FactionSelector = ({ onComplete }: FactionSelectorProps) => {
  const [expandedFaction, setExpandedFaction] = useState<FactionType | null>(null);

  const handleFactionTap = (factionId: FactionType) => {
    setExpandedFaction(factionId);
  };

  const handleClose = () => {
    setExpandedFaction(null);
  };

  const handleSelect = (factionId: FactionType) => {
    onComplete(factionId);
  };

  const expandedData = expandedFaction ? factions.find(f => f.id === expandedFaction) : null;

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col bg-background">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center pt-safe-top px-6 py-6 z-20"
      >
        <h1 className="text-2xl font-bold text-foreground mb-1">Choose Your Path</h1>
        <p className="text-muted-foreground text-sm">
          Your faction shapes your cosmic journey
        </p>
      </motion.div>

      {/* Faction Cards Grid */}
      <div className="flex-1 px-4 pb-6 flex flex-col gap-3">
        {factions.map((faction, index) => (
          <motion.button
            key={faction.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => handleFactionTap(faction.id)}
            className="relative flex-1 min-h-[140px] rounded-2xl overflow-hidden group"
          >
            {/* Background Image */}
            <img
              src={faction.image}
              alt={faction.name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            
            {/* Faction Name */}
            <div className="absolute inset-0 flex items-end p-4">
              <h2 className="text-xl font-bold text-white drop-shadow-lg">
                {faction.name}
              </h2>
            </div>

            {/* Tap Indicator */}
            <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
              <span className="text-white/90 text-xs font-medium">Tap to learn more</span>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Expanded Faction Modal */}
      <AnimatePresence>
        {expandedData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={handleClose}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute inset-x-0 bottom-0 max-h-[85vh] rounded-t-3xl overflow-hidden"
            >
              {/* Image Header */}
              <div className="relative h-48">
                <img
                  src={expandedData.image}
                  alt={expandedData.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
                
                {/* Close Button */}
                <button
                  onClick={handleClose}
                  className="absolute top-4 right-4 p-2 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="bg-background px-6 pb-safe-bottom">
                <div className="-mt-8 relative">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <h2 className="text-2xl font-bold text-foreground mb-1">
                      {expandedData.name}
                    </h2>
                    <p className="text-muted-foreground mb-4">{expandedData.subtitle}</p>
                    
                    {/* Motto */}
                    <div className="bg-muted/50 rounded-xl p-4 mb-4">
                      <p className="text-foreground italic text-lg">
                        "{expandedData.motto}"
                      </p>
                    </div>
                    
                    {/* Philosophy Points */}
                    <div className="space-y-3 mb-6">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Core Beliefs
                      </h3>
                      {expandedData.philosophy.map((point, i) => (
                        <motion.div
                          key={i}
                          initial={{ x: -10, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.2 + i * 0.1 }}
                          className="flex items-center gap-3"
                        >
                          <div 
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: expandedData.color }}
                          />
                          <span className="text-foreground">{point}</span>
                        </motion.div>
                      ))}
                    </div>

                    {/* Select Button */}
                    <Button
                      onClick={() => handleSelect(expandedData.id)}
                      className="w-full py-6 text-lg font-semibold mb-4"
                      style={{
                        background: `linear-gradient(135deg, ${expandedData.color}, ${expandedData.color}80)`,
                      }}
                    >
                      Join {expandedData.name}
                      <ChevronRight className="ml-2" />
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
