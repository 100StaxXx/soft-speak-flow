import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useQuery } from "@tanstack/react-query";
import {
  createRemoteBackgroundAsset,
  type StaticBackgroundAsset,
} from "@/assets/backgrounds";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";
import { safeLocalStorage } from "@/utils/storage";
import {
  addDaysToWallpaperDate,
  getEffectiveWallpaperDate,
  getNextWallpaperBoundary,
  toObjectPosition,
  type LiveWallpaperManifestEntry,
  type WallpaperAssignmentSource,
  type WallpaperPageKey,
} from "@/shared/wallpaperCatalog";

type LiveWallpaperManifestRow = Database["public"]["Views"]["live_wallpaper_manifest_v"]["Row"];

export interface ResolvedWallpaper {
  dateKey: string;
  imageUrl: string;
  background: StaticBackgroundAsset;
  mobileObjectPosition: string;
  desktopObjectPosition: string;
  source: "remote";
  assignmentSource: WallpaperAssignmentSource | null;
}

interface WallpaperManifestContextValue {
  currentDateKey: string;
  nextDateKey: string;
  isRefreshing: boolean;
  error: Error | null;
  manifestByDate: Record<string, Partial<Record<WallpaperPageKey, LiveWallpaperManifestEntry>>>;
  currentDateReady: boolean;
  refresh: () => Promise<void>;
  useResolvedWallpaperForPage: (pageKey: WallpaperPageKey) => ResolvedWallpaper | null;
  reportWallpaperRenderError: (pageKey: WallpaperPageKey, imageUrl: string) => void;
}

const WallpaperManifestContext = createContext<WallpaperManifestContextValue | null>(null);

const CACHE_KEY = "wallpaper-manifest-cache-v2";
const CACHE_VERSION = 3;

interface WallpaperManifestCachePayload {
  version: number;
  savedAt: string;
  manifestByDate: Record<string, Partial<Record<WallpaperPageKey, LiveWallpaperManifestEntry>>>;
  resolvedDateKeys: string[];
}

interface LegacyWallpaperManifestCachePayload {
  version: 2;
  savedAt: string;
  manifestByDate: Record<string, Partial<Record<WallpaperPageKey, LiveWallpaperManifestEntry>>>;
}

const isWallpaperPageKey = (value: string | null | undefined): value is WallpaperPageKey => (
  value === "guide"
  || value === "quests"
  || value === "campaigns"
  || value === "companion"
  || value === "profile"
  || value === "pep_talk"
);

const mergeDateKeys = (current: string[], next: string[]) => (
  [...new Set([...current, ...next.filter(Boolean)])]
);

const readWallpaperManifestCache = (
  targetDates: string[],
): WallpaperManifestCachePayload | null => {
  const raw = safeLocalStorage.getItem(CACHE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as WallpaperManifestCachePayload | LegacyWallpaperManifestCachePayload;
    if (
      (parsed.version !== 2 && parsed.version !== CACHE_VERSION)
      || !parsed.manifestByDate
      || typeof parsed.manifestByDate !== "object"
    ) {
      return null;
    }

    const manifestByDate = Object.fromEntries(
      targetDates
        .filter((dateKey) => Boolean(parsed.manifestByDate[dateKey]))
        .map((dateKey) => [dateKey, parsed.manifestByDate[dateKey]]),
    ) as WallpaperManifestCachePayload["manifestByDate"];

    const resolvedDateKeys = Array.isArray((parsed as WallpaperManifestCachePayload).resolvedDateKeys)
      ? (parsed as WallpaperManifestCachePayload).resolvedDateKeys
        .filter((dateKey): dateKey is string => typeof dateKey === "string" && targetDates.includes(dateKey))
      : Object.keys(manifestByDate);

    return {
      version: CACHE_VERSION,
      savedAt: parsed.savedAt,
      manifestByDate,
      resolvedDateKeys,
    };
  } catch (_error) {
    return null;
  }
};

const writeWallpaperManifestCache = (
  payload: Pick<WallpaperManifestCachePayload, "manifestByDate" | "resolvedDateKeys">,
) => {
  safeLocalStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      version: CACHE_VERSION,
      savedAt: new Date().toISOString(),
      manifestByDate: payload.manifestByDate,
      resolvedDateKeys: payload.resolvedDateKeys,
    } satisfies WallpaperManifestCachePayload),
  );
};

