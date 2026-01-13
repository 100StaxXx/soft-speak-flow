/**
 * Dynamic Mentor Image Loader
 * Only loads the mentor image that's actually needed, not all 23MB upfront!
 */

type MentorSlug = 'atlas' | 'kai' | 'eli' | 'nova' | 'sienna' | 'lumi' | 'stryker' | 'carmen' | 'reign' | 'elizabeth';

// Cache loaded images to avoid re-importing
const imageCache = new Map<string, string>();

/**
 * Dynamically imports only the needed mentor image
 * This reduces initial bundle size by ~20MB!
 */
export const loadMentorImage = async (slug: string): Promise<string> => {
  // Check cache first
  if (imageCache.has(slug)) {
    return imageCache.get(slug)!;
  }

  // Dynamically import only the needed image
  try {
    let module;
    switch (slug.toLowerCase()) {
      case 'atlas':
        module = await import('@/assets/atlas-sage.png');
        break;
      case 'kai':
        module = await import('@/assets/kai-sage.png');
        break;
      case 'eli':
        module = await import('@/assets/darius-sage.png'); // Eli uses Darius's image
        break;
      case 'nova':
        module = await import('@/assets/nova-sage.png');
        break;
      case 'sienna':
        module = await import('@/assets/sienna-sage.png');
        break;
      case 'lumi':
        module = await import('@/assets/lumi-sage.png');
        break;
      case 'stryker':
        module = await import('@/assets/stryker-sage.png');
        break;
      case 'carmen':
        module = await import('@/assets/carmen-sage.png');
        break;
      case 'reign':
        module = await import('@/assets/reign-sage.png');
        break;
      case 'elizabeth':
        module = await import('@/assets/solace-sage.png'); // Elizabeth uses Solace's image
        break;
      default:
        // Default fallback
        module = await import('@/assets/atlas-sage.png');
    }
    
    const imageUrl = module.default;
    imageCache.set(slug, imageUrl);
    return imageUrl;
  } catch (error) {
    console.error(`Failed to load mentor image for ${slug}:`, error);
    // Return empty string as fallback
    return '';
  }
};

/**
 * Preload a mentor image (for next page/mentor)
 */
export const preloadMentorImage = (slug: string): void => {
  loadMentorImage(slug).catch(() => {
    // Silent fail for preload
  });
};

/**
 * Clear the image cache (useful for memory management)
 */
export const clearMentorImageCache = (): void => {
  imageCache.clear();
};
