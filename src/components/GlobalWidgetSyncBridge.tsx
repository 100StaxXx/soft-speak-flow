import { useGlobalWidgetSync } from "@/hooks/useGlobalWidgetSync";
import { useResolvedWallpaper } from "@/contexts/WallpaperManifestContext";

export const GlobalWidgetSyncBridge = ({ enabled }: { enabled: boolean }) => {
  const profileWallpaper = useResolvedWallpaper("profile");

  useGlobalWidgetSync({
    enabled,
    profileWallpaper: profileWallpaper
      ? {
          imageUrl: profileWallpaper.imageUrl,
          dateKey: profileWallpaper.dateKey,
        }
      : null,
  });

  return null;
};
