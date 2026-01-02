import { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { HelpCircle, MapPin, Sparkles, Lock, Star, Zap } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { useJourneyPathImage } from "@/hooks/useJourneyPathImage";

// Milestone from epic_milestones table
interface TrailMilestone {
  id: string;
  title: string;
  milestone_percent: number;
  is_postcard_milestone?: boolean | null;
  completed_at?: string | null;
  // Extended fields for teaser content
  description?: string | null;
  phase_name?: string | null;
  target_date?: string | null;
  chapter_number?: number | null;
}

interface ConstellationTrailProps {
  progress: number; // 0-100
  targetDays: number;
  className?: string;
  companionImageUrl?: string;
  companionMood?: string;
  showCompanion?: boolean;
  milestones?: TrailMilestone[]; // Actual milestones from database
  epicId?: string; // For fetching journey path background
}

// Fixed constellation pattern - wave with more vertical variation for taller container
const CONSTELLATION_Y_PATTERN = [70, 40, 60, 25, 75, 35, 55, 45];

// Generate star positions along a constellation-like path with wave pattern
const generateStarPositions = (count: number) => {
  const positions: { x: number; y: number; size: number }[] = [];
  
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const x = 8 + t * 84;
    // Add sine wave variation for more organic feel
    const baseY = CONSTELLATION_Y_PATTERN[i % CONSTELLATION_Y_PATTERN.length];
    const waveOffset = Math.sin(t * Math.PI * 2) * 8;
    const y = baseY + waveOffset;
    const size = i === 0 || i === count - 1 ? 10 : 6 + Math.random() * 4;
    positions.push({ x, y, size });
  }
  
  return positions;
};

// Calculate position along the smooth curved path
const getPositionOnPath = (progress: number, starPositions: { x: number; y: number }[]) => {
  if (starPositions.length < 2) return { x: 10, y: 50 };
  
  const t = Math.max(0, Math.min(100, progress)) / 100;
  const totalSegments = starPositions.length - 1;
  const segmentProgress = t * totalSegments;
  const currentSegment = Math.min(Math.floor(segmentProgress), totalSegments - 1);
  const segmentT = segmentProgress - currentSegment;
  
  const start = starPositions[currentSegment];
  const end = starPositions[currentSegment + 1];
  
  // Use smooth interpolation with control point
  const midX = (start.x + end.x) / 2;
  const controlY = (start.y + end.y) / 2 + (currentSegment % 2 === 0 ? -10 : 10);
  
  // Quadratic bezier interpolation
  const oneMinusT = 1 - segmentT;
  const x = oneMinusT * oneMinusT * start.x + 2 * oneMinusT * segmentT * midX + segmentT * segmentT * end.x;
  const y = oneMinusT * oneMinusT * start.y + 2 * oneMinusT * segmentT * controlY + segmentT * segmentT * end.y;
  
  return { x, y };
};

// Generate smooth curved SVG path with Bezier curves and a decorative loop
const generateFullPathString = (starPositions: { x: number; y: number }[]) => {
  if (starPositions.length < 2) return "";
  
  let path = `M ${starPositions[0].x} ${starPositions[0].y}`;
  
  for (let i = 1; i < starPositions.length; i++) {
    const prev = starPositions[i - 1];
    const curr = starPositions[i];
    const midX = (prev.x + curr.x) / 2;
    const controlY = (prev.y + curr.y) / 2 + (i % 2 === 0 ? -12 : 12);
    
    // Add a small decorative loop at ~40% of the journey
    if (i === Math.max(1, Math.floor(starPositions.length * 0.4))) {
      const loopX = midX;
      const loopY = (prev.y + curr.y) / 2;
      // Curve to loop start
      path += ` Q ${midX - 5} ${controlY} ${loopX - 4} ${loopY}`;
      // The loop - a small arc
      path += ` C ${loopX - 8} ${loopY - 12} ${loopX + 8} ${loopY - 12} ${loopX + 4} ${loopY}`;
      // Continue to current point
      path += ` Q ${midX + 5} ${controlY} ${curr.x} ${curr.y}`;
    } else {
      // Smooth quadratic curve
      path += ` Q ${midX} ${controlY} ${curr.x} ${curr.y}`;
    }
  }
  
  return path;
};

