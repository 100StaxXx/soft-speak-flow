import { useAuth } from "@/hooks/useAuth";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { useWidgetSync } from "@/hooks/useWidgetSync";

interface GlobalWidgetSyncOptions {
  enabled?: boolean;
  profileWallpaper?: {
    imageUrl: string;
    dateKey: string;
  } | null;
}

export const useGlobalWidgetSync = (options: GlobalWidgetSyncOptions = {}): void => {
  const { enabled = true, profileWallpaper = null } = options;
  const { user } = useAuth();

  const syncEnabled = enabled && !!user;
  const { tasks, taskDate } = useTasksQuery(undefined, { enabled: syncEnabled });

  useWidgetSync(tasks, taskDate, { enabled: syncEnabled, profileWallpaper });
};
