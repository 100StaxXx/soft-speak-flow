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
  centerRequestKey?: number;
  centerRequestDateKey?: string;
  onUserDateInteraction?: () => void;
}

type CenterSelectedDateResult = "centered" | "retry";
interface CompletedCenterRequest {
  key: number;
  dateKey: string;
}

const EDGE_THRESHOLD_PX = 80;
const DEFAULT_EXTENSION_CHUNK = 14;
const CENTER_RETRY_ATTEMPTS = 8;

const dateKeyToDate = (dateKey: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;

  const date = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const triggerHaptic = async (style: ImpactStyle) => {
  try {
    await Haptics.impact({ style });
  } catch {
    // Haptics not available on web.
  }
};

const getPillLeftWithinScroller = (container: HTMLDivElement, pill: HTMLButtonElement) => {
  const containerRect = container.getBoundingClientRect();
  const pillRect = pill.getBoundingClientRect();

  if (containerRect.width > 0 && pillRect.width > 0) {
    return pillRect.left - containerRect.left + container.scrollLeft;
  }

  return pill.offsetLeft;
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
  centerRequestKey = 0,
  centerRequestDateKey,
  onUserDateInteraction,
}: DatePillsScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const pendingLeftCompensationRef = useRef<{
    previousScrollWidth: number;
    previousScrollLeft: number;
  } | null>(null);
  const isExpandingRef = useRef(false);
  const ignoreProgrammaticScrollRef = useRef(false);
  const releaseProgrammaticScrollFrameRef = useRef<number | null>(null);

  const [rangeStart, setRangeStart] = useState<Date>(() => getInitialRange(selectedDate, daysToShow).start);
  const [rangeEnd, setRangeEnd] = useState<Date>(() => getInitialRange(selectedDate, daysToShow).end);
  const [edgeSpacerWidth, setEdgeSpacerWidth] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const extensionChunk = Math.max(DEFAULT_EXTENSION_CHUNK, daysToShow);
  const selectedDateKey = useMemo(() => format(selectedDate, "yyyy-MM-dd"), [selectedDate]);
  const requestedCenterDateKey = centerRequestDateKey ?? selectedDateKey;
  const lastCompletedCenterRequestRef = useRef<CompletedCenterRequest>({
    key: centerRequestKey,
    dateKey: requestedCenterDateKey,
  });
  const lastAutoCenterSignatureRef = useRef<string | null>(null);
  const isForcedCenterRequestPending = centerRequestKey !== lastCompletedCenterRequestRef.current.key;
  const handleUserDateInteraction = useCallback(() => {
    onUserDateInteraction?.();
  }, [onUserDateInteraction]);

  const resetRenderedRangeAroundDateKey = useCallback((dateKey: string) => {
    const date = dateKeyToDate(dateKey);
    if (!date) return false;

    const nextRange = getInitialRange(date, daysToShow);
    const shouldUpdateRange =
      !isSameDay(nextRange.start, rangeStart)
      || !isSameDay(nextRange.end, rangeEnd);

    if (!shouldUpdateRange) return false;

    pendingLeftCompensationRef.current = null;
    isExpandingRef.current = false;
    setRangeStart(nextRange.start);
    setRangeEnd(nextRange.end);
    return true;
  }, [daysToShow, rangeEnd, rangeStart]);

  useEffect(() => {
    const nextRange = getInitialRange(selectedDate, daysToShow);
    setRangeStart(nextRange.start);
    setRangeEnd(nextRange.end);
  }, [daysToShow]);

  useEffect(() => {
    if (isForcedCenterRequestPending && requestedCenterDateKey !== selectedDateKey) return;

    const selectedTime = selectedDate.getTime();
    const isOutOfRange = selectedTime < rangeStart.getTime() || selectedTime > rangeEnd.getTime();

    if (!isOutOfRange) return;

    const nextRange = getInitialRange(selectedDate, daysToShow);
    setRangeStart(nextRange.start);
    setRangeEnd(nextRange.end);
  }, [
    daysToShow,
    isForcedCenterRequestPending,
    rangeEnd,
    rangeStart,
    requestedCenterDateKey,
    selectedDate,
    selectedDateKey,
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => {
        mediaQuery.removeEventListener("change", handleChange);
      };
    }

    mediaQuery.addListener(handleChange);
    return () => {
      mediaQuery.removeListener(handleChange);
    };
  }, []);

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

  const getPillElementByDateKey = useCallback((dateKey: string) => {
    const container = scrollRef.current;
    if (!container) return null;

    const selected = selectedRef.current;
    if (selected?.dataset.dateKey === dateKey) {
      return selected;
    }

    return container.querySelector<HTMLButtonElement>(
      `button[data-date-pill='true'][data-date-key='${dateKey}']`,
    );
  }, []);

  const getSelectedPillElement = useCallback(
    () => getPillElementByDateKey(selectedDateKey),
    [getPillElementByDateKey, selectedDateKey],
  );

  const calculateEdgeSpacerWidth = useCallback((dateKey = selectedDateKey) => {
    const container = scrollRef.current;
    if (!container) return null;

    const measuredPill = getPillElementByDateKey(dateKey);
    if (!measuredPill) return null;

    const containerWidth = container.offsetWidth;
    const pillWidth = measuredPill.offsetWidth;
    if (containerWidth === 0 || pillWidth === 0) return null;

    return Math.max(0, containerWidth / 2 - pillWidth / 2);
  }, [getPillElementByDateKey, selectedDateKey]);

  const recalculateEdgeSpacers = useCallback(() => {
    const nextWidth = calculateEdgeSpacerWidth();
    if (nextWidth === null) return;

    setEdgeSpacerWidth((currentWidth) => (Math.abs(currentWidth - nextWidth) < 0.5 ? currentWidth : nextWidth));
  }, [calculateEdgeSpacerWidth]);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (ignoreProgrammaticScrollRef.current) return;
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
  }, [extensionChunk]);

  const ignoreNextForcedScrollEvents = useCallback(() => {
    if (typeof window === "undefined") return;

    ignoreProgrammaticScrollRef.current = true;

    if (releaseProgrammaticScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(releaseProgrammaticScrollFrameRef.current);
    }

    releaseProgrammaticScrollFrameRef.current = window.requestAnimationFrame(() => {
      releaseProgrammaticScrollFrameRef.current = window.requestAnimationFrame(() => {
        ignoreProgrammaticScrollRef.current = false;
        releaseProgrammaticScrollFrameRef.current = null;
      });
    });
  }, []);

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

  useEffect(() => () => {
    if (releaseProgrammaticScrollFrameRef.current !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(releaseProgrammaticScrollFrameRef.current);
    }
  }, []);

  useLayoutEffect(() => {
    recalculateEdgeSpacers();
  }, [dates, isActive, recalculateEdgeSpacers, selectedDateKey]);

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

  const centerSelectedDate = useCallback(({
    behavior,
    force,
    targetDateKey,
  }: {
    behavior: ScrollBehavior;
    force: boolean;
    targetDateKey?: string;
  }): CenterSelectedDateResult => {
    const container = scrollRef.current;
    const selected = targetDateKey
      ? getPillElementByDateKey(targetDateKey)
      : getSelectedPillElement();

    if (!container || !selected) return "retry";

    const containerWidth = container.offsetWidth;
    const selectedWidth = selected.offsetWidth;

    if (containerWidth === 0 || selectedWidth === 0) return "retry";

    const nextSpacerWidth = calculateEdgeSpacerWidth(targetDateKey);
    if (
      nextSpacerWidth !== null &&
      Math.abs(nextSpacerWidth - edgeSpacerWidth) >= 0.5
    ) {
      setEdgeSpacerWidth(nextSpacerWidth);
      return "retry";
    }

    const selectedLeft = getPillLeftWithinScroller(container, selected);
    const targetLeft = selectedLeft - containerWidth / 2 + selectedWidth / 2;
    const maxScrollLeft = Math.max(0, container.scrollWidth - containerWidth);
    const clampedLeft = Math.min(Math.max(targetLeft, 0), maxScrollLeft);

    if (force) {
      ignoreNextForcedScrollEvents();
    }

    try {
      container.scrollTo({
        left: clampedLeft,
        behavior,
      });
    } catch {
      // Some WebViews/Safari states can throw; scrollLeft fallback below is deterministic.
      container.scrollLeft = clampedLeft;
    }

    if (force) {
      container.scrollLeft = clampedLeft;
    }

    return "centered";
  }, [
    calculateEdgeSpacerWidth,
    edgeSpacerWidth,
    getPillElementByDateKey,
    getSelectedPillElement,
    ignoreNextForcedScrollEvents,
  ]);

  // Center the selected pill on selected-date, activation, or explicit center requests.
  // Range extensions from edge scrolls intentionally don't re-center, so the
  // user's scroll momentum is preserved.
  useLayoutEffect(() => {
    if (!isActive) {
      lastAutoCenterSignatureRef.current = null;
      return;
    }

    let frameId: number | null = null;
    let isCancelled = false;
    const lastCompletedCenterRequest = lastCompletedCenterRequestRef.current;
    const isForcedCenterRequest = centerRequestKey !== lastCompletedCenterRequest.key;
    const autoCenterSignature = selectedDateKey;
    const shouldAutoCenter = lastAutoCenterSignatureRef.current !== autoCenterSignature;

    if (!isForcedCenterRequest && !shouldAutoCenter) return;

    const scheduleCentering = (remainingAttempts: number) => {
      if (typeof window === "undefined") return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        runCentering(remainingAttempts);
      });
    };

    const runCentering = (remainingAttempts: number) => {
      if (isCancelled) return;

      if (isForcedCenterRequest && !getPillElementByDateKey(requestedCenterDateKey)) {
        const container = scrollRef.current;
        ignoreNextForcedScrollEvents();
        if (resetRenderedRangeAroundDateKey(requestedCenterDateKey)) {
          if (container) {
            container.scrollLeft = 0;
          }
          if (remainingAttempts > 0) {
            scheduleCentering(remainingAttempts - 1);
          }
          return;
        }
      }

      const result = centerSelectedDate({
        behavior: isForcedCenterRequest || prefersReducedMotion ? "auto" : "smooth",
        force: isForcedCenterRequest,
        targetDateKey: isForcedCenterRequest ? requestedCenterDateKey : undefined,
      });
      const shouldRetry = result === "retry" || isForcedCenterRequest;

      if (shouldRetry && remainingAttempts > 0) {
        scheduleCentering(remainingAttempts - 1);
        return;
      }

      if (isForcedCenterRequest && result === "centered") {
        lastCompletedCenterRequestRef.current = {
          key: centerRequestKey,
          dateKey: requestedCenterDateKey,
        };
        if (requestedCenterDateKey === selectedDateKey) {
          lastAutoCenterSignatureRef.current = autoCenterSignature;
        }
      } else if (!isForcedCenterRequest && result === "centered") {
        lastAutoCenterSignatureRef.current = autoCenterSignature;
      }
    };

    runCentering(CENTER_RETRY_ATTEMPTS);

    return () => {
      isCancelled = true;
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [
    centerRequestKey,
    centerSelectedDate,
    getPillElementByDateKey,
    ignoreNextForcedScrollEvents,
    isActive,
    prefersReducedMotion,
    requestedCenterDateKey,
    resetRenderedRangeAroundDateKey,
    selectedDateKey,
  ]);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      onKeyDownCapture={handleUserDateInteraction}
      onPointerDownCapture={handleUserDateInteraction}
      onTouchStartCapture={handleUserDateInteraction}
      onWheelCapture={handleUserDateInteraction}
      className={cn("flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1")}
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
              handleUserDateInteraction();
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