// Generate partial smooth curved path up to a certain progress percentage
const generatePartialPathString = (starPositions: { x: number; y: number }[], progress: number) => {
  if (starPositions.length < 2 || progress <= 0) return "";
  
  const endPos = getPositionOnPath(progress, starPositions);
  const t = Math.max(0, Math.min(100, progress)) / 100;
  const totalSegments = starPositions.length - 1;
  const segmentProgress = t * totalSegments;
  const completedSegments = Math.floor(segmentProgress);
  
  let path = `M ${starPositions[0].x} ${starPositions[0].y}`;
  
  // Draw curved segments up to completed segments
  for (let i = 1; i <= completedSegments && i < starPositions.length; i++) {
    const prev = starPositions[i - 1];
    const curr = starPositions[i];
    const midX = (prev.x + curr.x) / 2;
    const controlY = (prev.y + curr.y) / 2 + (i % 2 === 0 ? -12 : 12);
    
    // Handle the loop segment
    if (i === Math.max(1, Math.floor(starPositions.length * 0.4))) {
      const loopX = midX;
      const loopY = (prev.y + curr.y) / 2;
      path += ` Q ${midX - 5} ${controlY} ${loopX - 4} ${loopY}`;
      path += ` C ${loopX - 8} ${loopY - 12} ${loopX + 8} ${loopY - 12} ${loopX + 4} ${loopY}`;
      path += ` Q ${midX + 5} ${controlY} ${curr.x} ${curr.y}`;
    } else {
      path += ` Q ${midX} ${controlY} ${curr.x} ${curr.y}`;
    }
  }
  
  // Draw partial segment to current progress position
  if (completedSegments < totalSegments) {
    path += ` L ${endPos.x} ${endPos.y}`;
  }
  
  return path;
};

