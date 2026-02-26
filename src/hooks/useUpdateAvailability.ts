import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { logger } from "@/utils/logger";
import { registerSW } from "@/utils/pwaRegister";
import { safeLocalStorage } from "@/utils/storage";
import { isVersionNewer } from "@/utils/versionCompare";
import type {
  UpdateAvailability,
  UpdateChannel,
  UseUpdateAvailabilityResult,
} from "@/types/updateAvailability";

const IOS_BUNDLE_ID = "com.darrylgraham.revolution";
const IOS_LOOKUP_URL = `https://itunes.apple.com/lookup?bundleId=${IOS_BUNDLE_ID}`;
const UPDATE_DISMISS_PREFIX = "update-dismissed";
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const RESUME_COOLDOWN_MS = 10_000; // 10 seconds

interface IOSLookupResult {
  bundleId?: string;
  version?: string;
  trackViewUrl?: string;
  trackId?: number;
}

interface IOSLookupResponse {
  resultCount?: number;
  results?: IOSLookupResult[];
}

interface InternalUpdateState extends UpdateAvailability {
  storeUrl: string | null;
}

const EMPTY_STATE: InternalUpdateState = {
  hasUpdate: false,
  channel: null,
  currentVersion: null,
  latestVersion: null,
  storeUrl: null,
};

const dismissKey = (channel: UpdateChannel, versionKey: string): string =>
  `${UPDATE_DISMISS_PREFIX}:${channel}:${versionKey}`;

const isDismissed = (channel: UpdateChannel, versionKey: string): boolean =>
  safeLocalStorage.getItem(dismissKey(channel, versionKey)) === "1";

const hashString = (input: string): string => {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash) + input.charCodeAt(index);
  }
  return Math.abs(hash).toString(36);
};

const resolveServiceWorkerVersion = async (scriptUrl: string | undefined): Promise<string | null> => {
  if (!scriptUrl) return null;

  try {
    const response = await fetch(scriptUrl, { cache: "no-store" });
    if (!response.ok) return scriptUrl;
    const body = await response.text();
    return `sw-${hashString(body)}`;
  } catch {
    return scriptUrl;
  }
};

const isIOSNative = (): boolean => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

