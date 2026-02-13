import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameDay,
  isToday,
  startOfWeek,
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
  weekStartsOn?: 0 | 1;
}

const EDGE_THRESHOLD_PX = 80;
const DEFAULT_EXTENSION_CHUNK = 14;
const MANUAL_SNAP_IDLE_MS = 120;
const SNAP_EPSILON_PX = 2;
const WEEK_START_LEFT_OFFSET_PX = 8;

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

const getWeekStart = (date: Date, weekStartsOn: 0 | 1) => startOfWeek(startOfDay(date), { weekStartsOn });

export const DatePillsScroller = memo(function DatePillsScroller({
  selectedDate,
  onDateSelect,
  tasksPerDay = {},
  daysToShow = 14,
  weekStartsOn = 0,
}: DatePillsScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const shouldCenterOnSelectedRef = useRef(true);
  const suppressNextCenterRef = useRef(false);
  const pendingWeekSnapRef = useRef<Date | null>(null);
  const pendingLeftCompensationRef = useRef<{
    previousScrollWidth: number;
    previousScrollLeft: number;
  } | null>(null);
  const isExpandingRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const manualSnapTimerRef = useRef<number | null>(null);
  const programmaticUnlockTimerRef = useRef<number | null>(null);
  const weekSnapRetryFrameRef = useRef<number | null>(null);

  const [rangeStart, setRangeStart] = useState<Date>(() => getInitialRange(selectedDate, daysToShow).start);
  const [rangeEnd, setRangeEnd] = useState<Date>(() => getInitialRange(selectedDate, daysToShow).end);
  const [visibleWeekStart, setVisibleWeekStart] = useState<Date>(() => getWeekStart(selectedDate, weekStartsOn));

  const extensionChunk = Math.max(DEFAULT_EXTENSION_CHUNK, daysToShow);

  const clearManualSnapTimer = useCallback(() => {
    if (manualSnapTimerRef.current === null || typeof window === "undefined") return;
    window.clearTimeout(manualSnapTimerRef.current);
    manualSnapTimerRef.current = null;
  }, []);

  const clearProgrammaticUnlockTimer = useCallback(() => {
    if (programmaticUnlockTimerRef.current === null || typeof window === "undefined") return;
    window.clearTimeout(programmaticUnlockTimerRef.current);
    programmaticUnlockTimerRef.current = null;
  }, []);

  const clearWeekSnapRetryFrame = useCallback(() => {
    if (weekSnapRetryFrameRef.current === null || typeof window === "undefined") return;
    window.cancelAnimationFrame(weekSnapRetryFrameRef.current);
    weekSnapRetryFrameRef.current = null;
  }, []);

  const scheduleProgrammaticUnlock = useCallback(() => {
    if (typeof window === "undefined") return;
    clearProgrammaticUnlockTimer();
    programmaticUnlockTimerRef.current = window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      programmaticUnlockTimerRef.current = null;
    }, MANUAL_SNAP_IDLE_MS);
  }, [clearProgrammaticUnlockTimer]);

  const scrollToPosition = useCallback(
    (targetLeft: number, behavior: ScrollBehavior = "smooth") => {
      const container = scrollRef.current;
      if (!container) return false;

      const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
      const clampedLeft = Math.max(0, Math.min(targetLeft, maxScrollLeft));

      if (Math.abs(container.scrollLeft - clampedLeft) <= SNAP_EPSILON_PX) {
        return false;
      }

      isProgrammaticScrollRef.current = true;
      scheduleProgrammaticUnlock();
      container.scrollTo({ left: clampedLeft, behavior });
      return true;
    },
    [scheduleProgrammaticUnlock],
  );

  useEffect(() => {
    const nextRange = getInitialRange(selectedDate, daysToShow);
    setRangeStart(nextRange.start);
    setRangeEnd(nextRange.end);
  }, [daysToShow]);

  useEffect(() => {
    setVisibleWeekStart(getWeekStart(selectedDate, weekStartsOn));
  }, [weekStartsOn]);

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
  }, [rangeEnd, rangeStart, selectedDate]);

  const getTaskCount = useCallback(
    (date: Date) => {
      const dateKey = format(date, "yyyy-MM-dd");
      return tasksPerDay[dateKey] || 0;
    },
    [tasksPerDay],
  );

  const snapToWeekStart = useCallback((weekStart: Date) => {
    const container = scrollRef.current;
    if (!container) return false;

    const dateKey = format(weekStart, "yyyy-MM-dd");
    const targetButton = container.querySelector<HTMLButtonElement>(`button[data-date='${dateKey}']`);
    if (!targetButton) return false;

    return scrollToPosition(targetButton.offsetLeft - WEEK_START_LEFT_OFFSET_PX, "smooth");
  }, [scrollToPosition]);

  const scheduleManualWeekSnap = useCallback(() => {
    if (typeof window === "undefined") return;

    clearManualSnapTimer();
    manualSnapTimerRef.current = window.setTimeout(() => {
      manualSnapTimerRef.current = null;
      const container = scrollRef.current;

      if (!container || isExpandingRef.current || isProgrammaticScrollRef.current) return;

      const weekStartButtons = Array.from(
        container.querySelectorAll<HTMLButtonElement>("button[data-week-start='true']"),
      );

      if (weekStartButtons.length === 0) return;

      const currentLeft = container.scrollLeft;
      let nearestLeft = weekStartButtons[0].offsetLeft - WEEK_START_LEFT_OFFSET_PX;
      let nearestDistance = Math.abs(nearestLeft - currentLeft);

      for (let index = 1; index < weekStartButtons.length; index += 1) {
        const candidateLeft = weekStartButtons[index].offsetLeft - WEEK_START_LEFT_OFFSET_PX;
        const candidateDistance = Math.abs(candidateLeft - currentLeft);
        if (candidateDistance < nearestDistance) {
          nearestDistance = candidateDistance;
          nearestLeft = candidateLeft;
        }
      }

      scrollToPosition(nearestLeft, "smooth");
    }, MANUAL_SNAP_IDLE_MS);
  }, [clearManualSnapTimer, scrollToPosition]);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    if (isProgrammaticScrollRef.current) {
      scheduleProgrammaticUnlock();
      return;
    }

    scheduleManualWeekSnap();
    if (isExpandingRef.current) return;

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
  }, [extensionChunk, scheduleManualWeekSnap, scheduleProgrammaticUnlock]);

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

    const pendingWeekSnap = pendingWeekSnapRef.current;
    if (pendingWeekSnap) {
      if (snapToWeekStart(pendingWeekSnap)) {
        pendingWeekSnapRef.current = null;
        clearWeekSnapRetryFrame();
      } else if (typeof window !== "undefined" && weekSnapRetryFrameRef.current === null) {
        weekSnapRetryFrameRef.current = window.requestAnimationFrame(() => {
          weekSnapRetryFrameRef.current = null;
          const retryWeekSnap = pendingWeekSnapRef.current;
          if (!retryWeekSnap) return;
          if (snapToWeekStart(retryWeekSnap)) {
            pendingWeekSnapRef.current = null;
          }
        });
      }
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
      clearWeekSnapRetryFrame();
    };
  }, [clearWeekSnapRetryFrame, rangeEnd, rangeStart, snapToWeekStart]);

  useEffect(() => {
    const selectedWeekStart = getWeekStart(selectedDate, weekStartsOn);
    const weekDelta = differenceInCalendarDays(selectedWeekStart, visibleWeekStart);

    if (weekDelta === 0) {
      if (suppressNextCenterRef.current) {
        suppressNextCenterRef.current = false;
        return;
      }
      shouldCenterOnSelectedRef.current = true;
      return;
    }

    shouldCenterOnSelectedRef.current = false;
    suppressNextCenterRef.current = true;
    setVisibleWeekStart(selectedWeekStart);
    pendingWeekSnapRef.current = selectedWeekStart;

    const isTargetInRange =
      selectedWeekStart.getTime() >= rangeStart.getTime() && selectedWeekStart.getTime() <= rangeEnd.getTime();

    if (!isTargetInRange) {
      const nextRange = getInitialRange(selectedWeekStart, daysToShow);
      setRangeStart(nextRange.start);
      setRangeEnd(nextRange.end);
      return;
    }

    if (snapToWeekStart(selectedWeekStart)) {
      pendingWeekSnapRef.current = null;
    }
  }, [daysToShow, rangeEnd, rangeStart, selectedDate, snapToWeekStart, visibleWeekStart, weekStartsOn]);

  // Scroll selected date to center only after explicit selected-date changes.
  useEffect(() => {
    if (!shouldCenterOnSelectedRef.current) return;
    if (!selectedRef.current || !scrollRef.current) return;

    const container = scrollRef.current;
    const selected = selectedRef.current;
    const containerWidth = container.offsetWidth;
    const selectedLeft = selected.offsetLeft;
    const selectedWidth = selected.offsetWidth;

    scrollToPosition(selectedLeft - containerWidth / 2 + selectedWidth / 2, "smooth");
    shouldCenterOnSelectedRef.current = false;
  }, [dates, scrollToPosition, selectedDate]);

  useEffect(() => {
    return () => {
      clearManualSnapTimer();
      clearProgrammaticUnlockTimer();
      clearWeekSnapRetryFrame();
    };
  }, [clearManualSnapTimer, clearProgrammaticUnlockTimer, clearWeekSnapRetryFrame]);

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
        const isWeekStart = date.getDay() === weekStartsOn;
        const taskCount = getTaskCount(date);
        const dateKey = format(date, "yyyy-MM-dd");

        return (
          <motion.button
            key={dateKey}
            data-date={dateKey}
            data-week-start={isWeekStart ? "true" : undefined}
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
