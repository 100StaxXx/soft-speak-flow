import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface AspectRect {
  width: number;
  height: number;
}

const DEFAULT_FALLBACK_MAX_SIDE = 280;

const isFinitePositive = (value: number): boolean => Number.isFinite(value) && value > 0;

const roundSize = (value: number): number => Math.round(value * 100) / 100;

const getFallbackRect = (aspectWidth: number, aspectHeight: number): AspectRect => {
  const normalizedAspectWidth = isFinitePositive(aspectWidth) ? aspectWidth : 1;
  const normalizedAspectHeight = isFinitePositive(aspectHeight) ? aspectHeight : 1;
  const aspectRatio = normalizedAspectWidth / normalizedAspectHeight;

  if (aspectRatio >= 1) {
    return {
      width: DEFAULT_FALLBACK_MAX_SIDE,
      height: roundSize(DEFAULT_FALLBACK_MAX_SIDE / aspectRatio),
    };
  }

  return {
    width: roundSize(DEFAULT_FALLBACK_MAX_SIDE * aspectRatio),
    height: DEFAULT_FALLBACK_MAX_SIDE,
  };
};

export const computeLargestAspectRect = (
  availableWidth: number,
  availableHeight: number,
  aspectWidth: number,
  aspectHeight: number,
): AspectRect => {
  const normalizedAspectWidth = isFinitePositive(aspectWidth) ? aspectWidth : 1;
  const normalizedAspectHeight = isFinitePositive(aspectHeight) ? aspectHeight : 1;
  const normalizedAvailableWidth = isFinitePositive(availableWidth) ? availableWidth : 0;
  const normalizedAvailableHeight = isFinitePositive(availableHeight) ? availableHeight : 0;

  if (normalizedAvailableWidth === 0 || normalizedAvailableHeight === 0) {
    return getFallbackRect(normalizedAspectWidth, normalizedAspectHeight);
  }

  const widthLimitedHeight = (normalizedAvailableWidth * normalizedAspectHeight) / normalizedAspectWidth;
  if (widthLimitedHeight <= normalizedAvailableHeight) {
    return {
      width: roundSize(normalizedAvailableWidth),
      height: roundSize(widthLimitedHeight),
    };
  }

  const heightLimitedWidth = (normalizedAvailableHeight * normalizedAspectWidth) / normalizedAspectHeight;
  return {
    width: roundSize(heightLimitedWidth),
    height: roundSize(normalizedAvailableHeight),
  };
};

export const useMaxAspectRect = (aspectWidth: number, aspectHeight: number) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const fallbackRect = useMemo(
    () => computeLargestAspectRect(0, 0, aspectWidth, aspectHeight),
    [aspectWidth, aspectHeight],
  );
  const [rect, setRect] = useState<AspectRect>(fallbackRect);

  const updateRect = useCallback(() => {
    const hostElement = hostRef.current;
    if (!hostElement) {
      setRect(fallbackRect);
      return;
    }

    const { width, height } = hostElement.getBoundingClientRect();
    const nextRect = computeLargestAspectRect(width, height, aspectWidth, aspectHeight);
    setRect((previous) =>
      previous.width === nextRect.width && previous.height === nextRect.height ? previous : nextRect,
    );
  }, [aspectWidth, aspectHeight, fallbackRect]);

  useEffect(() => {
    updateRect();

    const hostElement = hostRef.current;
    if (!hostElement) return;

    let animationFrameId: number | null = null;
    const scheduleUpdate = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      animationFrameId = requestAnimationFrame(() => {
        updateRect();
      });
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleUpdate);
      resizeObserver.observe(hostElement);
    } else {
      window.addEventListener('resize', scheduleUpdate);
      window.addEventListener('orientationchange', scheduleUpdate);
    }

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', scheduleUpdate);
        window.removeEventListener('orientationchange', scheduleUpdate);
      }
    };
  }, [updateRect]);

  return { hostRef, rect };
};
