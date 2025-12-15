import { motion } from "framer-motion";
import { Swords, Skull } from "lucide-react";
import { Adversary, AdversaryTier } from "@/types/astralEncounters";

interface BattleSceneHeaderProps {
  companionImageUrl?: string;
  companionName?: string;
  adversary: Adversary;
  adversaryImageUrl?: string;
}

const TIER_COLORS: Record<AdversaryTier, string> = {
  common: 'hsl(var(--muted-foreground))',
  uncommon: 'hsl(142, 76%, 46%)',
  rare: 'hsl(217, 91%, 60%)',
  epic: 'hsl(271, 91%, 65%)',
  legendary: 'hsl(38, 92%, 50%)',
};

const TIER_BG: Record<AdversaryTier, string> = {
  common: 'from-muted/30 to-muted/10',
  uncommon: 'from-green-500/30 to-green-500/10',
  rare: 'from-blue-500/30 to-blue-500/10',
  epic: 'from-purple-500/30 to-purple-500/10',
  legendary: 'from-amber-500/30 to-amber-500/10',
};

export const BattleSceneHeader = ({ 
  companionImageUrl, 
  companionName = "Companion",
  adversary,
  adversaryImageUrl,
}: BattleSceneHeaderProps) => {
  const tierColor = TIER_COLORS[adversary.tier as AdversaryTier] || TIER_COLORS.common;
  const tierBg = TIER_BG[adversary.tier as AdversaryTier] || TIER_BG.common;

  return (
    <div className="relative px-4 pt-4 pb-2">
      <div className="flex items-center justify-between gap-4">
        {/* Companion Side */}
        <motion.div
          className="flex flex-col items-center flex-1"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
        >
          {/* Companion portrait */}
          <motion.div
            className="relative"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Glow effect */}
            <motion.div
              className="absolute inset-0 rounded-full bg-primary/30 blur-lg"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            
            {/* Portrait container - larger size */}
            <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-primary/50 bg-gradient-to-br from-primary/20 to-accent/20 shadow-lg shadow-primary/20">
              {companionImageUrl ? (
                <img
                  src={companionImageUrl}
                  alt={companionName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/10">
                  <span className="text-3xl">🌟</span>
                </div>
              )}
            </div>

            {/* Health/energy indicator */}
            <motion.div
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary"
                  style={{ boxShadow: '0 0 4px hsl(var(--primary))' }}
                  animate={{
                    scale: [1, 1.2, 1],
                  }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </motion.div>
          </motion.div>

          {/* Companion name */}
          <motion.span
            className="mt-2 text-xs font-medium text-foreground truncate max-w-[80px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {companionName}
          </motion.span>
        </motion.div>

        {/* VS Center */}
        <motion.div
          className="relative flex-shrink-0"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
        >
          {/* Pulse effect */}
          <motion.div
            className="absolute inset-0 rounded-full bg-accent/20 blur-md"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          
          <div className="relative p-2 rounded-full bg-gradient-to-br from-accent/30 to-primary/30 border border-accent/30">
            <Swords className="w-6 h-6 text-accent" />
          </div>
        </motion.div>

        {/* Adversary Side */}
        <motion.div
          className="flex flex-col items-center flex-1"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
        >
          {/* Adversary portrait */}
          <motion.div
            className="relative"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          >
            {/* Glow effect */}
            <motion.div
              className="absolute inset-0 rounded-full blur-lg"
              style={{ backgroundColor: `${tierColor}30` }}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            
            {/* Portrait container - larger with AI image support */}
            <div 
              className={`relative w-24 h-24 rounded-2xl overflow-hidden border-2 bg-gradient-to-br ${tierBg} shadow-lg`}
              style={{ borderColor: `${tierColor}60`, boxShadow: `0 8px 24px ${tierColor}30` }}
            >
              {adversaryImageUrl ? (
                <img
                  src={adversaryImageUrl}
                  alt={adversary.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Skull 
                    className="w-12 h-12" 
                    style={{ color: tierColor, filter: `drop-shadow(0 0 8px ${tierColor})` }}
                  />
                </div>
              )}
            </div>

            {/* Tier badge */}
            <motion.div
              className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase text-white"
              style={{ backgroundColor: tierColor }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: "spring" }}
            >
              {adversary.tier.slice(0, 1)}
            </motion.div>

            {/* Threat indicator */}
            <motion.div
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ 
                    backgroundColor: tierColor,
                    boxShadow: `0 0 4px ${tierColor}` 
                  }}
                  animate={{
                    scale: [1, 1.2, 1],
                  }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </motion.div>
          </motion.div>

          {/* Adversary name */}
          <motion.span
            className="mt-2 text-xs font-medium truncate max-w-[80px]"
            style={{ color: tierColor }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {adversary.name}
          </motion.span>
        </motion.div>
      </div>

      {/* Battle arena divider */}
      <motion.div
        className="mt-3 h-px bg-gradient-to-r from-transparent via-border to-transparent"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      />
    </div>
  );
};
