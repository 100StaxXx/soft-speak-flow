import { useQuery } from "@tanstack/react-query";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import {
  getWallpaperDateKey,
  isWallpaperAssetEligibleForLiveRotation,
  toObjectPosition,
  type WallpaperPageKey,
} from "@/shared/wallpaperCatalog";

export interface LiveWallpaperRecord {
  imageUrl: string;
  mobileObjectPosition: string;
  desktopObjectPosition: string;
}

interface WallpaperAssetLookupRow {
  publish_state: string;
  source_kind: string;
  generation_date: string;
  image_url: string;
  mobile_focus_x: number | null;
  mobile_focus_y: number | null;
  desktop_focus_x: number | null;
  desktop_focus_y: number | null;
}

export const fetchLiveWallpaperRecord = async (
  pageKey: WallpaperPageKey,
  dateKey: string,
): Promise<LiveWallpaperRecord | null> => {
  const { data: assignment, error: assignmentError } = await supabase
    .from("daily_wallpaper_assignments")
    .select("wallpaper_asset_id")
    .eq("page_key", pageKey)
    .eq("for_date", dateKey)
    .maybeSingle();

  if (assignmentError) {
    throw assignmentError;
  }

  if (!assignment?.wallpaper_asset_id) {
    return null;
  }

  const { data, error: assetError } = await supabase
    .from("wallpaper_assets")
    .select("publish_state, source_kind, generation_date, image_url, mobile_focus_x, mobile_focus_y, desktop_focus_x, desktop_focus_y")
    .eq("id", assignment.wallpaper_asset_id)
    .maybeSingle();

  if (assetError) {
    throw assetError;
  }

  const asset = data as WallpaperAssetLookupRow | null;

  if (
    !asset
    || !isWallpaperAssetEligibleForLiveRotation(pageKey, {
      publishState: asset.publish_state,
      sourceKind: asset.source_kind,
      generationDate: asset.generation_date,
    })
  ) {
    return null;
  }

  return {
    imageUrl: asset.image_url,
    mobileObjectPosition: toObjectPosition(asset.mobile_focus_x, asset.mobile_focus_y),
    desktopObjectPosition: toObjectPosition(asset.desktop_focus_x, asset.desktop_focus_y),
  };
};

export const useWallpaperDateKey = (
  enabled: boolean,
  getDateKey: () => string = getWallpaperDateKey,
) => {
  const [dateKey, setDateKey] = useState(() => getDateKey());

  const syncDateKey = useCallback(() => {
    setDateKey((currentKey) => {
      const nextKey = getDateKey();
      return currentKey === nextKey ? currentKey : nextKey;
    });
  }, [getDateKey]);

  useEffect(() => {
    if (!enabled) return;

    syncDateKey();

    if (!Capacitor.isNativePlatform()) {
      const handleVisibilityChange = () => {
        if (document.visibilityState !== "visible") return;
        syncDateKey();
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }

    let isDisposed = false;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const setupListener = async () => {
      const handle = await CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) return;
        syncDateKey();
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
      if (listenerHandle) {
        void listenerHandle.remove();
      }
    };
  }, [enabled, syncDateKey]);

  return dateKey;
};

export const useLiveWallpaper = (pageKey: WallpaperPageKey, enabled: boolean) => {
  const dateKey = useWallpaperDateKey(enabled);

  const query = useQuery({
    queryKey: queryKeys.wallpapers.live(pageKey, dateKey),
    queryFn: () => fetchLiveWallpaperRecord(pageKey, dateKey),
    enabled,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  return {
    dateKey,
    wallpaper: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error : null,
  };
};
