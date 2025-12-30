import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { HelpCircle, MapPin } from "lucide-react";

// Milestone from epic_milestones table
interface TrailMilestone {
  id: string;
  title: string;
  milestone_percent: number;
  is_postcard_milestone?: boolean | null;
  completed_at?: string | null;
}

interface ConstellationTrailProps {
  progress: number; // 0-100
  targetDays: number;
  className?: string;
  companionImageUrl?: string;
  companionMood?: string;
  showCompanion?: boolean;
  milestones?: TrailMilestone[]; // Actual milestones from database
}

// Fixed constellation pattern - zigzag Y positions for visual interest
const CONSTELLATION_Y_PATTERN = [45, 65, 35, 55, 40, 60, 50];

// Generate star positions along a constellation-like zigzag path
const generateStarPositions = (count: number) => {
  const positions: { x: number; y: number; size: number }[] = [];
  
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const x = 10 + t * 80;
    const y = CONSTELLATION_Y_PATTERN[i % CONSTELLATION_Y_PATTERN.length];
    const size = i === 0 || i === count - 1 ? 10 : 6 + Math.random() * 4;
    positions.push({ x, y, size });
  }
  
  return positions;
};

// Calculate position along the constellation path
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

// Generate SVG path string connecting all stars
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
  
  for (let i = 1; i <= completedSegments && i < starPositions.length; i++) {
    path += ` L ${starPositions[i].x} ${starPositions[i].y}`;
  }
  
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
  milestones: propMilestones
}: ConstellationTrailProps) => {
  // Sort milestones by percentage and include start (0%)
  const sortedMilestones = useMemo(() => {
    if (!propMilestones || propMilestones.length === 0) {
      return [
        { id: 'start', title: 'Start', milestone_percent: 0, is_postcard_milestone: false, completed_at: null },
        { id: 'end', title: 'Finish', milestone_percent: 100, is_postcard_milestone: true, completed_at: null },
      ];
    }
    
    const withStart: TrailMilestone[] = [
      { id: 'start', title: 'Start', milestone_percent: 0, is_postcard_milestone: false, completed_at: new Date().toISOString() },
      ...propMilestones,
    ];
    
    return withStart.sort((a, b) => a.milestone_percent - b.milestone_percent);
  }, [propMilestones]);
  
  const starPositions = useMemo(() => generateStarPositions(sortedMilestones.length), [sortedMilestones.length]);
  
  const bgStars = useMemo(() => {
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
          <linearGradient id="pulseGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary) / 0.15)" />
            <stop offset="40%" stopColor="hsl(var(--primary) / 0.15)" />
            <stop offset="50%" stopColor="hsl(var(--primary) / 0.8)" />
            <stop offset="60%" stopColor="hsl(var(--primary) / 0.15)" />
            <stop offset="100%" stopColor="hsl(var(--primary) / 0.15)" />
            <animate attributeName="x1" values="-100%;100%" dur="2.5s" repeatCount="indefinite" />
            <animate attributeName="x2" values="0%;200%" dur="2.5s" repeatCount="indefinite" />
          </linearGradient>
          
          <filter id="trailGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          d={generateFullPathString(starPositions)}
          fill="none"
          stroke="hsl(var(--muted) / 0.15)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d={generateFullPathString(starPositions)}
          fill="none"
          stroke="url(#pulseGradient)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />

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
        const milestone = sortedMilestones[i];
        const milestonePercent = milestone.milestone_percent;
        const isCompleted = progress >= milestonePercent || !!milestone.completed_at;
        const nextMilestonePercent = i < sortedMilestones.length - 1 ? sortedMilestones[i + 1].milestone_percent : 101;
        const isCurrent = progress >= milestonePercent && progress < nextMilestonePercent;
        const isPostcard = milestone.is_postcard_milestone;
        const isFinale = milestonePercent === 100 || i === sortedMilestones.length - 1;
        const isStart = i === 0;
        
        const starSize = isPostcard ? pos.size * 1.3 : pos.size;
        
        return (
          <motion.div
            key={`star-${milestone.id}`}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
          >
            {isCompleted && (
              <motion.div
                className={cn(
                  "absolute inset-0 rounded-full",
                  isPostcard 
                    ? (isCurrent ? "bg-yellow-400" : "bg-yellow-400/50")
                    : (isCurrent ? "bg-primary" : "bg-primary/50")
                )}
                style={{
                  width: starSize * 3,
                  height: starSize * 3,
                  marginLeft: -starSize,
                  marginTop: -starSize,
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
            
            <motion.div
              className={cn(
                "rounded-full relative z-10",
                isCompleted 
                  ? isPostcard
                    ? "bg-gradient-to-br from-yellow-400 via-amber-300 to-yellow-500 shadow-[0_0_10px_rgba(250,204,21,0.5)]"
                    : "bg-gradient-to-br from-primary via-purple-400 to-primary shadow-[0_0_10px_rgba(167,108,255,0.5)]" 
                  : "bg-muted/30 border border-muted/50"
              )}
              style={{
                width: starSize,
                height: starSize,
              }}
              animate={isCurrent ? {
                boxShadow: isPostcard ? [
                  "0 0 10px rgba(250,204,21,0.5)",
                  "0 0 20px rgba(250,204,21,0.8)",
                  "0 0 10px rgba(250,204,21,0.5)",
                ] : [
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

            <div className={cn(
              "absolute top-full mt-1 left-1/2 -translate-x-1/2 text-[10px] font-medium whitespace-nowrap flex items-center gap-0.5 max-w-[60px] overflow-hidden",
              isCompleted ? (isPostcard ? "text-yellow-400" : "text-primary") : "text-muted-foreground/50",
              isFinale && isCompleted && "text-yellow-400"
            )}>
              {isStart ? (
                <span className="font-semibold">Start</span>
              ) : !isCompleted ? (
                <HelpCircle className="w-3 h-3 animate-pulse" />
              ) : isPostcard ? (
                <MapPin className="w-3 h-3" />
              ) : (
                <span className="truncate">{milestone.title.slice(0, 8)}</span>
              )}
            </div>
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
