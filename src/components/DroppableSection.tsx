import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Sunrise, Sun, Moon, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export type TimeSection = 'morning' | 'afternoon' | 'evening' | 'unscheduled';

interface DroppableSectionProps {
  sectionId: TimeSection;
  isActive: boolean; // Whether a task is being dragged
  isDraggedOver: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  children: React.ReactNode;
  isEmpty?: boolean;
}

const sectionConfig: Record<TimeSection, {
  title: string;
  emoji: React.ReactNode;
  defaultTime: string | null;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}> = {
  morning: {
    title: "Morning",
    emoji: <Sunrise className="w-4 h-4" />,
    defaultTime: "09:00",
    colorClass: "text-amber-400",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-400/50",
  },
  afternoon: {
    title: "Afternoon", 
    emoji: <Sun className="w-4 h-4" />,
    defaultTime: "14:00",
    colorClass: "text-orange-400",
    bgClass: "bg-orange-500/10",
    borderClass: "border-orange-400/50",
  },
  evening: {
    title: "Evening",
    emoji: <Moon className="w-4 h-4" />,
    defaultTime: "19:00",
    colorClass: "text-indigo-400",
    bgClass: "bg-indigo-500/10",
    borderClass: "border-indigo-400/50",
  },
  unscheduled: {
    title: "Anytime",
    emoji: <Inbox className="w-4 h-4" />,
    defaultTime: null,
    colorClass: "text-muted-foreground",
    bgClass: "bg-muted/30",
    borderClass: "border-muted-foreground/30",
  },
};

export function DroppableSection({
  sectionId,
  isActive,
  isDraggedOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  children,
  isEmpty = false,
}: DroppableSectionProps) {
  const config = sectionConfig[sectionId];
  const dropZoneRef = useRef<HTMLDivElement>(null);
  
  const triggerHaptic = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (e) {
        // Haptics not available
      }
    }
  };

  const handleDragEnter = () => {
    triggerHaptic();
    onDragEnter();
  };

  return (
    <motion.div
      ref={dropZoneRef}
      className={cn(
        "relative rounded-lg transition-all duration-200",
        isActive && "ring-2 ring-dashed",
        isActive && !isDraggedOver && "ring-muted-foreground/20",
        isDraggedOver && config.borderClass.replace('border-', 'ring-'),
        isDraggedOver && config.bgClass,
      )}
      onPointerEnter={() => isActive && handleDragEnter()}
      onPointerLeave={() => isActive && onDragLeave()}
      onPointerUp={() => {
        if (isActive && isDraggedOver) {
          onDrop();
        }
      }}
      animate={isDraggedOver ? { scale: 1.01 } : { scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {/* Drop indicator overlay */}
      <AnimatePresence>
        {isDraggedOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "absolute inset-0 rounded-lg pointer-events-none z-10",
              "flex items-center justify-center",
              config.bgClass,
            )}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-full",
                "bg-background/80 backdrop-blur-sm shadow-lg",
                config.colorClass,
              )}
            >
              {config.emoji}
              <span className="text-sm font-medium">
                Drop in {config.title}
              </span>
              {config.defaultTime && (
                <span className="text-xs opacity-70 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {config.defaultTime}
                </span>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section header - only show when active or has content */}
      {(isActive || !isEmpty) && (
        <div className={cn(
          "flex items-center gap-2 px-2 py-1.5 mb-1",
          config.colorClass,
        )}>
          {config.emoji}
          <span className="text-xs font-medium uppercase tracking-wide">
            {config.title}
          </span>
          {config.defaultTime && (
            <span className="text-xs opacity-50">
              ({config.defaultTime})
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className={cn(
        "relative min-h-[20px]",
        isDraggedOver && "opacity-50",
      )}>
        {children}
      </div>
    </motion.div>
  );
}

export { sectionConfig };
