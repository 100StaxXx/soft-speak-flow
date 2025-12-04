import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronRight, ArrowLeft } from "lucide-react";
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
  fontClass: string;
  nameStyle: React.CSSProperties;
}

const factions: Faction[] = [
  {
    id: "starfall",
    name: "STARFALL FLEET",
    subtitle: "Blazing Through the Unknown",
    motto: "We don't follow paths, we burn new ones.",
    philosophy: [
      "Action over hesitation",
      "Bold moves create breakthroughs",
      "Fear is fuel for the fearless",
    ],
    image: starfallImg,
    color: "hsl(24, 100%, 50%)",
    fontClass: "font-bebas",
    nameStyle: {
      fontFamily: "'Bebas Neue', sans-serif",
      letterSpacing: "0.15em",
      textShadow: "0 0 40px rgba(255, 150, 50, 0.8), 0 0 80px rgba(255, 100, 0, 0.4)",
    },
  },
  {
    id: "void",
    name: "Void Collective",
    subtitle: "Masters of the In Between",
    motto: "In stillness, we find infinite power.",
    philosophy: [
      "Depth over speed",
      "Reflection reveals truth",
      "The void holds all answers",
    ],
    image: voidImg,
    color: "hsl(270, 70%, 50%)",
    fontClass: "font-cinzel",
    nameStyle: {
      fontFamily: "'Cinzel', serif",
      letterSpacing: "0.2em",
      fontWeight: 400,
      textShadow: "0 0 30px rgba(180, 100, 255, 0.7), 0 0 60px rgba(130, 50, 200, 0.4)",
    },
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
    fontClass: "font-quicksand",
    nameStyle: {
      fontFamily: "'Quicksand', sans-serif",
      letterSpacing: "0.08em",
      fontWeight: 600,
      textShadow: "0 0 30px rgba(100, 200, 255, 0.7), 0 0 60px rgba(50, 150, 220, 0.4)",
    },
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
      {/* Header with iOS safe area */}
      <header className="sticky top-0 z-20 bg-background pt-safe-top">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center px-6 py-6"
        >
          <h1 className="text-2xl font-bold text-foreground mb-1">Choose Your Path</h1>
          <p className="text-muted-foreground text-sm">
            Your faction shapes your cosmic journey
          </p>
        </motion.div>
      </header>

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
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            
            {/* Faction Name */}
            <div className="absolute inset-0 flex items-end p-5">
              <h2 
                className="text-2xl text-white"
                style={faction.nameStyle}
              >
                {faction.name}
              </h2>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Fullscreen Expanded View */}
      <AnimatePresence>
        {expandedData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-50"
          >
            {/* Fullscreen Background Image */}
            <motion.div
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              exit={{ scale: 1.1, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0"
            >
              <img
                src={expandedData.image}
                alt={expandedData.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
            </motion.div>

            {/* Back Button */}
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              onClick={handleClose}
              className="absolute top-safe-top left-4 mt-4 flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors z-10"
            >
              <ArrowLeft size={20} />
              <span className="text-sm font-medium">Back</span>
            </motion.button>

            {/* Content */}
            <div className="absolute inset-x-0 bottom-0 p-6 pb-safe-bottom">
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.4 }}
              >
                {/* Faction Name */}
                <h2 
                  className="text-4xl text-white mb-2"
                  style={expandedData.nameStyle}
                >
                  {expandedData.name}
                </h2>
                <p className="text-white/80 text-lg mb-5">{expandedData.subtitle}</p>
                
                {/* Motto */}
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className="bg-black/40 backdrop-blur-sm rounded-xl p-4 mb-5"
                >
                  <p className="text-white italic text-lg">
                    "{expandedData.motto}"
                  </p>
                </motion.div>
                
                {/* Philosophy Points */}
                <div className="space-y-2.5 mb-6">
                  {expandedData.philosophy.map((point, i) => (
                    <motion.div
                      key={i}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.35 + i * 0.08 }}
                      className="flex items-center gap-3"
                    >
                      <div 
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: expandedData.color }}
                      />
                      <span className="text-white/90">{point}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Select Button */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <Button
                    onClick={() => handleSelect(expandedData.id)}
                    className="w-full py-6 text-lg font-semibold"
                    style={{
                      background: `linear-gradient(135deg, ${expandedData.color}, ${expandedData.color}80)`,
                    }}
                  >
                    Join {expandedData.name}
                    <ChevronRight className="ml-2" />
                  </Button>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
