import { useCallback, useEffect, useRef } from 'react';

type TimerKind = 'timeout' | 'interval';
type TimerHandle = ReturnType<typeof setTimeout>;

export const useMountedRef = () => {
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return mountedRef;
};

export const useTimerRegistry = () => {
  const timersRef = useRef(new Map<TimerHandle, TimerKind>());

  const clearTimer = useCallback((timer: TimerHandle | null | undefined) => {
    if (!timer) return;
    const kind = timersRef.current.get(timer);
    if (!kind) return;

    if (kind === 'interval') {
      clearInterval(timer);
    } else {
      clearTimeout(timer);
    }
    timersRef.current.delete(timer);
  }, []);

  const registerTimeout = useCallback(
    (callback: () => void, delayMs: number) => {
      const timer = setTimeout(() => {
        timersRef.current.delete(timer);
        callback();
      }, delayMs);
      timersRef.current.set(timer, 'timeout');
      return timer;
    },
    [],
  );

  const registerInterval = useCallback((callback: () => void, delayMs: number) => {
    const timer = setInterval(callback, delayMs);
    timersRef.current.set(timer, 'interval');
    return timer;
  }, []);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((kind, timer) => {
      if (kind === 'interval') {
        clearInterval(timer);
      } else {
        clearTimeout(timer);
      }
    });
    timersRef.current.clear();
  }, []);

  useEffect(() => clearAllTimers, [clearAllTimers]);

  return {
    registerTimeout,
    registerInterval,
    clearTimer,
    clearAllTimers,
  };
};

export const useSingleCompletion = <TArgs extends unknown[]>(
  onComplete: (...args: TArgs) => void,
) => {
  const mountedRef = useMountedRef();
  const hasCompletedRef = useRef(false);

  const completeOnce = useCallback(
    (...args: TArgs) => {
      if (!mountedRef.current || hasCompletedRef.current) return false;
      hasCompletedRef.current = true;
      onComplete(...args);
      return true;
    },
    [mountedRef, onComplete],
  );

  return {
    completeOnce,
    hasCompletedRef,
  };
};