// Mystery Milestone Popover Component
const MysteryMilestonePopover = ({ 
  milestone, 
  currentProgress,
  isPostcard 
}: { 
  milestone: TrailMilestone; 
  currentProgress: number;
  isPostcard: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const progressToMilestone = milestone.milestone_percent - currentProgress;
  const progressPercent = Math.min(100, Math.max(0, (currentProgress / milestone.milestone_percent) * 100));
  
  // Prevent background scroll on iOS when popover is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);
  
  const handleTap = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      // Haptics not available
    }
    setIsOpen(true);
  };
  
  const getTeaserText = () => {
    if (isPostcard) {
      const chapterText = milestone.chapter_number 
        ? `Chapter ${milestone.chapter_number}` 
        : "A new chapter";
      return `A cosmic postcard is forming in the starlight... ${chapterText} of your companion's tale awaits.`;
    }
    return "A new milestone on your journey awaits... Keep going to discover what lies ahead.";
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {/* 44x44px touch target for accessibility */}
        <button
          onClick={handleTap}
          className={cn(
            "w-11 h-11 -m-4 flex items-center justify-center",
            "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-full",
            "group transition-all duration-200",
            "active:scale-90 active:bg-white/5" // Android touch feedback
          )}
          aria-label={`Unlock milestone at ${milestone.milestone_percent}%`}
        >
          <motion.div
            className={cn(
              "w-4 h-4 rounded-full flex items-center justify-center",
              isPostcard ? "text-amber-400/70" : "text-purple-400/70",
              "group-hover:scale-125 transition-transform"
            )}
            animate={{ 
              opacity: [0.5, 1, 0.5],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </motion.div>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className={cn(
          "w-64 p-0 border overflow-hidden shadow-xl",
          // Backdrop blur with fallback for older Android
          "supports-[backdrop-filter]:backdrop-blur-xl",
          isPostcard 
            ? "bg-gradient-to-br from-amber-950/98 via-yellow-950/95 to-slate-950/98 border-amber-500/20" 
            : "bg-gradient-to-br from-purple-950/98 via-slate-950/95 to-slate-950/98 border-purple-500/20"
        )}
        sideOffset={12}
        collisionPadding={{ top: 50, bottom: 50, left: 16, right: 16 }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ 
            type: "spring",
            stiffness: 300,
            damping: 25
          }}
        >
          {/* Sparkle decorations with AnimatePresence for cleanup */}
          <AnimatePresence>
            {isOpen && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                  className={cn(
                    "absolute top-3 right-4",
                    isPostcard ? "text-amber-400/40" : "text-purple-400/40"
                  )}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1,
                    rotate: 360 
                  }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ 
                    opacity: { duration: 0.3 },
                    rotate: { duration: 4, repeat: Infinity, ease: "linear" }
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                </motion.div>
                <motion.div
                  className={cn(
                    "absolute bottom-6 left-3",
                    isPostcard ? "text-amber-400/25" : "text-purple-400/25"
                  )}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    opacity: 1, 
                    scale: [1, 1.3, 1],
                    rotate: -360 
                  }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ 
                    opacity: { duration: 0.3, delay: 0.1 },
                    scale: { duration: 3, repeat: Infinity },
                    rotate: { duration: 5, repeat: Infinity, ease: "linear" }
                  }}
                >
                  <Star className="w-3 h-3" />
                </motion.div>
                {/* Extra floating particle */}
                <motion.div
                  className={cn(
                    "absolute top-1/2 right-6 w-1.5 h-1.5 rounded-full",
                    isPostcard ? "bg-amber-400/30" : "bg-purple-400/30"
                  )}
                  initial={{ opacity: 0 }}
                  animate={{ 
                    opacity: [0, 1, 0],
                    y: [0, -10, 0],
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ 
                    duration: 2,
                    repeat: Infinity,
                    delay: 0.5
                  }}
                />
              </div>
            )}
          </AnimatePresence>
          
          <div className="p-4 relative z-10">
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <motion.div 
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  isPostcard 
                    ? "bg-amber-500/20 text-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.3)]" 
                    : "bg-purple-500/20 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.3)]"
                )}
                animate={{ 
                  boxShadow: isPostcard 
                    ? ["0 0 12px rgba(251,191,36,0.3)", "0 0 20px rgba(251,191,36,0.5)", "0 0 12px rgba(251,191,36,0.3)"]
                    : ["0 0 12px rgba(168,85,247,0.3)", "0 0 20px rgba(168,85,247,0.5)", "0 0 12px rgba(168,85,247,0.3)"]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Lock className="w-4 h-4" />
              </motion.div>
              <div>
                <h4 className="text-sm font-bold text-white leading-tight">Mystery Awaits...</h4>
                <p className={cn(
                  "text-xs leading-tight",
                  isPostcard ? "text-amber-400/80" : "text-purple-400/80"
                )}>
                  {isPostcard ? "Postcard Milestone" : "Journey Milestone"}
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className={cn(
              "h-px w-full mb-3",
              isPostcard ? "bg-amber-400/20" : "bg-purple-400/20"
            )} />

            {/* Progress Ring */}
            <div className="flex items-center gap-4 mb-4">
              <div className="relative w-12 h-12 flex-shrink-0">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="text-white/10"
                  />
                  <motion.circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className={isPostcard ? "text-amber-400" : "text-purple-400"}
                    initial={{ strokeDasharray: "0 100" }}
                    animate={{ strokeDasharray: `${progressPercent * 0.88} 100` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </svg>
                <span className={cn(
                  "absolute inset-0 flex items-center justify-center text-xs font-bold",
                  isPostcard ? "text-amber-400" : "text-purple-400"
                )}>
                  {Math.round(progressPercent)}%
                </span>
              </div>
              <div className="flex-1">
                <p className="text-xs text-white/60 leading-snug">Unlock at</p>
                <p className={cn(
                  "text-lg font-bold leading-tight",
                  isPostcard ? "text-amber-400" : "text-purple-400"
                )}>
                  {milestone.milestone_percent}%
                </p>
                <p className="text-xs text-white/50 leading-snug">
                  {progressToMilestone > 0 ? `${Math.round(progressToMilestone)}% to go` : "Almost there!"}
                </p>
              </div>
            </div>

            {/* Teaser Text */}
            <p className="text-xs text-white/75 leading-relaxed italic mb-3">
              "{getTeaserText()}"
            </p>

            {/* Phase & Date Info */}
            {(milestone.phase_name || milestone.target_date) && (
              <div className="flex flex-wrap gap-2">
                {milestone.phase_name && (
                  <span className={cn(
                    "px-2 py-1 rounded-md text-[11px] font-medium",
                    isPostcard ? "bg-amber-400/10 text-amber-400/70" : "bg-purple-400/10 text-purple-400/70"
                  )}>
                    {milestone.phase_name}
                  </span>
                )}
                {milestone.target_date && (
                  <span className={cn(
                    "px-2 py-1 rounded-md text-[11px] font-medium",
                    isPostcard ? "bg-amber-400/10 text-amber-400/70" : "bg-purple-400/10 text-purple-400/70"
                  )}>
                    Est. {format(new Date(milestone.target_date), "MMM d")}
                  </span>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </PopoverContent>
    </Popover>
  );
};

// Milestone Reveal Animation Component
const MilestoneRevealAnimation = ({ 
  isRevealing,
  isPostcard,
  onComplete
}: { 
  isRevealing: boolean;
  isPostcard: boolean;
  onComplete: () => void;
}) => {
  useEffect(() => {
    if (isRevealing) {
      // Trigger haptic feedback for milestone unlock
      const triggerHaptic = async () => {
        try {
          await Haptics.notification({ type: NotificationType.Success });
        } catch {
          // Haptics not available
        }
      };
      triggerHaptic();
      
      // Auto-complete animation after duration
      const timer = setTimeout(onComplete, 2000);
      return () => clearTimeout(timer);
    }
  }, [isRevealing, onComplete]);

  return (
    <AnimatePresence>
      {isRevealing && (
        <>
          {/* Expanding ring burst */}
          <motion.div
            className={cn(
              "absolute inset-0 rounded-full border-2",
              isPostcard ? "border-amber-400" : "border-purple-400"
            )}
            initial={{ scale: 0.5, opacity: 1 }}
            animate={{ scale: 4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ 
              width: 20, 
              height: 20,
              marginLeft: -10,
              marginTop: -10,
            }}
          />
          
          {/* Second ring with delay */}
          <motion.div
            className={cn(
              "absolute inset-0 rounded-full border",
              isPostcard ? "border-amber-400/50" : "border-purple-400/50"
            )}
            initial={{ scale: 0.5, opacity: 1 }}
            animate={{ scale: 5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
            style={{ 
              width: 20, 
              height: 20,
              marginLeft: -10,
              marginTop: -10,
            }}
          />
          
          {/* Central glow burst */}
          <motion.div
            className={cn(
              "absolute rounded-full",
              isPostcard ? "bg-amber-400" : "bg-purple-400"
            )}
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{ scale: [0, 2.5, 0], opacity: [0.8, 0.4, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{ 
              width: 24, 
              height: 24,
              marginLeft: -12,
              marginTop: -12,
              filter: "blur(6px)",
            }}
          />
          
          {/* Particle explosions */}
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * Math.PI * 2;
            const distance = 30 + Math.random() * 20;
            return (
              <motion.div
                key={`particle-${i}`}
                className={cn(
                  "absolute w-1.5 h-1.5 rounded-full",
                  isPostcard ? "bg-amber-400" : "bg-purple-400"
                )}
                initial={{ 
                  x: 0, 
                  y: 0, 
                  scale: 1, 
                  opacity: 1 
                }}
                animate={{ 
                  x: Math.cos(angle) * distance,
                  y: Math.sin(angle) * distance,
                  scale: 0,
                  opacity: 0,
                }}
                exit={{ opacity: 0 }}
                transition={{ 
                  duration: 0.6 + Math.random() * 0.3,
                  ease: "easeOut",
                  delay: Math.random() * 0.1
                }}
                style={{
                  marginLeft: -3,
                  marginTop: -3,
                }}
              />
            );
          })}
          
          {/* Sparkle icon burst */}
          <motion.div
            className={cn(
              "absolute",
              isPostcard ? "text-amber-400" : "text-purple-400"
            )}
            initial={{ scale: 0, rotate: 0, opacity: 1 }}
            animate={{ 
              scale: [0, 1.5, 0],
              rotate: 180,
              opacity: [1, 1, 0]
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{
              marginLeft: -8,
              marginTop: -30,
            }}
          >
            <Sparkles className="w-4 h-4" />
          </motion.div>
          
          {/* Star burst */}
          <motion.div
            className={cn(
              "absolute",
              isPostcard ? "text-yellow-300" : "text-purple-300"
            )}
            initial={{ scale: 0, rotate: 0, opacity: 1 }}
            animate={{ 
              scale: [0, 1.2, 0],
              rotate: -90,
              opacity: [1, 1, 0]
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
            style={{
              marginLeft: 15,
              marginTop: -20,
            }}
          >
            <Star className="w-3 h-3" />
          </motion.div>
          
          {/* Zap icon for energy */}
          <motion.div
            className={cn(
              "absolute",
              isPostcard ? "text-amber-300" : "text-purple-300"
            )}
            initial={{ scale: 0, y: 0, opacity: 1 }}
            animate={{ 
              scale: [0, 1, 0],
              y: -25,
              opacity: [1, 1, 0]
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
            style={{
              marginLeft: -20,
              marginTop: -15,
            }}
          >
            <Zap className="w-3 h-3" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Milestone Star Component with reveal tracking
const MilestoneStar = ({
  milestone,
  pos,
  index,
  progress,
  sortedMilestones,
}: {
  milestone: TrailMilestone;
  pos: { x: number; y: number; size: number };
  index: number;
  progress: number;
  sortedMilestones: TrailMilestone[];
}) => {
  const milestonePercent = milestone.milestone_percent;
  const isCompleted = progress >= milestonePercent || !!milestone.completed_at;
  const nextMilestonePercent = index < sortedMilestones.length - 1 ? sortedMilestones[index + 1].milestone_percent : 101;
  const isCurrent = progress >= milestonePercent && progress < nextMilestonePercent;
  const isPostcard = milestone.is_postcard_milestone;
  const isFinale = milestonePercent === 100 || index === sortedMilestones.length - 1;
  const isStart = index === 0;
  
  const starSize = isPostcard ? pos.size * 1.3 : pos.size;
  
  // Track previous completion state for reveal animation
  const prevCompletedRef = useRef(isCompleted);
  const [isRevealing, setIsRevealing] = useState(false);
  
  useEffect(() => {
    // Detect transition from incomplete to complete
    if (isCompleted && !prevCompletedRef.current && !isStart) {
      setIsRevealing(true);
    }
    prevCompletedRef.current = isCompleted;
  }, [isCompleted, isStart]);
  
  const handleRevealComplete = () => {
    setIsRevealing(false);
  };
  
  return (
    <motion.div
      className="absolute transform -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
    >
      {/* Reveal Animation */}
      <MilestoneRevealAnimation
        isRevealing={isRevealing}
        isPostcard={!!isPostcard}
        onComplete={handleRevealComplete}
      />
      
      {/* Completed glow effect */}
      <AnimatePresence>
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
            initial={isRevealing ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 0.5 }}
            animate={isCurrent ? {
              scale: [1, 1.3, 1],
              opacity: [0.5, 0.8, 0.5],
            } : { scale: 1, opacity: 0.5 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={isRevealing ? {
              scale: { duration: 0.5, ease: "easeOut" },
              opacity: { duration: 0.5, ease: "easeOut" },
            } : {
              duration: 2,
              repeat: isCurrent ? Infinity : 0,
              ease: "easeInOut",
            }}
          />
        )}
      </AnimatePresence>
      
      {/* Star orb */}
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
        animate={isRevealing ? {
          scale: [0.5, 1.4, 1],
          rotate: [0, 180, 360],
        } : isCurrent ? {
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
        transition={isRevealing ? {
          duration: 0.6,
          ease: "easeOut",
        } : {
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Label */}
      <div className={cn(
        "absolute top-full mt-1 left-1/2 -translate-x-1/2 text-[10px] font-medium whitespace-nowrap flex items-center gap-0.5 max-w-[60px] overflow-hidden",
        isCompleted ? (isPostcard ? "text-yellow-400" : "text-primary") : "text-muted-foreground/50",
        isFinale && isCompleted && "text-yellow-400"
      )}>
        <AnimatePresence mode="wait">
          {isStart ? (
            <motion.span 
              key="start"
              className="font-semibold"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
            >
              Start
            </motion.span>
          ) : !isCompleted ? (
            <motion.div
              key="mystery"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0, rotate: 180 }}
              transition={{ duration: 0.3 }}
            >
              <MysteryMilestonePopover
                milestone={milestone}
                currentProgress={progress}
                isPostcard={!!isPostcard}
              />
            </motion.div>
          ) : isPostcard ? (
            <motion.div
              key="postcard"
              initial={{ opacity: 0, scale: 0, rotate: -180 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ 
                type: "spring",
                stiffness: 300,
                damping: 20,
                delay: isRevealing ? 0.3 : 0
              }}
            >
              <MapPin className="w-3 h-3" />
            </motion.div>
          ) : (
            <motion.span 
              key="title"
              className="truncate"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                type: "spring",
                stiffness: 300,
                damping: 20,
                delay: isRevealing ? 0.3 : 0
              }}
            >
              {milestone.title.slice(0, 8)}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
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
  milestones: propMilestones,
  epicId
}: ConstellationTrailProps) => {
  // Fetch journey path image for this epic
  const { 
    pathImageUrl, 
    isLoading: isPathLoading, 
    isGenerating, 
    generateInitialPath 
  } = useJourneyPathImage(epicId);
  
  // Auto-generate initial path when no image exists for this epic
  useEffect(() => {
    if (epicId && !pathImageUrl && !isPathLoading && !isGenerating) {
      generateInitialPath();
    }
  }, [epicId, pathImageUrl, isPathLoading, isGenerating, generateInitialPath]);
  
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

  // Calculate progress-based colors (red -> orange -> yellow -> green)
  const getProgressColors = (p: number) => {
    const clampedProgress = Math.max(0, Math.min(100, p));
    const hue = Math.round((clampedProgress / 100) * 120);
    return {
      border: `hsl(${hue}, 70%, 50%)`,
      glowStrong: `hsla(${hue}, 80%, 60%, 0.4)`,
      glowMedium: `hsla(${hue}, 80%, 60%, 0.3)`,
      glowSoft: `hsla(${hue}, 70%, 40%, 0.2)`,
      glowInner: `hsla(${hue}, 80%, 60%, 0.1)`
    };
  };

  const colors = getProgressColors(progress);

  return (
    <div 
      className={cn(
        "relative w-full h-56 rounded-xl overflow-hidden",
        !pathImageUrl && "bg-gradient-to-br from-slate-950 via-purple-950/50 to-slate-950",
        className
      )}
      style={{
        boxShadow: `
          0 0 10px ${colors.glowStrong},
          0 0 20px ${colors.glowMedium},
          0 0 40px ${colors.glowSoft},
          inset 0 0 15px ${colors.glowInner}
        `
      }}
    >
      {/* AI-generated journey path background */}
      {pathImageUrl && (
        <div className="absolute inset-0">
          <img 
            src={pathImageUrl} 
            alt="Journey path"
            className="w-full h-full object-cover"
          />
          {/* Overlay gradient for star/companion visibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-slate-950/70" />
        </div>
      )}
      
      {/* Loading state for path generation */}
      {isGenerating && !pathImageUrl && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-purple-950/50 to-slate-950">
          <motion.div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
          <div className="absolute bottom-2 left-2 text-xs text-primary/60 flex items-center gap-1">
            <Sparkles className="w-3 h-3 animate-pulse" />
            <span>Mapping your path...</span>
          </div>
        </div>
      )}

      {/* Nebula glow effect - show when no path image */}
      {!pathImageUrl && (
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-primary/30 rounded-full blur-xl" />
          <div className="absolute top-1/3 right-1/4 w-16 h-16 bg-purple-500/20 rounded-full blur-lg" />
        </div>
      )}

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
      {starPositions.map((pos, i) => (
        <MilestoneStar
          key={`star-${sortedMilestones[i].id}`}
          milestone={sortedMilestones[i]}
          pos={pos}
          index={i}
          progress={progress}
          sortedMilestones={sortedMilestones}
        />
      ))}

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
