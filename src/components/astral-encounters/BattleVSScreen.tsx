import { useMemo } from "react";
import { motion } from "framer-motion";
import { Skull, Sparkles, Zap, SkipForward } from "lucide-react";
import { Adversary, AdversaryTier } from "@/types/astralEncounters";
import { Button } from "@/components/ui/button";
import { getStageName } from "@/config/companionStages";
import { formatDisplayLabel } from "@/lib/utils";

interface BattleVSScreenProps {
  companionImageUrl?: string;
  companionName?: string;
  companionStage?: number;
  adversary: Adversary;
  adversaryImageUrl?: string;
  onReady: () => void;
  onPass?: () => void | Promise<void>;
}

const TIER_COLORS: Record<AdversaryTier, { primary: string; glow: string; bg: string }> = {
  common: { primary: "hsl(220, 13%, 50%)", glow: "rgba(100, 116, 139, 0.5)", bg: "from-slate-500/20 to-slate-700/10" },
  uncommon: { primary: "hsl(142, 76%, 46%)", glow: "rgba(34, 197, 94, 0.5)", bg: "from-emerald-500/20 to-emerald-700/10" },
  rare: { primary: "hsl(217, 91%, 60%)", glow: "rgba(59, 130, 246, 0.5)", bg: "from-blue-500/20 to-blue-700/10" },
  epic: { primary: "hsl(271, 91%, 65%)", glow: "rgba(168, 85, 247, 0.5)", bg: "from-purple-500/20 to-purple-700/10" },
  legendary: { primary: "hsl(38, 92%, 50%)", glow: "rgba(245, 158, 11, 0.6)", bg: "from-amber-500/20 to-orange-600/10" },
};

