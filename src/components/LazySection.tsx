import { useState, useEffect, useRef, ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface LazySectionProps {
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
  rootMargin?: string;
  threshold?: number;
}

/**
 * LazySection - Intersection Observer wrapper for deferred rendering
 * Only renders children when the section becomes visible in viewport
 */
export const LazySection = ({
  children,
  fallback,
  className,
  rootMargin = '100px',
  threshold = 0.1,
}: LazySectionProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Stop observing once visible
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  return (
    <div ref={ref} className={className}>
      {isVisible ? children : (fallback || <DefaultFallback />)}
    </div>
  );
};

const DefaultFallback = () => (
  <div className="space-y-4 p-4">
    <Skeleton className="h-6 w-3/4" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-5/6" />
  </div>
);

export default LazySection;
