import { isNativeIOS } from "@/utils/platformTargets";

export function normalizeQuestLocationQuery(location: string | null | undefined): string | null {
  const normalized = location?.trim();
  return normalized ? normalized : null;
}

export function buildQuestLocationUrl(
  location: string | null | undefined,
  options?: { nativeIOS?: boolean },
): string | null {
  const query = normalizeQuestLocationQuery(location);
  if (!query) return null;

  const encodedQuery = encodeURIComponent(query);
  if (options?.nativeIOS) {
    return `https://maps.apple.com/?q=${encodedQuery}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
}

export function openQuestLocation(
  location: string | null | undefined,
  options?: {
    nativeIOS?: boolean;
    openUrl?: (url: string) => void;
  },
): boolean {
  const url = buildQuestLocationUrl(location, {
    nativeIOS: options?.nativeIOS ?? isNativeIOS(),
  });
  if (!url) return false;

  const openUrl = options?.openUrl ?? ((targetUrl: string) => {
    if (options?.nativeIOS ?? isNativeIOS()) {
      window.location.href = targetUrl;
      return;
    }

    window.open(targetUrl, "_blank", "noopener,noreferrer");
  });

  openUrl(url);
  return true;
}
