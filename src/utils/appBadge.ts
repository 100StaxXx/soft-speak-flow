import { Capacitor, registerPlugin } from "@capacitor/core";
import { logger } from "@/utils/logger";

interface AppBadgePlugin {
  setBadgeCount(options: { count: number }): Promise<void>;
  clearBadge(): Promise<void>;
}

const AppBadge = registerPlugin<AppBadgePlugin>("AppBadge");

const normalizeBadgeCount = (count: number): number =>
  Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;

export async function setAppBadgeCount(count: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const normalizedCount = normalizeBadgeCount(count);

  try {
    if (normalizedCount === 0) {
      await AppBadge.clearBadge();
      return;
    }

    await AppBadge.setBadgeCount({ count: normalizedCount });
  } catch (error) {
    logger.warn("Failed to sync app badge count", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
