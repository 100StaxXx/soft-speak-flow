import { useCallback } from 'react';
import { haptics } from '@/utils/haptics';

/**
 * Enhanced haptic feedback hook with semantic actions
 */
export const useHapticFeedback = () => {
  const light = useCallback(() => {
    haptics.light();
  }, []);

  const medium = useCallback(() => {
    haptics.medium();
  }, []);

  const heavy = useCallback(() => {
    haptics.heavy();
  }, []);

  const success = useCallback(() => {
    haptics.success();
  }, []);

  const error = useCallback(() => {
    haptics.error();
  }, []);

  // Semantic haptic actions
  const tap = useCallback(() => {
    haptics.light();
  }, []);

  const press = useCallback(() => {
    haptics.medium();
  }, []);

  const complete = useCallback(() => {
    haptics.success();
  }, []);

  const fail = useCallback(() => {
    haptics.error();
  }, []);

  const toggle = useCallback((isOn: boolean) => {
    if (isOn) {
      haptics.light();
    } else {
      haptics.medium();
    }
  }, []);

  return {
    light,
    medium,
    heavy,
    success,
    error,
    tap,
    press,
    complete,
    fail,
    toggle,
  };
};
