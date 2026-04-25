/**
 * Dynamic mentor image loader.
 * Only imports the requested fallback portrait instead of the whole roster upfront.
 */

import { resolveMentorSlugAlias } from "@/lib/mentorRoster";

const imageCache = new Map<string, string>();
const KNOWN_STALE_AVATAR_PATHS: Record<string, readonly string[]> = {
  lyra: ["/mentors-avatars/lyra-mentor.png"],
};

const shouldUseBundledImage = (slug: string, avatarUrl?: string | null): boolean => {
  const resolvedSlug = resolveMentorSlugAlias(slug);
  if (!resolvedSlug) return !avatarUrl?.trim();

  const trimmedAvatarUrl = avatarUrl?.trim();
  if (!trimmedAvatarUrl) return true;

  return KNOWN_STALE_AVATAR_PATHS[resolvedSlug]?.some((path) =>
    trimmedAvatarUrl.includes(path),
  ) ?? false;
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
        module = await import("@/assets/sage-mentor.png");
        break;
      case "lyra":
        module = await import("@/assets/lyra-mentor.png");
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
