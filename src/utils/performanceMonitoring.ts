/**
 * Performance Monitoring Utilities
 * 
 * Lightweight performance monitoring for tracking Web Vitals
 * and custom performance metrics.
 * 
 * Usage:
 * import { initPerformanceMonitoring } from '@/utils/performanceMonitoring';
 * initPerformanceMonitoring();
 */

// Performance API types
interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface PerformanceEventTiming extends PerformanceEntry {
  processingStart: number;
}

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

/**
 * Log performance metrics (can be extended to send to analytics)
 */
const logMetric = (metric: PerformanceMetric) => {
  // In development, log to console
  if (import.meta.env.DEV) {
    console.log(`[Performance] ${metric.name}: ${metric.value.toFixed(2)}ms (${metric.rating})`);
  }
  
  // In production, you can send to analytics service
  // Example: sendToAnalytics(metric);
};

/**
 * Get rating based on thresholds (based on Web Vitals)
 */
const getRating = (name: string, value: number): 'good' | 'needs-improvement' | 'poor' => {
  const thresholds = {
    FCP: { good: 1800, poor: 3000 },      // First Contentful Paint
    LCP: { good: 2500, poor: 4000 },      // Largest Contentful Paint
    FID: { good: 100, poor: 300 },        // First Input Delay
    CLS: { good: 0.1, poor: 0.25 },       // Cumulative Layout Shift
    TTFB: { good: 800, poor: 1800 },      // Time to First Byte
    TTI: { good: 3800, poor: 7300 },      // Time to Interactive
  };

  const threshold = thresholds[name as keyof typeof thresholds];
  if (!threshold) return 'good';
  
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
};

/**
 * Measure First Contentful Paint (FCP)
 */
const measureFCP = () => {
  try {
    const paintEntries = performance.getEntriesByType('paint');
    const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    
    if (fcpEntry) {
      logMetric({
        name: 'FCP',
        value: fcpEntry.startTime,
        rating: getRating('FCP', fcpEntry.startTime),
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    console.debug('FCP measurement not available');
  }
};

/**
 * Measure Largest Contentful Paint (LCP)
 */
const measureLCP = () => {
  try {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        
        logMetric({
          name: 'LCP',
          value: lastEntry.startTime,
          rating: getRating('LCP', lastEntry.startTime),
          timestamp: Date.now(),
        });
      });
      
      observer.observe({ 
        type: 'largest-contentful-paint', 
        buffered: true 
      });
    }
  } catch (error) {
    console.debug('LCP measurement not available');
  }
};

/**
 * Measure First Input Delay (FID)
 */
const measureFID = () => {
  try {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries() as PerformanceEventTiming[];
        entries.forEach((entry) => {
          const fid = entry.processingStart - entry.startTime;
          
          logMetric({
            name: 'FID',
            value: fid,
            rating: getRating('FID', fid),
            timestamp: Date.now(),
          });
        });
      });
      
      observer.observe({ 
        type: 'first-input', 
        buffered: true 
      });
    }
  } catch (error) {
    console.debug('FID measurement not available');
  }
};

/**
 * Measure Cumulative Layout Shift (CLS)
 */
const measureCLS = () => {
  try {
    if ('PerformanceObserver' in window) {
      let clsValue = 0;
      
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as LayoutShift;
          if (!layoutShift.hadRecentInput) {
            clsValue += layoutShift.value;
          }
        }
        
        // Log on page hide
        const logCLS = () => {
          logMetric({
            name: 'CLS',
            value: clsValue,
            rating: getRating('CLS', clsValue),
            timestamp: Date.now(),
          });
        };
        
        // Report on visibility change (when user leaves page)
        if (document.visibilityState === 'hidden') {
          logCLS();
        }
      });
      
      observer.observe({ 
        type: 'layout-shift', 
        buffered: true 
      });
      
      // Also report on page hide
      window.addEventListener('pagehide', () => {
        logMetric({
          name: 'CLS',
          value: clsValue,
          rating: getRating('CLS', clsValue),
          timestamp: Date.now(),
        });
      }, { once: true });
    }
  } catch (error) {
    console.debug('CLS measurement not available');
  }
};

