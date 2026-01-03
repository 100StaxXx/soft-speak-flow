import { useRef, useCallback, useEffect } from 'react';

interface UseAutoscrollOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  edgeThreshold?: number; // Distance from edge to start scrolling (px)
  scrollSpeed?: number; // Pixels per frame
  enabled?: boolean;
}

export function useAutoscroll({
  containerRef,
  edgeThreshold = 80,
  scrollSpeed = 8,
  enabled = false,
}: UseAutoscrollOptions) {
  const rafRef = useRef<number | null>(null);
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const currentYRef = useRef<number>(0);

  const stopScroll = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    scrollDirectionRef.current = null;
  }, []);

  const scrollFrame = useCallback(() => {
    const container = containerRef.current;
    if (!container || !scrollDirectionRef.current) {
      stopScroll();
      return;
    }

    // Use window scrolling since content is usually in window
    const scrollContainer = window;
    const currentScroll = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

    if (scrollDirectionRef.current === 'up' && currentScroll > 0) {
      window.scrollBy(0, -scrollSpeed);
    } else if (scrollDirectionRef.current === 'down' && currentScroll < maxScroll) {
      window.scrollBy(0, scrollSpeed);
    }

    rafRef.current = requestAnimationFrame(scrollFrame);
  }, [containerRef, scrollSpeed, stopScroll]);

  const updatePosition = useCallback((clientY: number) => {
    if (!enabled) return;
    
    currentYRef.current = clientY;
    const viewportHeight = window.innerHeight;
    
    // Check if near top or bottom of viewport
    const nearTop = clientY < edgeThreshold;
    const nearBottom = clientY > viewportHeight - edgeThreshold;
    
    if (nearTop && scrollDirectionRef.current !== 'up') {
      scrollDirectionRef.current = 'up';
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(scrollFrame);
      }
    } else if (nearBottom && scrollDirectionRef.current !== 'down') {
      scrollDirectionRef.current = 'down';
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(scrollFrame);
      }
    } else if (!nearTop && !nearBottom) {
      stopScroll();
    }
  }, [enabled, edgeThreshold, scrollFrame, stopScroll]);

  // Cleanup on unmount or when disabled
  useEffect(() => {
    if (!enabled) {
      stopScroll();
    }
    return () => stopScroll();
  }, [enabled, stopScroll]);

  return {
    updatePosition,
    stopScroll,
  };
}