export const useUpdateAvailability = (): UseUpdateAvailabilityResult => {
  const [availability, setAvailability] = useState<InternalUpdateState>(EMPTY_STATE);
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const swApplyUpdateRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);
  const lastCheckRef = useRef<number>(0);
  const isDisposedRef = useRef<boolean>(false);

  const setAvailabilitySafely = useCallback((next: InternalUpdateState) => {
    if (isDisposedRef.current) return;
    setAvailability(next);
  }, []);

  const resolvePwaUpdate = useCallback(async (): Promise<InternalUpdateState | null> => {
    if (Capacitor.isNativePlatform()) return null;
    if (!("serviceWorker" in navigator)) return null;

    const registration = swRegistrationRef.current ?? await navigator.serviceWorker.getRegistration();
    if (!registration) return null;

    const waitingVersion = await resolveServiceWorkerVersion(registration.waiting?.scriptURL);
    const activeVersion = await resolveServiceWorkerVersion(registration.active?.scriptURL);
    const versionKey = waitingVersion ?? registration.waiting?.scriptURL ?? "sw-update";

    if (isDismissed("pwa", versionKey)) return null;

    return {
      hasUpdate: true,
      channel: "pwa",
      currentVersion: activeVersion,
      latestVersion: versionKey,
      storeUrl: null,
    };
  }, []);

  const resolveIOSStoreUpdate = useCallback(async (): Promise<InternalUpdateState | null> => {
    if (!isIOSNative()) return null;
    if (typeof navigator !== "undefined" && "onLine" in navigator && !navigator.onLine) return null;

    try {
      const appInfo = await CapacitorApp.getInfo();
      const currentVersion = appInfo.version ?? null;
      if (!currentVersion) return null;

      const response = await fetch(IOS_LOOKUP_URL, { cache: "no-store" });
      if (!response.ok) return null;

      const payload = (await response.json()) as IOSLookupResponse;
      if (!payload.results || payload.results.length === 0) return null;

      const storeResult =
        payload.results.find((result) => result.bundleId === IOS_BUNDLE_ID) ??
        payload.results[0];

      const latestVersion = storeResult.version ?? null;
      if (!latestVersion) return null;
      if (!isVersionNewer(currentVersion, latestVersion)) return null;
      if (isDismissed("ios_store", latestVersion)) return null;

      const trackViewUrl =
        storeResult.trackViewUrl ??
        (storeResult.trackId ? `https://apps.apple.com/app/id${storeResult.trackId}` : null);

      return {
        hasUpdate: true,
        channel: "ios_store",
        currentVersion,
        latestVersion,
        storeUrl: trackViewUrl,
      };
    } catch (error) {
      logger.debug("iOS store update check failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }, []);

  const checkForUpdates = useCallback(async (source: string, force = false) => {
    const now = Date.now();
    const elapsed = now - lastCheckRef.current;
    if (!force && elapsed < RESUME_COOLDOWN_MS) return;

    lastCheckRef.current = now;

    if (isIOSNative()) {
      const next = await resolveIOSStoreUpdate();
      setAvailabilitySafely(next ?? EMPTY_STATE);
      return;
    }

    if (Capacitor.isNativePlatform()) return;
    if (!("serviceWorker" in navigator)) return;

    try {
      const registration = swRegistrationRef.current ?? await navigator.serviceWorker.getRegistration();
      if (!registration) return;
      swRegistrationRef.current = registration;
      await registration.update();
    } catch (error) {
      logger.debug("PWA update check failed", {
        source,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [resolveIOSStoreUpdate, setAvailabilitySafely]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return undefined;
    if (!("serviceWorker" in navigator)) return undefined;

    const applyUpdate = registerSW({
      immediate: true,
      onRegisteredSW: (_swUrl, registration) => {
        swRegistrationRef.current = registration ?? null;
        void registration?.update();
      },
      onNeedRefresh: () => {
        void (async () => {
          const next = await resolvePwaUpdate();
          setAvailabilitySafely(next ?? EMPTY_STATE);
        })();
      },
    });

    swApplyUpdateRef.current = applyUpdate;

    return () => {
      swApplyUpdateRef.current = null;
      swRegistrationRef.current = null;
    };
  }, [resolvePwaUpdate, setAvailabilitySafely]);

  useEffect(() => {
    isDisposedRef.current = false;
    void checkForUpdates("launch", true);

    const intervalId = window.setInterval(() => {
      void checkForUpdates("interval", true);
    }, CHECK_INTERVAL_MS);

    if (isIOSNative()) {
      let isDisposed = false;
      let listenerHandle: { remove: () => Promise<void> } | null = null;

      const setupListener = async () => {
        const handle = await CapacitorApp.addListener("appStateChange", ({ isActive }) => {
          if (!isActive) return;
          void checkForUpdates("appStateChange");
        });

        if (isDisposed) {
          await handle.remove();
          return;
        }

        listenerHandle = handle;
      };

      void setupListener();

      return () => {
        isDisposed = true;
        isDisposedRef.current = true;
        window.clearInterval(intervalId);
        if (listenerHandle) {
          void listenerHandle.remove();
        }
      };
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      void checkForUpdates("visibilitychange");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isDisposedRef.current = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkForUpdates]);

  const updateAction = useCallback(async () => {
    if (!availability.hasUpdate || !availability.channel) return;

    if (availability.channel === "pwa") {
      const applyUpdate = swApplyUpdateRef.current;
      if (applyUpdate) {
        await applyUpdate(true);
        return;
      }

      window.location.reload();
      return;
    }

    if (availability.channel === "ios_store" && availability.storeUrl) {
      const popup = window.open(availability.storeUrl, "_blank", "noopener,noreferrer");
      if (!popup) {
        window.location.href = availability.storeUrl;
      }
    }
  }, [availability]);

  const dismiss = useCallback((versionKey: string) => {
    if (!availability.channel) return;
    const normalizedVersionKey = versionKey.trim();
    if (!normalizedVersionKey) return;

    safeLocalStorage.setItem(dismissKey(availability.channel, normalizedVersionKey), "1");
    setAvailabilitySafely(EMPTY_STATE);
  }, [availability.channel, setAvailabilitySafely]);

  return {
    hasUpdate: availability.hasUpdate,
    channel: availability.channel,
    currentVersion: availability.currentVersion,
    latestVersion: availability.latestVersion,
    updateAction,
    dismiss,
  };
};
