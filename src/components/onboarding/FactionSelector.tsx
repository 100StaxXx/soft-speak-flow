import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronRight, ArrowLeft, Flame, Moon, Sparkles } from "lucide-react";
import starfallImg from "@/assets/faction-starfall.png";
import voidImg from "@/assets/faction-void.png";
import stellarImg from "@/assets/faction-stellar.png";

export type FactionType = "starfall" | "void" | "stellar";

interface Faction {
  id: FactionType;
  name: string;
  subtitle: string;
  description: string;
  motto: string;
  philosophy: string[];
  traits: string[];
  idealFor: string;
  image: string;
  color: string;
  fontClass: string;
  nameStyle: React.CSSProperties;
  icon: React.ElementType;
}

const factions: Faction[] = [
  {
    id: "starfall",
    name: "STARFALL FLEET",
    subtitle: "Blazing Through the Unknown",
    description: "Warriors of momentum who believe that action is the ultimate teacher. The Fleet charges forward, turning obstacles into fuel and doubt into determination.",
    motto: "We don't follow paths, we burn new ones.",
    philosophy: [
      "Action over hesitation",
      "Bold moves create breakthroughs",
      "Fear is fuel for the fearless",
      "Progress beats perfection",
    ],
    traits: ["Courageous", "Driven", "Resilient", "Bold"],
    idealFor: "Those who thrive on challenge and want to build unstoppable momentum in their growth journey.",
    image: starfallImg,
    color: "hsl(24, 100%, 50%)",
    fontClass: "font-bebas",
    nameStyle: {
      fontFamily: "'Bebas Neue', sans-serif",
      letterSpacing: "0.15em",
      textShadow: "0 0 40px rgba(255, 150, 50, 0.8), 0 0 80px rgba(255, 100, 0, 0.4)",
    },
    icon: Flame,
  },
  {
    id: "void",
    name: "Void Collective",
    subtitle: "Masters of the In Between",
    description: "Seekers of depth who find power in pause. The Collective understands that true transformation happens in moments of stillness, where clarity emerges from chaos.",
    motto: "In stillness, we find infinite power.",
    philosophy: [
      "Depth over speed",
      "Reflection reveals truth",
      "The void holds all answers",
      "Patience is strength",
    ],
    traits: ["Introspective", "Wise", "Centered", "Mysterious"],
    idealFor: "Those who value mindfulness and want to cultivate inner wisdom alongside outer achievement.",
    image: voidImg,
    color: "hsl(270, 70%, 50%)",
    fontClass: "font-cinzel",
    nameStyle: {
      fontFamily: "'Cinzel', serif",
      letterSpacing: "0.2em",
      fontWeight: 400,
      textShadow: "0 0 30px rgba(180, 100, 255, 0.7), 0 0 60px rgba(130, 50, 200, 0.4)",
    },
    icon: Moon,
  },
  {
    id: "stellar",
    name: "Stellar Voyagers",
    subtitle: "Dreamers Among the Stars",
    description: "Visionaries who see possibility in every constellation. The Voyagers chart courses through imagination, turning dreams into maps and wonder into wisdom.",
    motto: "Every star was once a dream.",
    philosophy: [
      "Vision shapes reality",
      "Wonder fuels discovery",
      "Dreams are destinations",
      "Imagination is power",
    ],
    traits: ["Creative", "Optimistic", "Curious", "Inspiring"],
    idealFor: "Those who dream big and want to transform their aspirations into reality through wonder and creativity.",
    image: stellarImg,
    color: "hsl(200, 90%, 60%)",
    fontClass: "font-quicksand",
    nameStyle: {
      fontFamily: "'Quicksand', sans-serif",
      letterSpacing: "0.08em",
      fontWeight: 600,
      textShadow: "0 0 30px rgba(100, 200, 255, 0.7), 0 0 60px rgba(50, 150, 220, 0.4)",
    },
    icon: Sparkles,
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
            className="fixed inset-0 z-50 flex flex-col"
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
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
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

            {/* Scrollable Content */}
            <div className="relative flex-1 overflow-y-auto pt-safe-top">
              <div className="min-h-full flex flex-col justify-end p-6 pb-safe-bottom pt-20">
                <motion.div
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15, duration: 0.4 }}
                  className="space-y-5"
                >
                  {/* Faction Icon & Name */}
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${expandedData.color}30` }}
                    >
                      <expandedData.icon 
                        size={24} 
                        style={{ color: expandedData.color }}
                      />
                    </div>
                    <div>
                      <h2 
                        className="text-3xl text-white"
                        style={expandedData.nameStyle}
                      >
                        {expandedData.name}
                      </h2>
                      <p className="text-white/70 text-sm">{expandedData.subtitle}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <motion.p 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-white/85 text-base leading-relaxed"
                  >
                    {expandedData.description}
                  </motion.p>
                  
                  {/* Motto */}
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    className="bg-black/40 backdrop-blur-sm rounded-xl p-4 border-l-2"
                    style={{ borderColor: expandedData.color }}
                  >
                    <p className="text-white italic text-lg">
                      "{expandedData.motto}"
                    </p>
                  </motion.div>

                  {/* Traits */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <h3 className="text-white/60 text-xs uppercase tracking-wider mb-2">Traits</h3>
                    <div className="flex flex-wrap gap-2">
                      {expandedData.traits.map((trait, i) => (
                        <span 
                          key={i}
                          className="px-3 py-1 rounded-full text-sm text-white/90 bg-white/10 backdrop-blur-sm"
                        >
                          {trait}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                  
                  {/* Core Beliefs */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.35 }}
                  >
                    <h3 className="text-white/60 text-xs uppercase tracking-wider mb-3">Core Beliefs</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {expandedData.philosophy.map((point, i) => (
                        <motion.div
                          key={i}
                          initial={{ x: -10, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.4 + i * 0.05 }}
                          className="flex items-center gap-2"
                        >
                          <div 
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: expandedData.color }}
                          />
                          <span className="text-white/80 text-sm">{point}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Ideal For */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.45 }}
                    className="bg-white/5 backdrop-blur-sm rounded-xl p-4"
                  >
                    <h3 className="text-white/60 text-xs uppercase tracking-wider mb-2">Perfect For</h3>
                    <p className="text-white/85 text-sm leading-relaxed">
                      {expandedData.idealFor}
                    </p>
                  </motion.div>

                  {/* Select Button */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="pt-2"
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
