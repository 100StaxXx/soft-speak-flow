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
  gradient: string;
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
    color: "hsl(24, 100%, 50%)", // Orange/fire
    gradient: "from-orange-500/80 via-red-500/60 to-yellow-500/40",
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
    color: "hsl(270, 70%, 50%)", // Purple/mystical
    gradient: "from-purple-600/80 via-indigo-500/60 to-violet-400/40",
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
    color: "hsl(200, 90%, 60%)", // Cyan/stellar
    gradient: "from-cyan-400/80 via-blue-500/60 to-teal-400/40",
  },
];

interface FactionSelectorProps {
  onComplete: (faction: FactionType) => void;
}

export const FactionSelector = ({ onComplete }: FactionSelectorProps) => {
  const [expandedFaction, setExpandedFaction] = useState<FactionType | null>(null);
  const [selectedFaction, setSelectedFaction] = useState<FactionType | null>(null);

  const handleFactionTap = (factionId: FactionType) => {
    if (expandedFaction === factionId) {
      // Already expanded, select it
      setSelectedFaction(factionId);
    } else {
      // Expand for preview
      setExpandedFaction(factionId);
    }
  };

  const handleConfirm = () => {
    if (selectedFaction) {
      onComplete(selectedFaction);
    }
  };

  const handleClose = () => {
    setExpandedFaction(null);
    setSelectedFaction(null);
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center pt-safe-top px-6 py-8 z-20"
      >
        <h1 className="text-3xl font-bold text-white mb-2">Choose Your Path</h1>
        <p className="text-white/70 text-sm">
          Your faction shapes your cosmic journey
        </p>
      </motion.div>

      {/* Triangle Split View */}
      <div className="flex-1 relative">
        {factions.map((faction, index) => {
          const isExpanded = expandedFaction === faction.id;
          const isSelected = selectedFaction === faction.id;
          const isOtherExpanded = expandedFaction && expandedFaction !== faction.id;

          // Calculate clip paths for triangle sections
          const getClipPath = () => {
            if (isExpanded) return "polygon(0 0, 100% 0, 100% 100%, 0 100%)";
            if (isOtherExpanded) return "polygon(0 0, 0 0, 0 0)";
            
            // Default triangle splits
            switch (index) {
              case 0: // Top-left
                return "polygon(0 0, 100% 0, 50% 100%, 0 100%)";
              case 1: // Top-right  
                return "polygon(50% 0, 100% 0, 100% 100%, 50% 100%)";
              case 2: // Bottom center
                return "polygon(25% 0, 75% 0, 100% 100%, 0 100%)";
              default:
                return "polygon(0 0, 100% 0, 100% 100%, 0 100%)";
            }
          };

          return (
            <motion.div
              key={faction.id}
              className="absolute inset-0 cursor-pointer overflow-hidden"
              initial={false}
              animate={{
                clipPath: getClipPath(),
                zIndex: isExpanded ? 30 : 10 - index,
                opacity: isOtherExpanded ? 0 : 1,
              }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              onClick={() => !isExpanded && handleFactionTap(faction.id)}
            >
              {/* Background Image */}
              <div className="absolute inset-0">
                <img
                  src={faction.image}
                  alt={faction.name}
                  className="w-full h-full object-cover"
                />
                <div className={`absolute inset-0 bg-gradient-to-t ${faction.gradient}`} />
                <div className="absolute inset-0 bg-black/30" />
              </div>

              {/* Collapsed State - Just Name */}
              <AnimatePresence>
                {!isExpanded && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="text-center">
                      <h2 className="text-2xl font-bold text-white drop-shadow-lg">
                        {faction.name}
                      </h2>
                      <p className="text-white/80 text-xs mt-1">Tap to explore</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Expanded State - Full Details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col justify-end p-6 pb-32"
                  >
                    {/* Close Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClose();
                      }}
                      className="absolute top-safe-top right-4 p-2 rounded-full bg-black/40 text-white"
                    >
                      <X size={24} />
                    </button>

                    {/* Faction Details */}
                    <motion.div
                      initial={{ y: 30, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      <h2 className="text-4xl font-bold text-white mb-1">
                        {faction.name}
                      </h2>
                      <p className="text-white/80 text-lg mb-4">{faction.subtitle}</p>
                      
                      <div className="bg-black/40 backdrop-blur-sm rounded-xl p-4 mb-4">
                        <p className="text-white italic text-lg mb-4">
                          "{faction.motto}"
                        </p>
                        
                        <div className="space-y-2">
                          {faction.philosophy.map((point, i) => (
                            <motion.div
                              key={i}
                              initial={{ x: -20, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ delay: 0.3 + i * 0.1 }}
                              className="flex items-center gap-2"
                            >
                              <div 
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: faction.color }}
                              />
                              <span className="text-white/90">{point}</span>
                            </motion.div>
                          ))}
                        </div>
                      </div>

                      {/* Select Button */}
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFaction(faction.id);
                        }}
                        className="w-full py-6 text-lg font-semibold"
                        style={{
                          background: `linear-gradient(135deg, ${faction.color}, ${faction.color}80)`,
                        }}
                      >
                        {isSelected ? "Selected!" : `Join ${faction.name}`}
                        <ChevronRight className="ml-2" />
                      </Button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Confirm Button - Shows when faction selected */}
      <AnimatePresence>
        {selectedFaction && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 p-6 pb-safe-bottom bg-gradient-to-t from-black to-transparent z-40"
          >
            <Button
              onClick={handleConfirm}
              className="w-full py-6 text-lg font-semibold bg-primary hover:bg-primary/90"
            >
              Begin Your Journey
              <ChevronRight className="ml-2" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
