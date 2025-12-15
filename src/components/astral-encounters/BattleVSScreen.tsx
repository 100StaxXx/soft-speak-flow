import { motion } from "framer-motion";
import { Skull, Sparkles, Zap } from "lucide-react";
import { Adversary, AdversaryTier } from "@/types/astralEncounters";
import { Button } from "@/components/ui/button";

interface BattleVSScreenProps {
  companionImageUrl?: string;
  companionName?: string;
  adversary: Adversary;
  adversaryImageUrl?: string;
  onReady: () => void;
}

const TIER_COLORS: Record<AdversaryTier, { primary: string; glow: string }> = {
  common: { primary: "hsl(220, 13%, 50%)", glow: "rgba(100, 116, 139, 0.5)" },
  uncommon: { primary: "hsl(142, 76%, 46%)", glow: "rgba(34, 197, 94, 0.5)" },
  rare: { primary: "hsl(217, 91%, 60%)", glow: "rgba(59, 130, 246, 0.5)" },
  epic: { primary: "hsl(271, 91%, 65%)", glow: "rgba(168, 85, 247, 0.5)" },
  legendary: { primary: "hsl(38, 92%, 50%)", glow: "rgba(245, 158, 11, 0.6)" },
};

export const BattleVSScreen = ({
  companionImageUrl,
  companionName = "Companion",
  adversary,
  adversaryImageUrl,
  onReady,
}: BattleVSScreenProps) => {
  const tierColors = TIER_COLORS[adversary.tier as AdversaryTier] || TIER_COLORS.common;

  return (
    <div className="relative w-full h-[500px] overflow-hidden bg-gradient-to-b from-background via-background to-background/90">
      {/* Animated background effects */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Speed lines */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
            style={{
              top: `${Math.random() * 100}%`,
              left: "-100%",
              width: "200%",
            }}
            animate={{
              x: ["0%", "100%"],
            }}
            transition={{
              duration: 0.8 + Math.random() * 0.5,
              repeat: Infinity,
              delay: Math.random() * 0.5,
              ease: "linear",
            }}
          />
        ))}
        
        {/* Diagonal divider glow */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, hsl(var(--primary) / 0.1) 0%, transparent 45%, transparent 55%, ${tierColors.glow} 100%)`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        />
      </div>

      {/* Main battle layout */}
      <div className="relative z-10 h-full flex flex-col">
        {/* VS Section - Top half with images */}
        <div className="flex-1 flex items-stretch relative">
          {/* Companion Side - Left */}
          <motion.div
            className="flex-1 relative overflow-hidden"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.1 }}
          >
            {/* Blue glow background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent" />
            
            {/* Companion Image - Large and prominent */}
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <motion.div
                className="relative w-full h-full max-w-[200px] max-h-[200px]"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                {/* Glow ring */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "radial-gradient(circle, hsl(var(--primary) / 0.4) 0%, transparent 70%)",
                  }}
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                
                {companionImageUrl ? (
                  <img
                    src={companionImageUrl}
                    alt={companionName}
                    className="relative z-10 w-full h-full object-contain drop-shadow-[0_0_30px_hsl(var(--primary)/0.5)]"
                  />
                ) : (
                  <div className="relative z-10 w-full h-full rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                    <Sparkles className="w-16 h-16 text-primary" />
                  </div>
                )}
              </motion.div>
            </div>

            {/* Companion Name */}
            <motion.div
              className="absolute bottom-4 left-0 right-0 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <p className="text-lg font-bold text-foreground drop-shadow-lg">{companionName}</p>
              <p className="text-xs text-primary font-medium">Your Companion</p>
            </motion.div>
          </motion.div>

          {/* Center VS Badge */}
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.4 }}
          >
            {/* Impact ring */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ 
                background: `linear-gradient(135deg, hsl(var(--primary)) 0%, ${tierColors.primary} 100%)`,
                filter: "blur(20px)",
              }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0.3, 0.8] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-background to-background/80 border-4 border-primary/50 flex items-center justify-center shadow-2xl">
              <motion.span
                className="text-3xl font-black bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                VS
              </motion.span>
            </div>
          </motion.div>

          {/* Adversary Side - Right */}
          <motion.div
            className="flex-1 relative overflow-hidden"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.1 }}
          >
            {/* Tier-colored glow background */}
            <div 
              className="absolute inset-0" 
              style={{ 
                background: `linear-gradient(to left, ${tierColors.glow}, transparent)` 
              }}
            />
            
            {/* Adversary Image - Large and prominent */}
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <motion.div
                className="relative w-full h-full max-w-[200px] max-h-[200px]"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              >
                {/* Glow ring */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `radial-gradient(circle, ${tierColors.glow} 0%, transparent 70%)`,
                  }}
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                
                {adversaryImageUrl ? (
                  <img
                    src={adversaryImageUrl}
                    alt={adversary.name}
                    className="relative z-10 w-full h-full object-contain"
                    style={{ 
                      filter: `drop-shadow(0 0 30px ${tierColors.glow})` 
                    }}
                  />
                ) : (
                  <div 
                    className="relative z-10 w-full h-full rounded-full flex items-center justify-center"
                    style={{ 
                      background: `linear-gradient(135deg, ${tierColors.primary}40, ${tierColors.primary}20)` 
                    }}
                  >
                    <Skull 
                      className="w-16 h-16" 
                      style={{ color: tierColors.primary }}
                    />
                  </div>
                )}
              </motion.div>
            </div>

            {/* Adversary Name & Tier */}
            <motion.div
              className="absolute bottom-4 left-0 right-0 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <p 
                className="text-lg font-bold drop-shadow-lg"
                style={{ color: tierColors.primary }}
              >
                {adversary.name}
              </p>
              <p 
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: tierColors.primary }}
              >
                {adversary.tier} • {adversary.theme}
              </p>
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom section with info and button */}
        <motion.div
          className="px-6 pb-6 pt-4 border-t border-border/30"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          {/* Stats preview */}
          <div className="flex justify-center gap-8 mb-4 text-sm">
            <div className="text-center">
              <p className="text-muted-foreground text-xs">Phases</p>
              <p className="font-bold text-primary">{adversary.phases}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-xs">Essence</p>
              <p className="font-bold text-primary capitalize">{adversary.statType}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-xs">Boost</p>
              <p className="font-bold text-primary">+{adversary.statBoost}</p>
            </div>
          </div>

          {/* Lore */}
          <p className="text-center text-xs text-muted-foreground italic mb-4 line-clamp-2">
            "{adversary.lore}"
          </p>

          {/* Begin Battle Button */}
          <Button
            onClick={onReady}
            size="lg"
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/25"
          >
            <Zap className="w-5 h-5 mr-2" />
            Begin Harmonization
          </Button>
        </motion.div>
      </div>
    </div>
  );
};