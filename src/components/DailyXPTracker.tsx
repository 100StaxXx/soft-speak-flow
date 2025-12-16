import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Sparkles, Zap } from "lucide-react";

interface DailyXPTrackerProps {
  totalXP: number;
  className?: string;
}

export function DailyXPTracker({ totalXP, className }: DailyXPTrackerProps) {
  const [displayXP, setDisplayXP] = useState(totalXP);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevXPRef = useRef(totalXP);
  
  // Animate XP count when it changes
  useEffect(() => {
    if (totalXP !== prevXPRef.current) {
      setIsAnimating(true);
      
      // Animate counter
      const startXP = prevXPRef.current;
      const diff = totalXP - startXP;
      const duration = 500;
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        
        setDisplayXP(Math.round(startXP + diff * eased));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          prevXPRef.current = totalXP;
          setTimeout(() => setIsAnimating(false), 300);
        }
      };
      
      requestAnimationFrame(animate);
    }
  }, [totalXP]);
  
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className={cn(
        "flex items-center gap-1 px-2.5 py-1 rounded-full",
        "bg-primary/10 border border-primary/20",
        isAnimating && "animate-xp-pulse"
      )}>
        <Zap className={cn(
          "h-3.5 w-3.5 text-primary",
          isAnimating && "animate-bounce"
        )} />
        <span className="text-sm font-bold text-primary tabular-nums">
          {displayXP}
        </span>
        <span className="text-xs text-primary/70">XP</span>
      </div>
      
      {/* Sparkle on XP gain */}
      {isAnimating && (
        <Sparkles className="h-4 w-4 text-stardust-gold animate-sparkle" />
      )}
    </div>
  );
}
