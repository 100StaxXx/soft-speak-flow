/**
 * Performance monitoring utilities for production use
 * Lightweight performance tracking without console logs in production
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: Map<string, number> = new Map();
  private enabled: boolean;

  constructor() {
    // Only enable in development
    this.enabled = import.meta.env.DEV;
  }

  /**
   * Start tracking a performance metric
   */
  start(label: string): void {
    if (!this.enabled) return;
    this.metrics.set(label, performance.now());
  }

  /**
   * End tracking and optionally log the result
   */
  end(label: string, logResult = false): number | undefined {
    if (!this.enabled) return undefined;

    const startTime = this.metrics.get(label);
    if (!startTime) {
      console.warn(`Performance metric "${label}" was never started`);
      return undefined;
    }

    const duration = performance.now() - startTime;
    this.metrics.delete(label);

    if (logResult) {
      console.log(`⚡ ${label}: ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  /**
   * Measure and log a function execution time
   */
  async measure<T>(label: string, fn: () => T | Promise<T>): Promise<T> {
    if (!this.enabled) return fn();

    this.start(label);
    try {
      const result = await fn();
      this.end(label, true);
      return result;
    } catch (error) {
      this.end(label, true);
      throw error;
    }
  }

  /**
   * Get Web Vitals if available
   */
  reportWebVitals(): void {
    if (!this.enabled || typeof window === 'undefined') return;

    // Report LCP (Largest Contentful Paint)
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        console.log(`LCP: ${entry.startTime.toFixed(2)}ms`);
      }
    });

    try {
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch {
      // LCP not supported
    }
  }
}

// Singleton instance
export const perfMonitor = new PerformanceMonitor();

/**
 * HOC to measure component render time
 */
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.ComponentType<P> {
  if (!import.meta.env.DEV) return Component;

  return (props: P) => {
    perfMonitor.start(`${componentName} render`);
    const result = <Component {...props} />;
    perfMonitor.end(`${componentName} render`, false);
    return result;
  };
}
