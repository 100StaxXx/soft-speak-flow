import { useGlobalWidgetSync } from "@/hooks/useGlobalWidgetSync";

export const GlobalWidgetSyncBridge = ({ enabled }: { enabled: boolean }) => {
  useGlobalWidgetSync({
    enabled,
    profileWallpaper: null,
  });

  return null;
};
