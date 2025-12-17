import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { HelpCircle } from "lucide-react";
import type { NarrativeCheckpoint } from "@/types/narrativeTypes";

interface ConstellationTrailProps {
  progress: number; // 0-100
  targetDays: number;
  className?: string;
  companionImageUrl?: string;
  companionMood?: string;
  showCompanion?: boolean;
  narrativeCheckpoints?: NarrativeCheckpoint[];
}

// Generate star positions along a curved path
const generateStarPositions = (count: number) => {
  const positions: { x: number; y: number; size: number }[] = [];
  
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    // Create a gentle wave/arc path
    const x = 10 + t * 80; // 10% to 90% width
    const y = 50 + Math.sin(t * Math.PI * 1.5) * 25; // Wavy path
    const size = i === 0 || i === count - 1 ? 10 : 6 + Math.random() * 4;
    positions.push({ x, y, size });
  }
  
  return positions;
};

// Calculate position along the wave path for any progress percentage
const getPositionOnPath = (progress: number) => {
  const t = Math.max(0, Math.min(100, progress)) / 100;
  const x = 10 + t * 80;
  const y = 50 + Math.sin(t * Math.PI * 1.5) * 25;
  return { x, y };
};

// Get mood-based filter styles
const getMoodStyles = (mood?: string) => {
  switch (mood) {
    case 'sick':
      return 'saturate-50 brightness-75';
    case 'sad':
      return 'saturate-75 brightness-90';
    case 'worried':
      return 'saturate-90';
    default:
      return '';
  }
};

