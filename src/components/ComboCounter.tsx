import { cn } from "@/lib/utils";
import { Flame, Zap, Star } from "lucide-react";
import confetti from "canvas-confetti";
import { useEffect, useRef } from "react";
import { haptics } from "@/utils/haptics";

interface ComboCounterProps {
  count: number;
  show: boolean;
  bonusXP: number;
}

type ComboTier = "normal" | "ultra" | "legendary";

function getComboTier(count: number): ComboTier {
  if (count >= 10) return "legendary";
  if (count >= 5) return "ultra";
  return "normal";
}

function getComboLabel(tier: ComboTier, count: number): string {
  if (tier === "legendary") return "LEGENDARY!";
  if (tier === "ultra") return "ULTRA COMBO!";
  return `${count}x COMBO!`;
}

const tierStyles: Record<ComboTier, { bg: string; text: string; glow: string; icon: string }> = {
  normal: {
    bg: "from-stardust-gold via-amber-500 to-stardust-gold",
    text: "text-black",
    glow: "shadow-[0_0_30px_hsl(var(--stardust-gold)/0.6)]",
    icon: "text-yellow-100",
  },
  ultra: {
    bg: "from-orange-500 via-red-500 to-orange-500",
    text: "text-white",
    glow: "shadow-[0_0_40px_rgba(249,115,22,0.7)]",
    icon: "text-orange-100",
  },
  legendary: {
    bg: "from-purple-500 via-fuchsia-500 to-purple-500",
    text: "text-white",
    glow: "shadow-[0_0_50px_rgba(168,85,247,0.8)]",
    icon: "text-purple-100",
  },
};

export function ComboCounter({ count, show, bonusXP }: ComboCounterProps) {
  const lastMilestoneRef = useRef(0);
  const tier = getComboTier(count);
  const styles = tierStyles[tier];
  const label = getComboLabel(tier, count);

  // Trigger milestone effects
  useEffect(() => {
    if (!show) return;
    
    // Check for milestone crossings (5x and 10x)
    if (count >= 5 && lastMilestoneRef.current < 5) {
      // Ultra combo milestone
      haptics.success();
      confetti({
        particleCount: 60,
        spread: 80,
        origin: { y: 0.3, x: 0.5 },
        colors: ["#f97316", "#ef4444", "#fbbf24"],
        startVelocity: 35,
      });
    }
    
    if (count >= 10 && lastMilestoneRef.current < 10) {
      // Legendary combo milestone
      haptics.success();
      confetti({
        particleCount: 100,
        spread: 100,
        origin: { y: 0.3, x: 0.5 },
        colors: ["#a855f7", "#d946ef", "#f0abfc", "#FFD700"],
        startVelocity: 45,
        shapes: ["star", "circle"],
        scalar: 1.2,
      });
    }
    
    lastMilestoneRef.current = count;
  }, [count, show]);

  // Reset milestone tracking when combo ends
  useEffect(() => {
    if (!show) {
      lastMilestoneRef.current = 0;
    }
  }, [show]);

  if (!show || count < 2) return null;
  
  return (
    <div 
      className={cn(
        "fixed top-24 left-1/2 -translate-x-1/2 z-50",
        "animate-combo-pop pointer-events-none",
        tier === "legendary" && "animate-pulse"
      )}
    >
      {/* Screen pulse effect for high combos */}
      {tier !== "normal" && (
        <div className={cn(
          "absolute -inset-8 rounded-full blur-2xl opacity-30 animate-pulse",
          tier === "ultra" && "bg-orange-500",
          tier === "legendary" && "bg-purple-500"
        )} />
      )}
      
      <div className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full relative",
        "bg-gradient-to-r",
        styles.bg,
        styles.glow,
        "border border-white/30",
        tier === "legendary" && "scale-110"
      )}>
        {tier === "legendary" ? (
          <Star className={cn("h-5 w-5 animate-spin", styles.icon)} style={{ animationDuration: "2s" }} />
        ) : (
          <Flame className={cn("h-5 w-5 animate-pulse", styles.icon)} />
        )}
        <span className={cn("text-lg font-black tracking-wide", styles.text)}>
          {label}
        </span>
        <Zap className={cn("h-4 w-4", styles.icon)} />
      </div>
      
      {/* Bonus XP indicator */}
      {bonusXP > 0 && (
        <div className="text-center mt-1 animate-fade-in">
          <span className={cn(
            "text-sm font-bold",
            tier === "legendary" ? "text-purple-400" : tier === "ultra" ? "text-orange-400" : "text-stardust-gold"
          )}>
            +{bonusXP} Bonus XP
          </span>
        </div>
      )}
      
      {/* Particle effects - more for higher tiers */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(tier === "legendary" ? 12 : tier === "ultra" ? 9 : 6)].map((_, i) => (
          <span
            key={i}
            className={cn(
              "absolute w-1.5 h-1.5 rounded-full animate-combo-particle",
              tier === "legendary" ? "bg-purple-400" : tier === "ultra" ? "bg-orange-400" : "bg-amber-400"
            )}
            style={{
              left: `${10 + i * (tier === "legendary" ? 7 : 12)}%`,
              animationDelay: `${i * 80}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
