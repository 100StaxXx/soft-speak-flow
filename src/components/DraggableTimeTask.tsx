import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { cn } from "@/lib/utils";

interface DraggableTimeTaskProps {
  children: React.ReactNode;
  taskId: string;
  currentTime: string | null;
  onReschedule: (taskId: string, newTime: string) => void;
  disabled?: boolean;
}

// Time calculation helpers
const MINUTES_PER_PIXEL = 0.75;
const SNAP_INTERVAL = 15; // minutes
const ACTIVATION_THRESHOLD = 20; // pixels before drag activates

function parseTime(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(":").map(Number);
  return { hours, minutes };
}

function formatTime24(hours: number, minutes: number): string {
  const h = Math.max(6, Math.min(23, hours)); // Clamp to 6am-11pm
  const m = Math.floor(minutes / SNAP_INTERVAL) * SNAP_INTERVAL;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function formatTime12(hours: number, minutes: number): string {
  const h = Math.max(6, Math.min(23, hours));
  const m = Math.floor(minutes / SNAP_INTERVAL) * SNAP_INTERVAL;
  const ampm = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 || 12;
  return `${displayHour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function calculateNewTime(currentTime: string | null, deltaY: number): { time24: string; time12: string } {
  const now = new Date();
  const baseHours = currentTime ? parseTime(currentTime).hours : now.getHours();
  const baseMinutes = currentTime ? parseTime(currentTime).minutes : Math.floor(now.getMinutes() / 15) * 15;
  
  const deltaMinutes = Math.round((deltaY * MINUTES_PER_PIXEL) / SNAP_INTERVAL) * SNAP_INTERVAL;
  const totalMinutes = baseHours * 60 + baseMinutes + deltaMinutes;
  
  const newHours = Math.floor(totalMinutes / 60);
  const newMinutes = totalMinutes % 60;
  
  return {
    time24: formatTime24(newHours, newMinutes < 0 ? 60 + newMinutes : newMinutes),
    time12: formatTime12(newHours, newMinutes < 0 ? 60 + newMinutes : newMinutes),
  };
}

export function DraggableTimeTask({
  children,
  taskId,
  currentTime,
  onReschedule,
  disabled = false,
}: DraggableTimeTaskProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [previewTime, setPreviewTime] = useState<string | null>(null);
  
  const startYRef = useRef(0);
  const lastSnapRef = useRef(0);
  const isActiveRef = useRef(false);

  const triggerHaptic = async (style: ImpactStyle) => {
    try {
      await Haptics.impact({ style });
    } catch {
      // Haptics not available
    }
  };

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    startYRef.current = e.clientY;
    lastSnapRef.current = 0;
    isActiveRef.current = false;
  }, [disabled]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (disabled || startYRef.current === 0) return;
    
    const deltaY = e.clientY - startYRef.current;
    
    // Only activate after threshold
    if (!isActiveRef.current && Math.abs(deltaY) > ACTIVATION_THRESHOLD) {
      isActiveRef.current = true;
      setIsDragging(true);
      triggerHaptic(ImpactStyle.Light);
    }
    
    if (isActiveRef.current) {
      setDragY(deltaY);
      
      const { time12, time24 } = calculateNewTime(currentTime, deltaY);
      setPreviewTime(time12);
      
      // Haptic feedback at snap intervals
      const currentSnapIndex = Math.floor(deltaY / (SNAP_INTERVAL / MINUTES_PER_PIXEL));
      if (currentSnapIndex !== lastSnapRef.current) {
        lastSnapRef.current = currentSnapIndex;
        triggerHaptic(ImpactStyle.Light);
      }
    }
  }, [disabled, currentTime]);

  const handlePointerUp = useCallback(() => {
    if (isActiveRef.current && Math.abs(dragY) > ACTIVATION_THRESHOLD) {
      const { time24 } = calculateNewTime(currentTime, dragY);
      onReschedule(taskId, time24);
      triggerHaptic(ImpactStyle.Medium);
    }
    
    setIsDragging(false);
    setDragY(0);
    setPreviewTime(null);
    startYRef.current = 0;
    isActiveRef.current = false;
  }, [dragY, currentTime, taskId, onReschedule]);

  const handlePointerCancel = useCallback(() => {
    setIsDragging(false);
    setDragY(0);
    setPreviewTime(null);
    startYRef.current = 0;
    isActiveRef.current = false;
  }, []);

  return (
    <motion.div
      className={cn(
        "relative touch-pan-x",
        isDragging && "z-50"
      )}
      style={{ y: isDragging ? dragY : 0 }}
      animate={{ scale: isDragging ? 1.02 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
    >
      {children}
      
      {/* Time preview overlay */}
      {isDragging && previewTime && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, x: 10 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full
            bg-primary text-primary-foreground px-2.5 py-1 rounded-full 
            text-xs font-bold shadow-lg z-50 whitespace-nowrap"
        >
          {previewTime}
        </motion.div>
      )}
      
      {/* Visual drag indicator */}
      {isDragging && (
        <div className="absolute inset-0 rounded-lg border-2 border-primary/50 bg-primary/5 pointer-events-none" />
      )}
    </motion.div>
  );
}
