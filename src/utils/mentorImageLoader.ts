/**
 * Dynamic mentor image loader.
 * Only imports the requested fallback portrait instead of the whole roster upfront.
 */

import { isActiveMentorSlug, resolveMentorSlugAlias } from "@/lib/mentorRoster";

const imageCache = new Map<string, string>();

const shouldUseBundledImage = (slug: string, avatarUrl?: string | null): boolean => {
  const resolvedSlug = resolveMentorSlugAlias(slug);
  if (!resolvedSlug) return !avatarUrl?.trim();

  // Canonical Guides ship with a cohesive, reviewed portrait set. Prefer it over
  // legacy storage URLs so existing accounts receive the new art immediately.
  if (isActiveMentorSlug(resolvedSlug)) return true;

  const trimmedAvatarUrl = avatarUrl?.trim();
  if (!trimmedAvatarUrl) return true;

  return false;
};

export const getDirectMentorAvatarUrl = (
  slug: string,
  avatarUrl?: string | null,
): string | null => {
  const trimmedAvatarUrl = avatarUrl?.trim();
  if (trimmedAvatarUrl && !shouldUseBundledImage(slug, trimmedAvatarUrl)) {
    return trimmedAvatarUrl;
  }

  return null;
};

export const loadMentorImage = async (slug: string): Promise<string> => {
  const resolvedSlug = resolveMentorSlugAlias(slug) ?? "sage";

  if (imageCache.has(resolvedSlug)) {
    return imageCache.get(resolvedSlug)!;
  }

  try {
    let module;
    switch (resolvedSlug) {
      case "sage":
        module = await import("@/assets/guides/sage-guide.jpg");
        break;
      case "lyra":
        module = await import("@/assets/guides/lyra-guide.jpg");
        break;
      case "icon":
        module = await import("@/assets/guides/icon-guide.jpg");
        break;
      case "charles":
        module = await import("@/assets/guides/charles-guide.jpg");
        break;
      case "princess":
        module = await import("@/assets/guides/princess-guide.jpg");
        break;
      case "operator":
        module = await import("@/assets/guides/operator-guide.jpg");
        break;
      case "rival":
        module = await import("@/assets/guides/rival-guide.jpg");
        break;
      case "reign":
        module = await import("@/assets/reign-sage.png");
        break;
      default:
        module = await import("@/assets/guides/sage-guide.jpg");
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

export const resolveMentorImageSource = async (
  slug: string,
  avatarUrl?: string | null,
): Promise<string> => {
  const directAvatarUrl = getDirectMentorAvatarUrl(slug, avatarUrl);
  if (directAvatarUrl) return directAvatarUrl;

  return loadMentorImage(slug);
};

export const preloadMentorImage = (slug: string): void => {
  loadMentorImage(slug).catch(() => {
    // Ignore preload failures.
  });
};

export const clearMentorImageCache = (): void => {
  imageCache.clear();
};
