import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { useMotionProfile } from "@/hooks/useMotionProfile";

interface GamifiedProgressProps {
  value: number; // 0-100
  completedCount: number;
  totalCount: number;
  className?: string;
}

export function GamifiedProgress({ value, completedCount, totalCount, className }: GamifiedProgressProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const [showMilestoneSparkle, setShowMilestoneSparkle] = useState<number | null>(null);
  const prevValueRef = useRef(value);
  const { capabilities, profile } = useMotionProfile();
  
  const milestones = [25, 50, 75, 100];
  
  // Animate progress bar fill
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValue(value);
    }, 100);
    return () => clearTimeout(timer);
  }, [value]);
  
  // Check for milestone crossing
  useEffect(() => {
    const prevValue = prevValueRef.current;
    milestones.forEach(milestone => {
      if (prevValue < milestone && value >= milestone) {
        setShowMilestoneSparkle(milestone);
        setTimeout(() => setShowMilestoneSparkle(null), profile === "reduced" ? 300 : 1200);
      }
    });
    prevValueRef.current = value;
  }, [profile, value]);
  
  // Determine color based on progress - purple → blue → gold journey
  const getProgressColor = () => {
    if (value >= 100) return "from-stardust-gold via-amber-400 to-stardust-gold";
    if (value >= 75) return "from-celestial-blue via-stardust-gold to-stardust-gold";
    if (value >= 50) return "from-primary via-celestial-blue to-celestial-blue";
    if (value >= 25) return "from-primary via-primary to-celestial-blue";
    return "from-primary to-primary";
  };
  
  return (
    <div className={cn("space-y-2", className)}>
      {/* Progress Labels */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Progress: {completedCount}/{totalCount}
        </span>
        <span className={cn(
          "font-semibold transition-colors",
          value >= 100 ? "text-stardust-gold" : "text-primary"
        )}>
          {Math.round(value)}%
        </span>
      </div>
      
      {/* Progress Bar Container */}
      <div className="relative h-3 bg-muted/50 rounded-full overflow-hidden">
        {/* Milestone Markers */}
        {milestones.map(milestone => (
          <div
            key={milestone}
            className="absolute top-0 bottom-0 w-0.5 bg-muted-foreground/30 z-10"
            style={{ left: `${milestone}%` }}
          >
            {/* Milestone sparkle animation */}
            {showMilestoneSparkle === milestone && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 animate-milestone-sparkle">
                <Sparkles className="h-4 w-4 text-stardust-gold" />
              </div>
            )}
          </div>
        ))}
        
        {/* Animated Fill */}
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden",
            "bg-gradient-to-r",
            getProgressColor(),
            value >= 75 && value < 100 && capabilities.allowBackgroundAnimation && "shadow-[0_0_18px_hsl(var(--primary)/0.35)]"
          )}
          style={{ width: `${animatedValue}%` }}
        >
          {/* Shimmer overlay */}
          {capabilities.allowBackgroundAnimation && (
            <div 
              className="absolute inset-0 animate-shimmer-slide"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                backgroundSize: '200% 100%',
              }}
            />
          )}
          
          {/* Glow effect at 100% */}
          {value >= 100 && capabilities.allowBackgroundAnimation && (
            <div className="absolute inset-0 animate-pulse-glow bg-stardust-gold/30" />
          )}
        </div>
        
        {/* Particle effects at completion */}
        {value >= 100 && capabilities.allowBackgroundAnimation && (
          <>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-stardust-gold rounded-full animate-ping" />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 w-1 h-1 bg-white rounded-full animate-ping" style={{ animationDelay: '150ms' }} />
          </>
        )}
      </div>
      
      {/* Milestone Labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground/60 px-1">
        {milestones.map(milestone => (
          <span 
            key={milestone}
            className={cn(
              "transition-colors",
              value >= milestone && milestone === 100 && "text-stardust-gold font-bold",
              value >= milestone && milestone === 75 && "text-stardust-gold/80 font-medium",
              value >= milestone && milestone === 50 && "text-celestial-blue font-medium",
              value >= milestone && milestone === 25 && "text-celestial-blue/80 font-medium"
            )}
          >
            {milestone}%
          </span>
        ))}
      </div>
    </div>
  );
}
