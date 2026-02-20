import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import Mentor from "@/pages/Mentor";
import Companion from "@/pages/Companion";
import Inbox from "@/pages/Inbox";
import Journeys from "@/pages/Journeys";
import { useAuth } from "@/hooks/useAuth";
import { MainTabVisibilityProvider } from "@/contexts/MainTabVisibilityContext";
import { logger } from "@/utils/logger";
import {
  DAILY_TASKS_GC_TIME,
  DAILY_TASKS_STALE_TIME,
  fetchDailyTasks,
  getDailyTasksQueryKey,
} from "@/hooks/useTasksQuery";

type MainTabPath = "/mentor" | "/inbox" | "/journeys" | "/companion";

const TAB_ORDER: MainTabPath[] = ["/mentor", "/inbox", "/journeys", "/companion"];

const TAB_COMPONENTS: Record<MainTabPath, ComponentType> = {
  "/mentor": Mentor,
  "/inbox": Inbox,
  "/journeys": Journeys,
  "/companion": Companion,
};

export const isMainTabPath = (pathname: string): pathname is MainTabPath =>
  TAB_ORDER.includes(pathname as MainTabPath);

const initialScrollPositions: Record<MainTabPath, number> = {
  "/mentor": 0,
  "/inbox": 0,
  "/journeys": 0,
  "/companion": 0,
};

const SCROLL_RESTORE_EPSILON_PX = 1;

export const MainTabsKeepAlive = memo(({ activePath }: { activePath: MainTabPath }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [mountedTabs, setMountedTabs] = useState<MainTabPath[]>([activePath]);
  const activePathRef = useRef<MainTabPath>(activePath);
  const visitedTabsRef = useRef<Set<MainTabPath>>(new Set([activePath]));
  const scrollPositionsRef = useRef<Record<MainTabPath, number>>(initialScrollPositions);
  const hasInitializedScrollRestoreRef = useRef(false);
  const rafHandlesRef = useRef<number[]>([]);

  const prefetchJourneysTasks = useCallback(() => {
    if (!user?.id) return;

    const today = format(new Date(), "yyyy-MM-dd");
    void queryClient.prefetchQuery({
      queryKey: getDailyTasksQueryKey(user.id, today),
      queryFn: () => fetchDailyTasks(user.id, today),
      staleTime: DAILY_TASKS_STALE_TIME,
      gcTime: DAILY_TASKS_GC_TIME,
    }).catch(() => undefined);
  }, [queryClient, user?.id]);

  useEffect(() => {
    prefetchJourneysTasks();
  }, [prefetchJourneysTasks]);

  useEffect(() => {
    setMountedTabs((previous) =>
      previous.includes(activePath) ? previous : [...previous, activePath]
    );
  }, [activePath]);

  useLayoutEffect(() => {
    const previousPath = activePathRef.current;
    if (previousPath !== activePath) {
      scrollPositionsRef.current[previousPath] = window.scrollY;
    }

    const wasVisited = visitedTabsRef.current.has(activePath);
    const targetY = wasVisited ? scrollPositionsRef.current[activePath] ?? 0 : 0;
    visitedTabsRef.current.add(activePath);
    activePathRef.current = activePath;
    if (!hasInitializedScrollRestoreRef.current) {
      hasInitializedScrollRestoreRef.current = true;
      return;
    }

    if (Math.abs(window.scrollY - targetY) <= SCROLL_RESTORE_EPSILON_PX) {
      return;
    }

    const frameA = window.requestAnimationFrame(() => {
      const frameB = window.requestAnimationFrame(() => {
        if (Math.abs(window.scrollY - targetY) <= SCROLL_RESTORE_EPSILON_PX) {
          return;
        }
        window.scrollTo({ top: targetY, left: 0, behavior: "auto" });

        if (import.meta.env.DEV) {
          logger.debug("MainTabsKeepAlive restored tab scroll", {
            activePath,
            targetY,
          });
        }
      });
      rafHandlesRef.current.push(frameB);
    });
    rafHandlesRef.current.push(frameA);

    return () => {
      for (const handle of rafHandlesRef.current) {
        window.cancelAnimationFrame(handle);
      }
      rafHandlesRef.current = [];
    };
  }, [activePath]);

  return (
    <div className="relative">
      {TAB_ORDER.map((path) => {
        if (!mountedTabs.includes(path)) return null;

        const TabPage = TAB_COMPONENTS[path];
        const isActive = path === activePath;

        return (
          <div key={path} style={{ display: isActive ? "block" : "none" }} aria-hidden={!isActive}>
            <MainTabVisibilityProvider isTabActive={isActive}>
              <section>
                <TabPage />
              </section>
            </MainTabVisibilityProvider>
          </div>
        );
      })}
    </div>
  );
});

MainTabsKeepAlive.displayName = "MainTabsKeepAlive";