export const ConstellationTrail = ({ 
  progress, 
  targetDays,
  className,
  companionImageUrl,
  companionMood,
  showCompanion = true,
  narrativeCheckpoints
}: ConstellationTrailProps) => {
  // Create milestone checkpoints (start, 25%, 50%, 75%, 100%)
  const milestones = useMemo(() => [0, 25, 50, 75, 100], []);
  const starPositions = useMemo(() => generateStarPositions(5), []);
  
  // Get checkpoint label for a milestone index
  const getCheckpointLabel = (index: number, milestone: number): { label: string; isRevealed: boolean; isFinale: boolean } => {
    if (!narrativeCheckpoints || narrativeCheckpoints.length === 0) {
      // Default labels when no narrative checkpoints
      return { 
        label: milestone === 0 ? "Start" : milestone === 100 ? "Legend" : `${milestone}%`,
        isRevealed: true,
        isFinale: milestone === 100
      };
    }
    
    // Map milestone index to narrative checkpoint
    const checkpoint = narrativeCheckpoints.find(cp => cp.progressPercent === milestone);
    if (checkpoint) {
      return {
        label: checkpoint.locationRevealed ? checkpoint.locationName || `Ch.${checkpoint.chapter}` : "?",
        isRevealed: checkpoint.locationRevealed,
        isFinale: checkpoint.isFinale
      };
    }
    
    return { 
      label: milestone === 0 ? "Start" : `${milestone}%`,
      isRevealed: true,
      isFinale: false
    };
  };
  
  // Background stars for ambiance - use seeded pseudo-random for consistency
  const bgStars = useMemo(() => {
    // Simple seeded random function for consistent star positions across renders
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed * 9999) * 10000;
      return x - Math.floor(x);
    };
    
    return Array.from({ length: 20 }, (_, i) => ({
      x: seededRandom(i * 1) * 100,
      y: seededRandom(i * 2 + 0.5) * 100,
      size: 1 + seededRandom(i * 3 + 0.7) * 2,
      delay: seededRandom(i * 4 + 0.3) * 3,
      duration: 2 + seededRandom(i * 5 + 0.9) * 2,
    }));
  }, []);

  return (
    <div className={cn(
      "relative w-full h-32 rounded-xl overflow-hidden",
      "bg-gradient-to-br from-slate-950 via-purple-950/50 to-slate-950",
      className
    )}>
      {/* Nebula glow effect */}
      <div className="absolute inset-0 opacity-40">
        <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-primary/30 rounded-full blur-xl" />
        <div className="absolute top-1/3 right-1/4 w-16 h-16 bg-purple-500/20 rounded-full blur-lg" />
      </div>

      {/* Background twinkling stars */}
      {bgStars.map((star, i) => (
        <motion.div
          key={`bg-${i}`}
          className="absolute rounded-full bg-white/60"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
          }}
          animate={{
            opacity: [0.2, 0.8, 0.2],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: star.duration,
            delay: star.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Connection lines between stars */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {starPositions.slice(0, -1).map((pos, i) => {
          const nextPos = starPositions[i + 1];
          const isLit = progress >= milestones[i + 1];
          const isPartiallyLit = progress > milestones[i] && progress < milestones[i + 1];
          
          return (
            <motion.line
              key={`line-${i}`}
              x1={pos.x}
              y1={pos.y}
              x2={nextPos.x}
              y2={nextPos.y}
              stroke={isLit ? "hsl(var(--primary))" : isPartiallyLit ? "hsl(var(--primary) / 0.4)" : "hsl(var(--muted) / 0.2)"}
              strokeWidth={isLit ? 0.8 : 0.4}
              strokeDasharray={isPartiallyLit ? "2,2" : "none"}
              initial={{ pathLength: 0 }}
              animate={{ 
                pathLength: isLit || isPartiallyLit ? 1 : 0.3,
                opacity: isLit ? 1 : 0.5
              }}
              transition={{ duration: 1, delay: i * 0.2 }}
            />
          );
        })}
      </svg>

      {/* Milestone stars */}
      {starPositions.map((pos, i) => {
        const milestone = milestones[i];
        const isCompleted = progress >= milestone;
        const isCurrent = progress >= milestone && (i === milestones.length - 1 || progress < milestones[i + 1]);
        
        return (
          <motion.div
            key={`star-${i}`}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.15, duration: 0.5 }}
          >
            {/* Glow effect for completed/current stars */}
            {isCompleted && (
              <motion.div
                className={cn(
                  "absolute inset-0 rounded-full",
                  isCurrent ? "bg-primary" : "bg-primary/50"
                )}
                style={{
                  width: pos.size * 3,
                  height: pos.size * 3,
                  marginLeft: -pos.size,
                  marginTop: -pos.size,
                  filter: "blur(8px)",
                }}
                animate={isCurrent ? {
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 0.8, 0.5],
                } : {}}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            )}
            
            {/* Star core */}
            <motion.div
              className={cn(
                "rounded-full relative z-10",
                isCompleted 
                  ? "bg-gradient-to-br from-primary via-purple-400 to-primary shadow-[0_0_10px_rgba(167,108,255,0.5)]" 
                  : "bg-muted/30 border border-muted/50"
              )}
              style={{
                width: pos.size,
                height: pos.size,
              }}
              animate={isCurrent ? {
                boxShadow: [
                  "0 0 10px rgba(167,108,255,0.5)",
                  "0 0 20px rgba(167,108,255,0.8)",
                  "0 0 10px rgba(167,108,255,0.5)",
                ],
              } : {}}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            {/* Milestone label */}
            {(() => {
              const { label, isRevealed, isFinale } = getCheckpointLabel(i, milestone);
              return (
                <div className={cn(
                  "absolute top-full mt-1 left-1/2 -translate-x-1/2 text-[10px] font-medium whitespace-nowrap flex items-center gap-0.5",
                  isCompleted ? "text-primary" : "text-muted-foreground/50",
                  isFinale && isCompleted && "text-yellow-400"
                )}>
                  {!isRevealed && !isCompleted ? (
                    <HelpCircle className="w-3 h-3 animate-pulse" />
                  ) : (
                    <span className={cn(
                      isRevealed && isCompleted && "font-semibold"
                    )}>
                      {label}
                    </span>
                  )}
                </div>
              );
            })()}
          </motion.div>
        );
      })}

      {/* Companion Avatar on Trail */}
      {showCompanion && companionImageUrl && (
        <motion.div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
          style={{
            left: `${getPositionOnPath(progress).x}%`,
            top: `${getPositionOnPath(progress).y}%`,
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: 1, 
            opacity: 1,
            y: [0, -4, 0],
          }}
          transition={{
            scale: { duration: 0.5 },
            opacity: { duration: 0.5 },
            y: { duration: 2, repeat: Infinity, ease: "easeInOut" }
          }}
        >
          {/* Glow ring */}
          <motion.div
            className="absolute inset-0 rounded-full bg-primary/40"
            style={{
              width: 36,
              height: 36,
              marginLeft: -4,
              marginTop: -4,
              filter: "blur(6px)",
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.4, 0.7, 0.4],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          
          {/* Companion image */}
          <div 
            className={cn(
              "w-7 h-7 rounded-full border-2 border-primary overflow-hidden bg-background shadow-lg",
              getMoodStyles(companionMood)
            )}
          >
            <img 
              src={companionImageUrl} 
              alt="Companion" 
              className="w-full h-full object-cover"
            />
          </div>
        </motion.div>
      )}

      {/* Progress indicator */}
      <div className="absolute bottom-2 right-3 flex items-center gap-1.5">
        <div className="text-xs font-bold text-primary">
          {progress}%
        </div>
        <div className="w-8 h-1 bg-muted/20 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-purple-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1 }}
          />
        </div>
      </div>

      {/* Journey label */}
      <div className="absolute top-2 left-3 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
        Star Path Journey
      </div>
    </div>
  );
};
