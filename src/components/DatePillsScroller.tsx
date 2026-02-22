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
  isActive?: boolean;
}

const EDGE_THRESHOLD_PX = 80;
const DEFAULT_EXTENSION_CHUNK = 14;
const CENTER_RETRY_ATTEMPTS = 8;
const SCROLL_IDLE_DELAY_MS = 100;
const PROGRAMMATIC_SCROLL_GUARD_MS = 180;

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
  isActive = true,
}: DatePillsScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const pendingLeftCompensationRef = useRef<{
    previousScrollWidth: number;
    previousScrollLeft: number;
  } | null>(null);
  const isExpandingRef = useRef(false);
  const pendingCenterAfterExpansionRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollResetTimeoutRef = useRef<number | null>(null);
  const scrollIdleTimeoutRef = useRef<number | null>(null);

  const [rangeStart, setRangeStart] = useState<Date>(() => getInitialRange(selectedDate, daysToShow).start);
  const [rangeEnd, setRangeEnd] = useState<Date>(() => getInitialRange(selectedDate, daysToShow).end);
  const [edgeSpacerWidth, setEdgeSpacerWidth] = useState(0);
  const [centerRequestVersion, setCenterRequestVersion] = useState(0);

  const extensionChunk = Math.max(DEFAULT_EXTENSION_CHUNK, daysToShow);
  const selectedDateKey = useMemo(() => format(selectedDate, "yyyy-MM-dd"), [selectedDate]);

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

  const getSelectedPillElement = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return null;

    const selected = selectedRef.current;
    if (selected?.dataset.dateKey === selectedDateKey) {
      return selected;
    }

    return container.querySelector<HTMLButtonElement>(
      `button[data-date-pill='true'][data-date-key='${selectedDateKey}']`,
    );
  }, [selectedDateKey]);

  const calculateEdgeSpacerWidth = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return null;

    const measuredPill = getSelectedPillElement();
    if (!measuredPill) return null;

    const containerWidth = container.offsetWidth;
    const pillWidth = measuredPill.offsetWidth;
    if (containerWidth === 0 || pillWidth === 0) return null;

    return Math.max(0, containerWidth / 2 - pillWidth / 2);
  }, [getSelectedPillElement]);

  const recalculateEdgeSpacers = useCallback(() => {
    const nextWidth = calculateEdgeSpacerWidth();
    if (nextWidth === null) return;

    setEdgeSpacerWidth((currentWidth) => (Math.abs(currentWidth - nextWidth) < 0.5 ? currentWidth : nextWidth));
  }, [calculateEdgeSpacerWidth]);

  const clearProgrammaticScrollResetTimeout = useCallback(() => {
    if (programmaticScrollResetTimeoutRef.current === null) return;
    window.clearTimeout(programmaticScrollResetTimeoutRef.current);
    programmaticScrollResetTimeoutRef.current = null;
  }, []);

  const clearScrollIdleTimeout = useCallback(() => {
    if (scrollIdleTimeoutRef.current === null) return;
    window.clearTimeout(scrollIdleTimeoutRef.current);
    scrollIdleTimeoutRef.current = null;
  }, []);

  const requestCenterSelectedDate = useCallback(() => {
    setCenterRequestVersion((currentVersion) => currentVersion + 1);
  }, []);

  const markProgrammaticScroll = useCallback(() => {
    if (typeof window === "undefined") return;

    isProgrammaticScrollRef.current = true;
    clearProgrammaticScrollResetTimeout();
    programmaticScrollResetTimeoutRef.current = window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      programmaticScrollResetTimeoutRef.current = null;
    }, PROGRAMMATIC_SCROLL_GUARD_MS);
  }, [clearProgrammaticScrollResetTimeout]);

  const scheduleCenterAfterScrollIdle = useCallback(() => {
    if (!isActive) return;

    if (typeof window === "undefined") {
      requestCenterSelectedDate();
      return;
    }

    clearScrollIdleTimeout();
    scrollIdleTimeoutRef.current = window.setTimeout(() => {
      scrollIdleTimeoutRef.current = null;
      requestCenterSelectedDate();
    }, SCROLL_IDLE_DELAY_MS);
  }, [clearScrollIdleTimeout, isActive, requestCenterSelectedDate]);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (isExpandingRef.current) {
      if (!isProgrammaticScrollRef.current) {
        pendingCenterAfterExpansionRef.current = true;
      }
      return;
    }

    if (!isProgrammaticScrollRef.current) {
      scheduleCenterAfterScrollIdle();
    }

    const { scrollLeft, clientWidth, scrollWidth } = container;

    if (scrollLeft <= EDGE_THRESHOLD_PX) {
      isExpandingRef.current = true;
      pendingCenterAfterExpansionRef.current = true;
      pendingLeftCompensationRef.current = {
        previousScrollWidth: scrollWidth,
        previousScrollLeft: scrollLeft,
      };
      setRangeStart((currentStart) => subDays(currentStart, extensionChunk));
      return;
    }

    if (scrollLeft + clientWidth >= scrollWidth - EDGE_THRESHOLD_PX) {
      isExpandingRef.current = true;
      pendingCenterAfterExpansionRef.current = true;
      setRangeEnd((currentEnd) => addDays(currentEnd, extensionChunk));
    }
  }, [extensionChunk, scheduleCenterAfterScrollIdle]);

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
            if (pendingCenterAfterExpansionRef.current) {
              pendingCenterAfterExpansionRef.current = false;
              requestCenterSelectedDate();
            }
          })
        : null;

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [rangeEnd, rangeStart, requestCenterSelectedDate]);

  useLayoutEffect(() => {
    recalculateEdgeSpacers();
  }, [dates, selectedDate, isActive, recalculateEdgeSpacers]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const container = scrollRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      recalculateEdgeSpacers();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [recalculateEdgeSpacers]);

  useEffect(() => {
    if (isActive) return;
    clearScrollIdleTimeout();
  }, [clearScrollIdleTimeout, isActive]);

  useEffect(() => {
    return () => {
      clearScrollIdleTimeout();
      clearProgrammaticScrollResetTimeout();
      isProgrammaticScrollRef.current = false;
    };
  }, [clearProgrammaticScrollResetTimeout, clearScrollIdleTimeout]);

  // Keep selected date centered after selected-date changes and scroll-idle events.
  useLayoutEffect(() => {
    if (!isActive) return;

    let frameId: number | null = null;
    let isCancelled = false;

    const centerSelectedDate = (remainingAttempts: number) => {
      if (isCancelled) return;

      const container = scrollRef.current;
      const selected = getSelectedPillElement();

      if (!container || !selected) {
        if (remainingAttempts > 0 && typeof window !== "undefined") {
          frameId = window.requestAnimationFrame(() => {
            centerSelectedDate(remainingAttempts - 1);
          });
        }
        return;
      }

      const containerWidth = container.offsetWidth;
      const selectedWidth = selected.offsetWidth;

      if ((containerWidth === 0 || selectedWidth === 0) && remainingAttempts > 0 && typeof window !== "undefined") {
        frameId = window.requestAnimationFrame(() => {
          centerSelectedDate(remainingAttempts - 1);
        });
        return;
      }

      if (containerWidth === 0 || selectedWidth === 0) return;

      const nextSpacerWidth = calculateEdgeSpacerWidth();
      if (
        nextSpacerWidth !== null &&
        Math.abs(nextSpacerWidth - edgeSpacerWidth) >= 0.5
      ) {
        setEdgeSpacerWidth(nextSpacerWidth);
        if (remainingAttempts > 0 && typeof window !== "undefined") {
          frameId = window.requestAnimationFrame(() => {
            centerSelectedDate(remainingAttempts - 1);
          });
        }
        return;
      }

      const selectedLeft = selected.offsetLeft;
      const targetLeft = selectedLeft - containerWidth / 2 + selectedWidth / 2;
      const maxScrollLeft = Math.max(0, container.scrollWidth - containerWidth);
      const clampedLeft = Math.min(Math.max(targetLeft, 0), maxScrollLeft);
      const hasMeaningfulDelta = Math.abs(container.scrollLeft - clampedLeft) > 0.5;

      if (hasMeaningfulDelta) {
        markProgrammaticScroll();
      }

      try {
        container.scrollTo({
          left: clampedLeft,
          behavior: "smooth",
        });
      } catch {
        // Some WebViews/Safari states can throw; scrollLeft fallback below is deterministic.
      }

      container.scrollLeft = clampedLeft;
    };

    centerSelectedDate(CENTER_RETRY_ATTEMPTS);

    return () => {
      isCancelled = true;
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [calculateEdgeSpacerWidth, centerRequestVersion, dates, edgeSpacerWidth, getSelectedPillElement, isActive, markProgrammaticScroll, selectedDate]);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className={cn("flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 transition-all duration-200")}
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <div
        aria-hidden="true"
        data-testid="date-pill-edge-spacer-start"
        className="shrink-0"
        style={{ width: `${edgeSpacerWidth}px` }}
      />
      {dates.map((date) => {
        const isSelected = isSameDay(date, selectedDate);
        const isDayToday = isToday(date);
        const taskCount = getTaskCount(date);
        const dateKey = format(date, "yyyy-MM-dd");

        return (
          <motion.button
            key={dateKey}
            ref={isSelected ? selectedRef : undefined}
            data-date-pill="true"
            data-date-key={dateKey}
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
      <div
        aria-hidden="true"
        data-testid="date-pill-edge-spacer-end"
        className="shrink-0"
        style={{ width: `${edgeSpacerWidth}px` }}
      />
    </div>
  );
});
