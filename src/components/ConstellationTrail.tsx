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

// Fixed constellation pattern - zigzag Y positions for visual interest
const CONSTELLATION_Y_PATTERN = [45, 65, 35, 55, 40, 60, 50]; // Varies between 35-65

// Generate star positions along a constellation-like zigzag path
const generateStarPositions = (count: number) => {
  const positions: { x: number; y: number; size: number }[] = [];
  
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const x = 10 + t * 80; // 10% to 90% width
    const y = CONSTELLATION_Y_PATTERN[i % CONSTELLATION_Y_PATTERN.length];
    const size = i === 0 || i === count - 1 ? 10 : 6 + Math.random() * 4;
    positions.push({ x, y, size });
  }
  
  return positions;
};

// Calculate position along the constellation path for any progress percentage
const getPositionOnPath = (progress: number, starPositions: { x: number; y: number }[]) => {
  if (starPositions.length < 2) return { x: 10, y: 50 };
  
  const t = Math.max(0, Math.min(100, progress)) / 100;
  const totalSegments = starPositions.length - 1;
  const segmentProgress = t * totalSegments;
  const currentSegment = Math.min(Math.floor(segmentProgress), totalSegments - 1);
  const segmentT = segmentProgress - currentSegment;
  
  const start = starPositions[currentSegment];
  const end = starPositions[currentSegment + 1];
  
  return {
    x: start.x + (end.x - start.x) * segmentT,
    y: start.y + (end.y - start.y) * segmentT,
  };
};

// Generate SVG path string connecting all stars with straight lines
const generateFullPathString = (starPositions: { x: number; y: number }[]) => {
  if (starPositions.length < 2) return "";
  return starPositions.map((pos, i) => 
    i === 0 ? `M ${pos.x} ${pos.y}` : `L ${pos.x} ${pos.y}`
  ).join(' ');
};

// Generate partial path up to a certain progress percentage
const generatePartialPathString = (starPositions: { x: number; y: number }[], progress: number) => {
  if (starPositions.length < 2 || progress <= 0) return "";
  
  const endPos = getPositionOnPath(progress, starPositions);
  const t = Math.max(0, Math.min(100, progress)) / 100;
  const totalSegments = starPositions.length - 1;
  const segmentProgress = t * totalSegments;
  const completedSegments = Math.floor(segmentProgress);
  
  let path = `M ${starPositions[0].x} ${starPositions[0].y}`;
  
  // Add all completed segments
  for (let i = 1; i <= completedSegments && i < starPositions.length; i++) {
    path += ` L ${starPositions[i].x} ${starPositions[i].y}`;
  }
  
  // Add partial segment to current position
  if (completedSegments < totalSegments) {
    path += ` L ${endPos.x} ${endPos.y}`;
  }
  
  return path;
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
  // Create milestone checkpoints dynamically from narrative checkpoints
  const milestones = useMemo(() => {
    if (narrativeCheckpoints && narrativeCheckpoints.length > 0) {
      // Add 0 (start) + all chapter milestone percentages
      return [0, ...narrativeCheckpoints.map(cp => cp.progressPercent)];
    }
    return [0, 25, 50, 75, 100]; // Fallback for non-narrative epics
  }, [narrativeCheckpoints]);
  
  const starPositions = useMemo(() => generateStarPositions(milestones.length), [milestones.length]);
  
  // Get checkpoint label for a milestone index
  const getCheckpointLabel = (index: number, milestone: number): { label: string; isRevealed: boolean; isFinale: boolean } => {
    // Index 0 is always "Start"
    if (index === 0) {
      return { label: "Start", isRevealed: true, isFinale: false };
    }
    
    // For narrative epics, use checkpoint data directly
    if (narrativeCheckpoints && narrativeCheckpoints.length > 0) {
      const checkpoint = narrativeCheckpoints[index - 1]; // -1 because index 0 is "Start"
      if (checkpoint) {
        return {
          label: checkpoint.locationRevealed ? checkpoint.locationName || `Ch.${checkpoint.chapter}` : "?",
          isRevealed: checkpoint.locationRevealed,
          isFinale: checkpoint.isFinale
        };
      }
    }
    
    // Fallback for non-narrative epics - show "?" until reached
    const isReached = progress >= milestone;
    const isFinale = milestone === 100;
    return { 
      label: isReached ? (isFinale ? "Legend" : `${milestone}%`) : "?",
      isRevealed: isReached,
      isFinale
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

      {/* Trail paths SVG */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          {/* Animated pulsing gradient that travels along the path */}
          <linearGradient id="pulseGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary) / 0.15)" />
            <stop offset="40%" stopColor="hsl(var(--primary) / 0.15)" />
            <stop offset="50%" stopColor="hsl(var(--primary) / 0.8)" />
            <stop offset="60%" stopColor="hsl(var(--primary) / 0.15)" />
            <stop offset="100%" stopColor="hsl(var(--primary) / 0.15)" />
            <animate attributeName="x1" values="-100%;100%" dur="2.5s" repeatCount="indefinite" />
            <animate attributeName="x2" values="0%;200%" dur="2.5s" repeatCount="indefinite" />
          </linearGradient>
          
          {/* Glow filter for solid trail */}
          <filter id="trailGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* FULL PATH - Base dim path showing entire journey */}
        <path
          d={generateFullPathString(starPositions)}
          fill="none"
          stroke="hsl(var(--muted) / 0.15)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* FULL PATH - Pulsing energy effect */}
        <path
          d={generateFullPathString(starPositions)}
          fill="none"
          stroke="url(#pulseGradient)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />

        {/* SOLID TRAIL - Completed portion behind companion */}
        {progress > 0 && (
          <motion.path
            d={generatePartialPathString(starPositions, progress)}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#trailGlow)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        )}
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
            left: `${getPositionOnPath(progress, starPositions).x}%`,
            top: `${getPositionOnPath(progress, starPositions).y}%`,
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