export const BattleVSScreen = ({
  companionImageUrl,
  companionName = "Companion",
  companionStage = 0,
  adversary,
  adversaryImageUrl,
  onReady,
  onPass,
}: BattleVSScreenProps) => {
  const tierColors = TIER_COLORS[adversary.tier as AdversaryTier] || TIER_COLORS.common;

  // Memoize speed line positions to prevent re-renders
  const speedLines = useMemo(() => 
    Array.from({ length: 15 }, (_, i) => ({
      id: i,
      top: (i * 7) + 3, // Evenly distributed
      duration: 0.6 + (i % 5) * 0.15,
      delay: (i % 7) * 0.1,
    })), []
  );

  // Memoize particle positions
  const particles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: (i % 5) * 25,
      y: Math.floor(i / 5) * 25,
      size: 2 + (i % 3),
      duration: 2 + (i % 3),
      delay: (i % 5) * 0.3,
    })), []
  );

  return (
    <div className="relative w-full h-[520px] overflow-hidden bg-gradient-to-b from-background via-background/95 to-background">
      {/* Cosmic background */}
      <div className="absolute inset-0">
        {/* Starfield particles */}
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-white/60"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
            }}
            animate={{
              opacity: [0.2, 0.8, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
            }}
          />
        ))}

        {/* Speed lines - horizontal */}
        {speedLines.map((line) => (
          <motion.div
            key={line.id}
            className="absolute h-[1px] w-full"
            style={{
              top: `${line.top}%`,
              background: `linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.4) 50%, transparent 100%)`,
            }}
            animate={{
              x: ["-100%", "100%"],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: line.duration,
              repeat: Infinity,
              delay: line.delay,
              ease: "linear",
            }}
          />
        ))}

        {/* Diagonal energy divider */}
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="dividerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
              <stop offset="50%" stopColor="white" stopOpacity="0.1" />
              <stop offset="100%" style={{ stopColor: tierColors.primary }} stopOpacity="0.3" />
            </linearGradient>
          </defs>
          <motion.line
            x1="50%"
            y1="0"
            x2="50%"
            y2="100%"
            stroke="url(#dividerGradient)"
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          />
        </svg>

        {/* Side gradients */}
        <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
        <div 
          className="absolute inset-y-0 right-0 w-1/2"
          style={{ background: `linear-gradient(to left, ${tierColors.glow}, transparent)` }}
        />
      </div>

      {/* Main battle layout */}
      <div className="relative z-10 h-full flex flex-col">
        {/* VS Section */}
        <div className="flex-1 flex items-center relative min-h-0">
          {/* Companion Side */}
          <motion.div
            className="flex-1 h-full flex flex-col items-center justify-center px-3"
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 70, damping: 18, delay: 0.1 }}
          >
            {/* Companion Image */}
            <motion.div
              className="relative w-36 h-36 sm:w-44 sm:h-44"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* Outer glow */}
              <motion.div
                className="absolute -inset-4 rounded-full"
                style={{
                  background: "radial-gradient(circle, hsl(var(--primary) / 0.3) 0%, transparent 70%)",
                }}
                animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              />
              
              {/* Image frame */}
              <div className="relative w-full h-full rounded-2xl overflow-hidden border-2 border-primary/40 shadow-[0_0_30px_hsl(var(--primary)/0.3)]">
                {companionImageUrl ? (
                  <img
                    src={companionImageUrl}
                    alt={companionName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                    <Sparkles className="w-12 h-12 text-primary" />
                  </div>
                )}
              </div>
            </motion.div>

            {/* Companion Name */}
            <motion.div
              className="mt-3 text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-base font-bold text-foreground">{companionName}</p>
              <p className="text-[10px] text-primary/80 font-medium uppercase tracking-wider">{getStageName(companionStage)}</p>
            </motion.div>
          </motion.div>

          {/* Center VS Badge - Clean & Sharp */}
          <motion.div
            className="absolute left-[43%] top-[35%] -translate-x-1/2 -translate-y-1/2 z-20"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.3 }}
          >
            {/* Subtle glow backdrop */}
            <motion.div
              className="absolute inset-0 rounded-lg blur-xl"
              style={{ background: `${tierColors.primary}40` }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            
            {/* Clean badge container */}
            <div 
              className="relative px-3 py-1.5 bg-background/95 border border-primary/50 rounded-md backdrop-blur-sm"
              style={{
                boxShadow: `0 0 20px ${tierColors.glow}`,
              }}
            >
              <span 
                className="text-lg sm:text-xl font-black tracking-tight"
                style={{
                  background: `linear-gradient(135deg, hsl(var(--primary)) 0%, ${tierColors.primary} 100%)`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                VS
              </span>
            </div>
          </motion.div>

          {/* Adversary Side */}
          <motion.div
            className="flex-1 h-full flex flex-col items-center justify-center px-3"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 70, damping: 18, delay: 0.1 }}
          >
            {/* Adversary Image */}
            <motion.div
              className="relative w-36 h-36 sm:w-44 sm:h-44"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            >
              {/* Outer glow */}
              <motion.div
                className="absolute -inset-4 rounded-full"
                style={{
                  background: `radial-gradient(circle, ${tierColors.glow} 0%, transparent 70%)`,
                }}
                animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              />
              
              {/* Image frame */}
              <div 
                className="relative w-full h-full rounded-2xl overflow-hidden border-2"
                style={{ 
                  borderColor: tierColors.primary + '60',
                  boxShadow: `0 0 30px ${tierColors.glow}`,
                }}
              >
                {adversaryImageUrl ? (
                  <img
                    src={adversaryImageUrl}
                    alt={adversary.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div 
                    className={`w-full h-full bg-gradient-to-br ${tierColors.bg} flex items-center justify-center`}
                  >
                    <Skull 
                      className="w-12 h-12" 
                      style={{ color: tierColors.primary, filter: `drop-shadow(0 0 10px ${tierColors.glow})` }}
                    />
                  </div>
                )}
              </div>

              {/* Tier badge */}
              <motion.div
                className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase text-white shadow-lg"
                style={{ backgroundColor: tierColors.primary }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.6, type: "spring" }}
              >
                {formatDisplayLabel(adversary.tier)}
              </motion.div>
            </motion.div>

            {/* Adversary Name */}
            <motion.div
              className="mt-3 text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <p 
                className="text-base font-bold"
                style={{ color: tierColors.primary }}
              >
                {adversary.name}
              </p>
              <p 
                className="text-[10px] font-medium uppercase tracking-wider"
                style={{ color: tierColors.primary + 'cc' }}
              >
                {formatDisplayLabel(adversary.theme)} Adversary
              </p>
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom section */}
        <motion.div
          className="px-5 pb-5 pt-3 bg-gradient-to-t from-background via-background/95 to-transparent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          {/* Stats row */}
          <div className="flex justify-center gap-6 mb-3">
            {[
              { label: "Phases", value: adversary.phases },
              { label: "Essence", value: adversary.statType },
              { label: "Boost", value: `+${adversary.statBoost}` },
            ].map((stat) => (
              <div key={stat.label} className="text-center px-3 py-1.5 rounded-lg bg-muted/30 backdrop-blur-sm">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="text-sm font-bold text-primary">
                  {typeof stat.value === "string" ? formatDisplayLabel(stat.value) : stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Lore */}
          <p className="text-center text-xs text-muted-foreground italic mb-4 line-clamp-2 px-2">
            "{adversary.lore}"
          </p>

          {/* Battle Buttons */}
          <div className="flex gap-3 w-full overflow-hidden">
            {onPass && (
              <Button
                onClick={onPass}
                variant="ghost"
                size="lg"
                className="h-12 px-4 text-muted-foreground hover:text-foreground"
              >
                <SkipForward className="w-5 h-5 mr-1" />
                Pass
              </Button>
            )}
            <Button
              onClick={onReady}
              size="lg"
              className="flex-1 min-w-0 h-12 text-sm sm:text-base font-bold bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] hover:bg-[position:100%_0] transition-all duration-500 shadow-lg shadow-primary/30"
            >
              <Zap className="w-5 h-5 mr-2 flex-shrink-0" />
              Begin Harmonization
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
