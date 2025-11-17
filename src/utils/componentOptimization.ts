import { useCallback, useRef, useEffect } from "react";

// Debounce hook for performance optimization
export const useDebounce = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  ) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
};

// Throttle hook for scroll/resize events
export const useThrottle = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const lastRun = useRef(Date.now());

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastRun.current >= delay) {
        callback(...args);
        lastRun.current = now;
      }
    },
    [callback, delay]
  ) as T;

  return throttledCallback;
};

// Memoize expensive calculations
export const useMemoizedValue = <T>(
  factory: () => T,
  deps: React.DependencyList
): T => {
  const ref = useRef<T>();
  const depsRef = useRef<React.DependencyList>();

  if (
    !depsRef.current ||
    deps.length !== depsRef.current.length ||
    deps.some((dep, i) => !Object.is(dep, depsRef.current![i]))
  ) {
    ref.current = factory();
    depsRef.current = deps;
  }

  return ref.current!;
};

// Virtual scroll helper for large lists
export const useVirtualScroll = (
  itemCount: number,
  itemHeight: number,
  containerHeight: number
) => {
  const scrollTop = useRef(0);
  
  const visibleStart = Math.floor(scrollTop.current / itemHeight);
  const visibleEnd = Math.min(
    itemCount,
    Math.ceil((scrollTop.current + containerHeight) / itemHeight)
  );
  
  const offsetY = visibleStart * itemHeight;
  const visibleItems = Array.from(
    { length: visibleEnd - visibleStart },
    (_, i) => visibleStart + i
  );

  return {
    visibleItems,
    offsetY,
    totalHeight: itemCount * itemHeight,
    onScroll: (e: React.UIEvent<HTMLElement>) => {
      scrollTop.current = e.currentTarget.scrollTop;
    },
  };
};
