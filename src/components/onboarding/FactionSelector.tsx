import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronRight, ArrowLeft, Sparkles } from "lucide-react";
import { factions, FactionType } from "@/config/factions";
import { isMacDesignedForIPadIOSApp } from "@/utils/platformTargets";
import { OnboardingStageShell } from "./OnboardingStageShell";

export type { FactionType } from "@/config/factions";

interface FactionSelectorProps {
  onComplete: (faction: FactionType) => void;
}

export const FactionSelector = ({ onComplete }: FactionSelectorProps) => {
  const [expandedFaction, setExpandedFaction] = useState<FactionType | null>(null);
  const isMacHostedIOS = isMacDesignedForIPadIOSApp();

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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#090507]">
      <OnboardingStageShell
        width="full"
        align="top"
        accent="258 92% 72%"
        eyebrow="Faction Selection"
        title="Choose Your Path"
        description="Each faction shapes your journey in a different way. Open a path to learn what kind of future it offers before you choose."
        bodyClassName="mx-auto w-full max-w-6xl"
      >
        <div className="grid gap-4 md:grid-cols-3">
          {factions.map((faction, index) => (
            <motion.button
              key={faction.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              onClick={() => handleFactionTap(faction.id)}
              className="group relative min-h-[250px] overflow-hidden rounded-[2rem] border border-white/10 bg-black/20 text-left shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl"
            >
              <img
                src={faction.image}
                alt={faction.name}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(23,12,9,0.12),rgba(18,10,8,0.42),rgba(9,6,7,0.94))]" />
              <div
                className="absolute inset-x-6 top-6 h-20 rounded-full blur-3xl"
                style={{ backgroundColor: `${faction.color}45` }}
              />

              <div className="relative flex h-full flex-col justify-between p-6">
                <div className="flex items-start justify-between gap-4">
                  <div
                    className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-black/30 backdrop-blur-md"
                    style={{ boxShadow: `0 0 30px ${faction.color}40` }}
                  >
                    <faction.icon size={22} style={{ color: faction.color }} />
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-white/62">
                    View Path
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.34em] text-white/58">
                      {faction.subtitle}
                    </p>
                    <h2 className="text-4xl text-white" style={faction.nameStyle}>
                      {faction.name}
                    </h2>
                    <p className="max-w-sm text-sm leading-6 text-white/70">
                      {faction.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {faction.traits.slice(0, 3).map((trait) => (
                      <span
                        key={trait}
                        className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/72"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </OnboardingStageShell>

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
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent" />
            </motion.div>

            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              onClick={handleClose}
              className="absolute left-4 z-10 flex items-center gap-2 rounded-full border border-white/12 bg-black/40 px-4 py-2 text-white backdrop-blur-md transition-colors hover:bg-black/55"
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
                  className="onb-stage-panel space-y-5 p-6 md:p-8"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="rounded-2xl border border-white/10 p-3"
                      style={{ backgroundColor: `${expandedData.color}30` }}
                    >
                      <expandedData.icon
                        size={24}
                        style={{ color: expandedData.color }}
                      />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-white/60">
                        <Sparkles className="h-3 w-3 text-primary" />
                        <span>Faction Path</span>
                      </div>
                      <h2
                        className="text-4xl text-white md:text-5xl"
                        style={expandedData.nameStyle}
                      >
                        {expandedData.name}
                      </h2>
                      <p className="text-sm text-white/68">{expandedData.subtitle}</p>
                    </div>
                  </div>

                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-base leading-7 text-white/80"
                  >
                    {expandedData.description}
                  </motion.p>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    className="rounded-[1.5rem] border border-white/10 bg-black/30 p-5 backdrop-blur-md"
                    style={{ boxShadow: `0 0 0 1px ${expandedData.color}24` }}
                  >
                    <p className="text-xl italic leading-relaxed text-white">
                      "{expandedData.motto}"
                    </p>
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <h3 className="mb-3 text-xs uppercase tracking-[0.28em] text-white/58">Traits</h3>
                    <div className="flex flex-wrap gap-2">
                      {expandedData.traits.map((trait, i) => (
                        <span
                          key={i}
                          className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-sm text-white/84 backdrop-blur-sm"
                        >
                          {trait}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className={isMacHostedIOS ? "pt-2 pb-6" : "pt-2"}
                  >
                    <Button
                      onClick={() => handleSelect(expandedData.id)}
                      size="lg"
                      className="h-14 w-full rounded-full text-base font-semibold text-white shadow-[0_20px_45px_rgba(0,0,0,0.28)]"
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
