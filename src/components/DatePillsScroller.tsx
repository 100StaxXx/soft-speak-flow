import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameDay,
  isToday,
  startOfDay,
  subDays,
} from "date-fns";
import { motion } from "framer-motion";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

interface DatePillsScrollerProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  tasksPerDay?: Record<string, number>;
  daysToShow?: number;
}

const EDGE_THRESHOLD_PX = 80;
const DEFAULT_EXTENSION_CHUNK = 14;

const triggerHaptic = async (style: ImpactStyle) => {
  try {
    await Haptics.impact({ style });
  } catch {
    // Haptics not available on web.
  }
};

const getInitialRange = (selectedDate: Date, daysToShow: number) => {
  const normalizedSpan = Math.max(7, daysToShow);
  const centerDate = startOfDay(selectedDate);
  const daysBeforeCenter = Math.floor(normalizedSpan / 2);
  const start = subDays(centerDate, daysBeforeCenter);
  const end = addDays(start, normalizedSpan - 1);
  return { start, end };
};

export const DatePillsScroller = memo(function DatePillsScroller({
  selectedDate,
  onDateSelect,
  tasksPerDay = {},
  daysToShow = 14,
}: DatePillsScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const shouldCenterOnSelectedRef = useRef(true);
  const pendingLeftCompensationRef = useRef<{
    previousScrollWidth: number;
    previousScrollLeft: number;
  } | null>(null);
  const isExpandingRef = useRef(false);

  const [rangeStart, setRangeStart] = useState<Date>(() => getInitialRange(selectedDate, daysToShow).start);
  const [rangeEnd, setRangeEnd] = useState<Date>(() => getInitialRange(selectedDate, daysToShow).end);

  const extensionChunk = Math.max(DEFAULT_EXTENSION_CHUNK, daysToShow);

  useEffect(() => {
    const nextRange = getInitialRange(selectedDate, daysToShow);
    setRangeStart(nextRange.start);
    setRangeEnd(nextRange.end);
  }, [daysToShow]);

  useEffect(() => {
    const selectedTime = selectedDate.getTime();
    const isOutOfRange = selectedTime < rangeStart.getTime() || selectedTime > rangeEnd.getTime();

    if (!isOutOfRange) return;

    const nextRange = getInitialRange(selectedDate, daysToShow);
    setRangeStart(nextRange.start);
    setRangeEnd(nextRange.end);
  }, [daysToShow, rangeEnd, rangeStart, selectedDate]);

  const dates = useMemo(() => {
    const totalDays = differenceInCalendarDays(rangeEnd, rangeStart) + 1;
    return Array.from({ length: Math.max(1, totalDays) }, (_, index) => addDays(rangeStart, index));
  }, [rangeEnd, rangeStart]);

  const getTaskCount = useCallback(
    (date: Date) => {
      const dateKey = format(date, "yyyy-MM-dd");
      return tasksPerDay[dateKey] || 0;
    },
    [tasksPerDay],
  );

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container || isExpandingRef.current) return;

    const { scrollLeft, clientWidth, scrollWidth } = container;

    if (scrollLeft <= EDGE_THRESHOLD_PX) {
      isExpandingRef.current = true;
      pendingLeftCompensationRef.current = {
        previousScrollWidth: scrollWidth,
        previousScrollLeft: scrollLeft,
      };
      setRangeStart((currentStart) => subDays(currentStart, extensionChunk));
      return;
    }

    if (scrollLeft + clientWidth >= scrollWidth - EDGE_THRESHOLD_PX) {
      isExpandingRef.current = true;
      setRangeEnd((currentEnd) => addDays(currentEnd, extensionChunk));
    }
  }, [extensionChunk]);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      isExpandingRef.current = false;
      return;
    }

    const pendingCompensation = pendingLeftCompensationRef.current;
    if (pendingCompensation) {
      const widthDelta = container.scrollWidth - pendingCompensation.previousScrollWidth;
      container.scrollLeft = pendingCompensation.previousScrollLeft + widthDelta;
      pendingLeftCompensationRef.current = null;
    }

    const frame =
      typeof window !== "undefined"
        ? window.requestAnimationFrame(() => {
            isExpandingRef.current = false;
          })
        : null;

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [rangeEnd, rangeStart]);

  useEffect(() => {
    shouldCenterOnSelectedRef.current = true;
  }, [selectedDate]);

  // Scroll selected date to center only after explicit selected-date changes.
  useEffect(() => {
    if (!shouldCenterOnSelectedRef.current) return;
    if (!selectedRef.current || !scrollRef.current) return;

    const container = scrollRef.current;
    const selected = selectedRef.current;
    const containerWidth = container.offsetWidth;
    const selectedLeft = selected.offsetLeft;
    const selectedWidth = selected.offsetWidth;

    container.scrollTo({
      left: selectedLeft - containerWidth / 2 + selectedWidth / 2,
      behavior: "smooth",
    });
    shouldCenterOnSelectedRef.current = false;
  }, [dates, selectedDate]);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className={cn("flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 transition-all duration-200")}
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      {dates.map((date) => {
        const isSelected = isSameDay(date, selectedDate);
        const isDayToday = isToday(date);
        const taskCount = getTaskCount(date);
        const dateKey = format(date, "yyyy-MM-dd");

        return (
          <motion.button
            key={dateKey}
            ref={isSelected ? selectedRef : undefined}
            onClick={async () => {
              await triggerHaptic(ImpactStyle.Light);
              onDateSelect(date);
            }}
            className={cn(
              "flex-shrink-0 flex flex-col items-center justify-center",
              "min-w-[52px] h-16 rounded-xl transition-all duration-200",
              "border border-border/50",
              isSelected
                ? "bg-gradient-to-br from-primary to-purple-500 text-white border-primary shadow-lg shadow-primary/25"
                : "bg-card/50 hover:bg-card hover:border-primary/30",
              isDayToday && !isSelected &&
                "border-celestial-blue/50 ring-1 ring-celestial-blue/30 bg-celestial-blue/5",
            )}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <span
              className={cn(
                "text-[10px] font-medium uppercase tracking-wide",
                isSelected ? "text-white/90" : isDayToday ? "text-celestial-blue" : "text-muted-foreground",
              )}
            >
              {format(date, "EEE")}
            </span>
            <span
              className={cn(
                "text-lg font-bold leading-tight",
                isSelected ? "text-white" : isDayToday ? "text-celestial-blue" : "text-foreground",
              )}
            >
              {format(date, "d")}
            </span>
            <div className="flex gap-0.5 mt-0.5 h-1.5">
              {taskCount > 0 && (
                <>
                  <div
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isSelected ? "bg-white/70" : isDayToday ? "bg-celestial-blue/60" : "bg-stardust-gold/60",
                    )}
                  />
                  {taskCount > 1 && (
                    <div
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        isSelected ? "bg-white/50" : isDayToday ? "bg-celestial-blue/40" : "bg-stardust-gold/40",
                      )}
                    />
                  )}
                  {taskCount > 2 && (
                    <div
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        isSelected ? "bg-white/30" : isDayToday ? "bg-celestial-blue/20" : "bg-stardust-gold/20",
                      )}
                    />
                  )}
                </>
              )}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
});
