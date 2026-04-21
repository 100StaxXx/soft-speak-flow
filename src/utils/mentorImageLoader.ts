/**
 * Dynamic mentor image loader.
 * Only imports the requested fallback portrait instead of the whole roster upfront.
 */

import { resolveMentorSlugAlias } from "@/lib/mentorRoster";

const imageCache = new Map<string, string>();

export const loadMentorImage = async (slug: string): Promise<string> => {
  const resolvedSlug = resolveMentorSlugAlias(slug) ?? "sage";

  if (imageCache.has(resolvedSlug)) {
    return imageCache.get(resolvedSlug)!;
  }

  try {
    let module;
    switch (resolvedSlug) {
      case "sage":
        module = await import("@/assets/sage-mentor.png");
        break;
      case "icon":
        module = await import("@/assets/icon-mentor.png");
        break;
      case "charles":
        module = await import("@/assets/charles-mentor.png");
        break;
      case "princess":
        module = await import("@/assets/princess-mentor.png");
        break;
      case "operator":
        module = await import("@/assets/stryker-sage.png");
        break;
      case "rival":
        module = await import("@/assets/rival-mentor.png");
        break;
      case "reign":
        module = await import("@/assets/reign-sage.png");
        break;
      default:
        module = await import("@/assets/sage-mentor.png");
        break;
    }

    const imageUrl = module.default;
    imageCache.set(resolvedSlug, imageUrl);
    return imageUrl;
  } catch (error) {
    console.error(`Failed to load mentor image for ${slug}:`, error);
    return "";
  }
};

export const preloadMentorImage = (slug: string): void => {
  loadMentorImage(slug).catch(() => {
    // Ignore preload failures.
  });
};

export const clearMentorImageCache = (): void => {
  imageCache.clear();
};