const normalizeManifestRows = (
  rows: LiveWallpaperManifestRow[] | null | undefined,
) => (rows ?? []).reduce<Record<string, Partial<Record<WallpaperPageKey, LiveWallpaperManifestEntry>>>>(
  (acc, row) => {
    if (
      typeof row.for_date !== "string"
      || !isWallpaperPageKey(row.page_key)
      || typeof row.image_url !== "string"
      || typeof row.updated_at !== "string"
    ) {
      return acc;
    }

    const pageKey = row.page_key;
    acc[row.for_date] ??= {};
    acc[row.for_date][pageKey] = {
      forDate: row.for_date,
      pageKey,
      assignmentSource: (row.assignment_source as WallpaperAssignmentSource | null) ?? null,
      imageUrl: row.image_url,
      mobileFocusX: row.mobile_focus_x,
      mobileFocusY: row.mobile_focus_y,
      desktopFocusX: row.desktop_focus_x,
      desktopFocusY: row.desktop_focus_y,
      updatedAt: row.updated_at,
    };
    return acc;
  },
  {},
);

const preloadImage = async (imageUrl: string) => {
  if (typeof window === "undefined") {
    return;
  }

  if (/jsdom/i.test(window.navigator.userAgent)) {
    return;
  }

  const image = new Image();
  image.decoding = "async";
  image.loading = "eager";

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Failed to preload ${imageUrl}`));
    image.src = imageUrl;
  });

  if (typeof image.decode === "function") {
    await image.decode().catch(() => undefined);
  }
};

const toResolvedWallpaper = (
  entry: LiveWallpaperManifestEntry,
): ResolvedWallpaper => ({
  dateKey: entry.forDate,
  imageUrl: entry.imageUrl,
  background: createRemoteBackgroundAsset(entry.imageUrl),
  mobileObjectPosition: toObjectPosition(entry.mobileFocusX, entry.mobileFocusY),
  desktopObjectPosition: toObjectPosition(entry.desktopFocusX, entry.desktopFocusY),
  source: "remote",
  assignmentSource: entry.assignmentSource,
});

export const fetchWallpaperManifest = async (
  dateKeys: string[],
) => {
  const uniqueDates = [...new Set(dateKeys)].filter(Boolean);
  if (uniqueDates.length === 0) {
    return {} as Record<string, Partial<Record<WallpaperPageKey, LiveWallpaperManifestEntry>>>;
  }

  const { data, error } = await supabase
    .from("live_wallpaper_manifest_v")
    .select("for_date, page_key, assignment_source, image_url, mobile_focus_x, mobile_focus_y, desktop_focus_x, desktop_focus_y, updated_at")
    .in("for_date", uniqueDates);

  if (error) {
    throw error;
  }

  return normalizeManifestRows(data);
};

interface WallpaperManifestProviderProps {
  children: ReactNode;
  userTimezone?: string | null;
  enabled?: boolean;
}

export const WallpaperManifestProvider = ({
  children,
  userTimezone,
  enabled = true,
}: WallpaperManifestProviderProps) => {
  const [clockMs, setClockMs] = useState(() => Date.now());
  const currentDateKey = useMemo(
    () => getEffectiveWallpaperDate(userTimezone, new Date(clockMs)),
    [clockMs, userTimezone],
  );
  const nextDateKey = useMemo(
    () => addDaysToWallpaperDate(currentDateKey, 1),
    [currentDateKey],
  );
  const targetDates = useMemo(() => [currentDateKey, nextDateKey], [currentDateKey, nextDateKey]);
  const initialCache = useMemo(
    () => readWallpaperManifestCache(targetDates),
    [currentDateKey, nextDateKey, targetDates],
  );
  const [manifestByDate, setManifestByDate] = useState<Record<string, Partial<Record<WallpaperPageKey, LiveWallpaperManifestEntry>>>>(
    () => initialCache?.manifestByDate ?? {},
  );
  const [resolvedByDate, setResolvedByDate] = useState<Record<string, Partial<Record<WallpaperPageKey, ResolvedWallpaper>>>>(
    () => {
      const manifest = initialCache?.manifestByDate ?? {};
      return Object.fromEntries(
        Object.entries(manifest).map(([dateKey, pageEntries]) => [
          dateKey,
          Object.fromEntries(
            Object.entries(pageEntries).map(([pageKey, entry]) => [pageKey, toResolvedWallpaper(entry)]),
          ),
        ]),
      ) as Record<string, Partial<Record<WallpaperPageKey, ResolvedWallpaper>>>;
    },
  );
  const [resolvedDateKeys, setResolvedDateKeys] = useState<string[]>(
    () => initialCache?.resolvedDateKeys ?? Object.keys(initialCache?.manifestByDate ?? {}),
  );
  const failedRemoteKeysRef = useRef<Set<string>>(new Set());
  const [failedRemoteVersion, setFailedRemoteVersion] = useState(0);
  const preloadTicketRef = useRef(0);

  useEffect(() => {
    const cached = readWallpaperManifestCache(targetDates);
    if (!cached) return;

    startTransition(() => {
      setManifestByDate((current) => ({ ...cached.manifestByDate, ...current }));
      setResolvedByDate((current) => ({
        ...Object.fromEntries(
          Object.entries(cached.manifestByDate).map(([dateKey, pageEntries]) => [
            dateKey,
            Object.fromEntries(
              Object.entries(pageEntries).map(([pageKey, entry]) => [pageKey, toResolvedWallpaper(entry)]),
            ),
          ]),
        ),
        ...current,
      }));
      setResolvedDateKeys((current) => mergeDateKeys(current, cached.resolvedDateKeys));
    });
  }, [currentDateKey, nextDateKey, targetDates]);

  const manifestQuery = useQuery({
    queryKey: queryKeys.wallpapers.manifest(targetDates),
    queryFn: () => fetchWallpaperManifest(targetDates),
    enabled,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
  });
  const manifestRefetchRef = useRef(manifestQuery.refetch);

  useEffect(() => {
    manifestRefetchRef.current = manifestQuery.refetch;
  }, [manifestQuery.refetch]);

  const refreshForVisibility = useCallback(() => {
    setClockMs(Date.now());
    void manifestRefetchRef.current();
  }, []);

  useEffect(() => {
    if (!manifestQuery.data) return;

    const nextManifestByDate = targetDates.reduce<Record<string, Partial<Record<WallpaperPageKey, LiveWallpaperManifestEntry>>>>(
      (acc, dateKey) => {
        acc[dateKey] = manifestQuery.data[dateKey] ?? {};
        return acc;
      },
      {},
    );

    startTransition(() => {
      setManifestByDate((current) => ({ ...current, ...nextManifestByDate }));
      setResolvedDateKeys((current) => mergeDateKeys(current, targetDates));
    });
    const cached = readWallpaperManifestCache(targetDates);
    writeWallpaperManifestCache({
      manifestByDate: {
        ...(cached?.manifestByDate ?? {}),
        ...nextManifestByDate,
      },
      resolvedDateKeys: mergeDateKeys(cached?.resolvedDateKeys ?? [], targetDates),
    });
  }, [manifestQuery.data, targetDates]);

  useEffect(() => {
    if (!enabled || !manifestQuery.error) return;

    startTransition(() => {
      setResolvedDateKeys((current) => mergeDateKeys(current, targetDates));
    });
  }, [enabled, manifestQuery.error, targetDates]);

  useEffect(() => {
    if (!enabled) return;

    const ticket = ++preloadTicketRef.current;
    const preloadTargets = targetDates.flatMap((dateKey) =>
      Object.values(manifestByDate[dateKey] ?? {}),
    );

    if (preloadTargets.length === 0) {
      return;
    }

    void Promise.all(preloadTargets.map(async (entry) => {
      const failedKey = `${entry.forDate}:${entry.pageKey}:${entry.imageUrl}`;
      if (failedRemoteKeysRef.current.has(failedKey)) {
        return;
      }

      try {
        await preloadImage(entry.imageUrl);

        if (ticket !== preloadTicketRef.current) {
          return;
        }

        startTransition(() => {
          setResolvedByDate((current) => ({
            ...current,
            [entry.forDate]: {
              ...(current[entry.forDate] ?? {}),
              [entry.pageKey]: toResolvedWallpaper(entry),
            },
          }));
        });
      } catch (_error) {
        failedRemoteKeysRef.current.add(failedKey);
        startTransition(() => {
          setFailedRemoteVersion((current) => current + 1);
        });
      }
    })).catch(() => undefined);
  }, [enabled, manifestByDate, targetDates]);

  useEffect(() => {
    if (!enabled) return;

    const nextBoundary = getNextWallpaperBoundary(userTimezone, new Date(clockMs));
    const delay = Math.max(1000, nextBoundary.getTime() - Date.now());
    const timeoutId = window.setTimeout(() => {
      refreshForVisibility();
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [clockMs, enabled, refreshForVisibility, userTimezone]);

  useEffect(() => {
    if (!enabled) return;

    if (!Capacitor.isNativePlatform()) {
      const handleVisibilityChange = () => {
        if (document.visibilityState !== "visible") return;
        refreshForVisibility();
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }

    let disposed = false;
    let handle: { remove: () => Promise<void> } | null = null;

    const bindListener = async () => {
      const listenerHandle = await CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) return;
        refreshForVisibility();
      });

      if (disposed) {
        await listenerHandle.remove();
        return;
      }

      handle = listenerHandle;
    };

    void bindListener();

    return () => {
      disposed = true;
      if (handle) {
        void handle.remove();
      }
    };
  }, [enabled, refreshForVisibility]);

  const reportWallpaperRenderError = useCallback((pageKey: WallpaperPageKey, imageUrl: string) => {
    const failedKey = `${currentDateKey}:${pageKey}:${imageUrl}`;
    if (failedRemoteKeysRef.current.has(failedKey)) {
      return;
    }

    failedRemoteKeysRef.current.add(failedKey);
    startTransition(() => {
      setFailedRemoteVersion((current) => current + 1);
    });
  }, [currentDateKey]);

  const useResolvedWallpaperForPage = useCallback((pageKey: WallpaperPageKey) => {
    const manifestEntry = manifestByDate[currentDateKey]?.[pageKey] ?? null;
    const resolvedEntry = resolvedByDate[currentDateKey]?.[pageKey] ?? null;

    if (manifestEntry) {
      const failedKey = `${currentDateKey}:${pageKey}:${manifestEntry.imageUrl}`;
      if (failedRemoteKeysRef.current.has(failedKey)) {
        return null;
      }

      if (resolvedEntry?.imageUrl === manifestEntry.imageUrl) {
        return resolvedEntry;
      }

      return null;
    }

    if (resolvedDateKeys.includes(currentDateKey)) {
      return null;
    }

    return null;
  }, [currentDateKey, failedRemoteVersion, manifestByDate, resolvedByDate, resolvedDateKeys]);

  const value = useMemo<WallpaperManifestContextValue>(() => ({
    currentDateKey,
    nextDateKey,
    isRefreshing: manifestQuery.isFetching,
    error: manifestQuery.error instanceof Error ? manifestQuery.error : null,
    manifestByDate,
    currentDateReady: resolvedDateKeys.includes(currentDateKey),
    refresh: async () => {
      setClockMs(Date.now());
      await manifestQuery.refetch();
    },
    useResolvedWallpaperForPage,
    reportWallpaperRenderError,
  }), [
    currentDateKey,
    nextDateKey,
    manifestQuery,
    manifestByDate,
    resolvedDateKeys,
    useResolvedWallpaperForPage,
    reportWallpaperRenderError,
  ]);

  return (
    <WallpaperManifestContext.Provider value={value}>
      {children}
    </WallpaperManifestContext.Provider>
  );
};

export const useWallpaperManifest = () => {
  const context = useContext(WallpaperManifestContext);
  if (!context) {
    throw new Error("useWallpaperManifest must be used within WallpaperManifestProvider");
  }

  return context;
};

export const useResolvedWallpaper = (pageKey: WallpaperPageKey) => {
  const context = useWallpaperManifest();
  return context.useResolvedWallpaperForPage(pageKey);
};
