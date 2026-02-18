import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { factions, FactionType } from "@/config/factions";

export type { FactionType } from "@/config/factions";

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
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
            </motion.div>

            {/* Back Button */}
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              onClick={handleClose}
              className="absolute left-4 flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors z-10"
              style={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
            >
              <ArrowLeft size={20} />
              <span className="text-sm font-medium">Back</span>
            </motion.button>

            {/* Scrollable Content */}
            <div className="relative flex-1 overflow-y-auto pt-safe-top">
              <div className="min-h-full flex flex-col justify-end px-6 pb-safe-lg pt-20">
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
