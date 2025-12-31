import { useEffect, useRef, useState } from 'react';

/**
 * Hook that tracks element visibility and returns whether animations should play.
 * Useful for pausing expensive animations when elements are off-screen.
 */
export function useVisibleAnimation(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [options]);

  return { ref, isVisible };
}

/**
 * Returns animation class only when element is visible
 */
export function useConditionalAnimation(
  animationClass: string,
  fallbackClass: string = ''
) {
  const { ref, isVisible } = useVisibleAnimation();
  
  return {
    ref,
    className: isVisible ? animationClass : fallbackClass,
    isVisible,
  };
}
