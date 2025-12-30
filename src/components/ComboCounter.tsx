import { cn } from "@/lib/utils";
import { Flame, Zap } from "lucide-react";

interface ComboCounterProps {
  count: number;
  show: boolean;
  bonusXP: number;
}

export function ComboCounter({ count, show, bonusXP }: ComboCounterProps) {
  if (!show || count < 2) return null;
  
  return (
    <div 
      className={cn(
        "fixed top-24 left-1/2 -translate-x-1/2 z-50",
        "animate-combo-pop pointer-events-none"
      )}
    >
      <div className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full",
        "bg-gradient-to-r from-stardust-gold via-amber-500 to-stardust-gold",
        "shadow-[0_0_30px_hsl(var(--stardust-gold)/0.6)]",
        "border border-stardust-gold/50"
      )}>
        <Flame className="h-5 w-5 text-yellow-100 animate-pulse" />
        <span className="text-lg font-black text-black tracking-wide">
          {count}x COMBO!
        </span>
        <Zap className="h-4 w-4 text-yellow-100" />
      </div>
      
      {/* Bonus XP indicator */}
      {bonusXP > 0 && (
        <div className="text-center mt-1 animate-fade-in">
          <span className="text-sm font-bold text-stardust-gold">
            +{bonusXP} Bonus XP
          </span>
        </div>
      )}
      
      {/* Particle effects */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <span
            key={i}
            className="absolute w-1.5 h-1.5 bg-orange-400 rounded-full animate-combo-particle"
            style={{
              left: `${20 + i * 12}%`,
              animationDelay: `${i * 100}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