/**
 * Measure Time to First Byte (TTFB)
 */
const measureTTFB = () => {
  try {
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (navigationEntry) {
      const ttfb = navigationEntry.responseStart - navigationEntry.requestStart;
      
      logMetric({
        name: 'TTFB',
        value: ttfb,
        rating: getRating('TTFB', ttfb),
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    console.debug('TTFB measurement not available');
  }
};

/**
 * Measure Time to Interactive (TTI)
 * Simplified estimation based on DOMContentLoaded and load events
 */
const measureTTI = () => {
  try {
    window.addEventListener('load', () => {
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      if (navigationEntry) {
        const tti = navigationEntry.domInteractive;
        
        logMetric({
          name: 'TTI',
          value: tti,
          rating: getRating('TTI', tti),
          timestamp: Date.now(),
        });
      }
    }, { once: true });
  } catch (error) {
    console.debug('TTI measurement not available');
  }
};

/**
 * Measure bundle size (from performance entries)
 */
const measureBundleSize = () => {
  try {
    window.addEventListener('load', () => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      let totalSize = 0;
      let jsSize = 0;
      let cssSize = 0;
      let imageSize = 0;
      
      resources.forEach((resource) => {
        const size = resource.transferSize || 0;
        totalSize += size;
        
        if (resource.name.endsWith('.js')) {
          jsSize += size;
        } else if (resource.name.endsWith('.css')) {
          cssSize += size;
        } else if (resource.name.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) {
          imageSize += size;
        }
      });
      
      if (import.meta.env.DEV) {
        console.log('[Performance] Resource Sizes:', {
          total: `${(totalSize / 1024).toFixed(2)} KB`,
          js: `${(jsSize / 1024).toFixed(2)} KB`,
          css: `${(cssSize / 1024).toFixed(2)} KB`,
          images: `${(imageSize / 1024).toFixed(2)} KB`,
        });
      }
    }, { once: true });
  } catch (error) {
    console.debug('Bundle size measurement not available');
  }
};

/**
 * Initialize performance monitoring
 * Call this once in your app's entry point (main.tsx)
 */
export const initPerformanceMonitoring = () => {
  if (typeof window === 'undefined') return;
  
  // Only measure in production (or enable via flag)
  // Comment out this line to enable in development
  if (import.meta.env.DEV) {
    console.log('[Performance Monitoring] Enabled in development mode');
  }
  
  // Measure Web Vitals
  measureFCP();
  measureLCP();
  measureFID();
  measureCLS();
  measureTTFB();
  measureTTI();
  
  // Measure bundle sizes
  measureBundleSize();
};

/**
 * Custom performance marker
 * Use this to measure specific operations in your app
 * 
 * Example:
 * markPerformance('mentor-image-load-start');
 * // ... load image ...
 * measurePerformance('mentor-image-load', 'mentor-image-load-start');
 */
export const markPerformance = (markName: string) => {
  try {
    performance.mark(markName);
  } catch (error) {
    console.debug('Performance mark not available');
  }
};

export const measurePerformance = (measureName: string, startMark: string, endMark?: string) => {
  try {
    if (endMark) {
      performance.measure(measureName, startMark, endMark);
    } else {
      performance.measure(measureName, startMark);
    }
    
    const measure = performance.getEntriesByName(measureName)[0];
    if (measure && import.meta.env.DEV) {
      console.log(`[Performance] ${measureName}: ${measure.duration.toFixed(2)}ms`);
    }
  } catch (error) {
    console.debug('Performance measure not available');
  }
};

/**
 * Get all performance metrics
 * Useful for debugging or sending to analytics
 */
export const getAllPerformanceMetrics = () => {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  const paint = performance.getEntriesByType('paint');
  
  return {
    navigation: navigation ? {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      domInteractive: navigation.domInteractive,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      requestStart: navigation.requestStart,
      responseStart: navigation.responseStart,
      responseEnd: navigation.responseEnd,
    } : null,
    paint: paint.map(entry => ({
      name: entry.name,
      startTime: entry.startTime,
    })),
  };
};
