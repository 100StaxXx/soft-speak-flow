import { useRef, useCallback, useEffect } from 'react';

interface UseAutoscrollOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  edgeThreshold?: number; // Distance from edge to start scrolling (px)
  scrollSpeed?: number; // Baseline pixels per frame
  enabled?: boolean;
}

type ScrollTarget =
  | { kind: 'window' }
  | { kind: 'element'; element: HTMLElement };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getMaxWindowScroll = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

const isScrollableElement = (element: HTMLElement) => {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY || style.overflow;
  const canScroll = /(auto|scroll|overlay)/i.test(overflowY);
  return canScroll && element.scrollHeight > element.clientHeight;
};

const findNearestScrollableTarget = (container: HTMLElement | null): ScrollTarget => {
  if (!container) return { kind: 'window' };

  let node: HTMLElement | null = container;
  while (node) {
    if (isScrollableElement(node)) {
      return { kind: 'element', element: node };
    }
    node = node.parentElement;
  }

  return { kind: 'window' };
};

export function useAutoscroll({
  containerRef,
  edgeThreshold = 80,
  scrollSpeed = 8,
  enabled = false,
}: UseAutoscrollOptions) {
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef<ScrollTarget>({ kind: 'window' });
  const velocityRef = useRef(0);

  const stopScroll = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    velocityRef.current = 0;
  }, []);

  const scrollFrame = useCallback(() => {
    if (!enabled || velocityRef.current === 0) {
      stopScroll();
      return;
    }

    const velocity = velocityRef.current;
    let didScroll = false;

    if (targetRef.current.kind === 'window') {
      const current = window.scrollY;
      const max = getMaxWindowScroll();
      const next = clamp(current + velocity, 0, max);

      if (Math.abs(next - current) > 0.01) {
        window.scrollTo({ top: next, left: window.scrollX, behavior: 'auto' });
        didScroll = true;
      }
    } else {
      const { element } = targetRef.current;
      const current = element.scrollTop;
      const max = Math.max(0, element.scrollHeight - element.clientHeight);
      const next = clamp(current + velocity, 0, max);

      if (Math.abs(next - current) > 0.01) {
        element.scrollTop = next;
        didScroll = true;
      }
    }

    if (!didScroll) {
      stopScroll();
      return;
    }

    rafRef.current = requestAnimationFrame(scrollFrame);
  }, [enabled, stopScroll]);

  const getDistanceToEdges = useCallback((clientY: number) => {
    if (targetRef.current.kind === 'window') {
      return {
        topDistance: clientY,
        bottomDistance: window.innerHeight - clientY,
      };
    }

    const rect = targetRef.current.element.getBoundingClientRect();
    return {
      topDistance: clientY - rect.top,
      bottomDistance: rect.bottom - clientY,
    };
  }, []);

  const getSpeedFromEdgeDistance = useCallback(
    (distanceToEdge: number) => {
      const boundedDistance = clamp(distanceToEdge, 0, edgeThreshold);
      const normalized = 1 - boundedDistance / edgeThreshold;
      if (normalized <= 0) return 0;

      const minSpeed = Math.max(1, scrollSpeed * 0.5);
      const maxSpeed = Math.max(minSpeed + 1, scrollSpeed * 2.5);
      // Non-linear ramp: speeds up significantly near the edge.
      const ramp = normalized * normalized;
      return minSpeed + ((maxSpeed - minSpeed) * ramp);
    },
    [edgeThreshold, scrollSpeed],
  );

  const updatePosition = useCallback((clientY: number) => {
    if (!enabled) return;

    targetRef.current = findNearestScrollableTarget(containerRef.current);

    const { topDistance, bottomDistance } = getDistanceToEdges(clientY);
    const nearTop = topDistance <= edgeThreshold;
    const nearBottom = bottomDistance <= edgeThreshold;

    let nextVelocity = 0;

    if (nearTop && (!nearBottom || topDistance <= bottomDistance)) {
      nextVelocity = -getSpeedFromEdgeDistance(topDistance);
    } else if (nearBottom) {
      nextVelocity = getSpeedFromEdgeDistance(bottomDistance);
    }

    velocityRef.current = nextVelocity;

    if (nextVelocity === 0) {
      stopScroll();
      return;
    }

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(scrollFrame);
    }
  }, [containerRef, edgeThreshold, enabled, getDistanceToEdges, getSpeedFromEdgeDistance, scrollFrame, stopScroll]);

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
