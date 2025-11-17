/**
 * Image Optimization Utilities
 * Prevents performance issues with AI-generated images
 */

// Cache for generated images to avoid re-generating
const imageCache = new Map<string, string>();

export const cacheImage = (key: string, dataUrl: string) => {
  imageCache.set(key, dataUrl);
};

export const getCachedImage = (key: string): string | undefined => {
  return imageCache.get(key);
};

export const clearImageCache = () => {
  imageCache.clear();
};

// Debounce utility for expensive operations
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Lazy load images
export const createLazyImageObserver = (
  onIntersect: (element: HTMLElement) => void
) => {
  if (typeof IntersectionObserver === 'undefined') {
    return null;
  }

  return new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          onIntersect(entry.target as HTMLElement);
        }
      });
    },
    {
      rootMargin: '50px',
    }
  );
};

// Compress base64 image data (basic quality reduction)
export const compressBase64Image = async (
  base64: string,
  maxWidth: number = 1024,
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Scale down if needed
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to compressed format
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };
    
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
};
