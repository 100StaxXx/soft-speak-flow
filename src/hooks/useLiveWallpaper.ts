import { useResolvedWallpaper, useWallpaperManifest } from "@/contexts/WallpaperManifestContext";
import type { WallpaperPageKey } from "@/shared/wallpaperCatalog";

export interface LiveWallpaperRecord {
  imageUrl: string;
  mobileObjectPosition: string;
  desktopObjectPosition: string;
}

export const useLiveWallpaper = (pageKey: WallpaperPageKey, _enabled: boolean) => {
  const wallpaper = useResolvedWallpaper(pageKey);
  const manifest = useWallpaperManifest();

  return {
    dateKey: manifest.currentDateKey,
    wallpaper: wallpaper?.source === "remote"
      ? {
          imageUrl: wallpaper.imageUrl,
          mobileObjectPosition: wallpaper.mobileObjectPosition,
          desktopObjectPosition: wallpaper.desktopObjectPosition,
        }
      : null,
    isLoading: !wallpaper && !manifest.currentDateReady,
    error: manifest.error,
  };
};
