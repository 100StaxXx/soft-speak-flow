import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
} from "react";
import { ArrowDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshContainerProps {
  children: ReactNode;
  onRefresh: () => Promise<void> | void;
  enabled?: boolean;
  threshold?: number;
  maxPullDistance?: number;
  className?: string;
}

interface TouchPoint {
  x: number;
  y: number;
}

const toDampedPullDistance = (rawDistance: number, maxDistance: number) => {
  if (rawDistance <= 0) return 0;

  // Non-linear resistance to keep pull smooth near the start and harder near max.
  const resistance = 1 - Math.exp(-rawDistance / maxDistance);
  return Math.min(maxDistance, resistance * maxDistance);
};

export function PullToRefreshContainer({
  children,
  onRefresh,
  enabled = true,
  threshold = 72,
  maxPullDistance = 128,
  className,
}: PullToRefreshContainerProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTouching, setIsTouching] = useState(false);

  const touchStartRef = useRef<TouchPoint | null>(null);
  const isPullingRef = useRef(false);

  const resetGesture = useCallback(() => {
    touchStartRef.current = null;
    isPullingRef.current = false;
    setIsTouching(false);
    setPullDistance(0);
  }, []);

  useEffect(() => {
    if (enabled) return;
    resetGesture();
  }, [enabled, resetGesture]);

  const handleTouchStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (!enabled || isRefreshing) return;
      if (event.touches.length !== 1) return;
      if (window.scrollY > 0) return;

      const touch = event.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      isPullingRef.current = true;
      setIsTouching(true);
    },
    [enabled, isRefreshing],
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (!enabled || isRefreshing) return;
      if (!isPullingRef.current || !touchStartRef.current) return;

      const touch = event.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      if (deltaY <= 0) {
        setPullDistance(0);
        return;
      }

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
        resetGesture();
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }

      const dampedDistance = toDampedPullDistance(deltaY, maxPullDistance);
      setPullDistance(dampedDistance);
    },
    [enabled, isRefreshing, maxPullDistance, resetGesture],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!enabled || isRefreshing) {
      resetGesture();
      return;
    }

    const shouldRefresh = pullDistance >= threshold;
    touchStartRef.current = null;
    isPullingRef.current = false;
    setIsTouching(false);

    if (!shouldRefresh) {
      setPullDistance(0);
      return;
    }

    setPullDistance(threshold);
    setIsRefreshing(true);

    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [enabled, isRefreshing, onRefresh, pullDistance, resetGesture, threshold]);

  const handleTouchCancel = useCallback(() => {
    resetGesture();
  }, [resetGesture]);

  const indicatorProgress = useMemo(() => {
    if (threshold <= 0) return 0;
    return Math.min(1, pullDistance / threshold);
  }, [pullDistance, threshold]);

  const reachedThreshold = !isRefreshing && pullDistance >= threshold;
  const showIndicator = isRefreshing || pullDistance > 0;
  const indicatorLabel = isRefreshing
    ? "Refreshing..."
    : reachedThreshold
      ? "Release to refresh"
      : "Pull to refresh";

  return (
    <div
      className={cn("relative", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => {
        void handleTouchEnd();
      }}
      onTouchCancel={handleTouchCancel}
    >
      <div
        className="pointer-events-none fixed left-1/2 z-50 transition-all duration-150"
        style={{
          top: "max(env(safe-area-inset-top, 0px), 8px)",
          opacity: showIndicator ? 1 : 0,
          transform: `translate(-50%, ${Math.max(-56, pullDistance - 56)}px)`,
        }}
      >
        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card/85 px-3 py-1.5 shadow-[0_4px_18px_rgba(0,0,0,0.2)] backdrop-blur-md">
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <ArrowDown
              className={cn("h-4 w-4 transition-colors", reachedThreshold ? "text-primary" : "text-muted-foreground")}
              style={{
                opacity: Math.max(0.35, indicatorProgress),
                transform: `rotate(${indicatorProgress * 180}deg) scale(${0.85 + indicatorProgress * 0.15})`,
              }}
            />
          )}
          <span className={cn("text-xs", reachedThreshold ? "text-primary" : "text-muted-foreground")}>
            {indicatorLabel}
          </span>
        </div>
      </div>

      <div
        className={cn("will-change-transform", isTouching ? "transition-none" : "transition-transform duration-150")}
        style={{ transform: `translateY(${pullDistance}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
