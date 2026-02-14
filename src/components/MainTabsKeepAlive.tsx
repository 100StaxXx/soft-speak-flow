import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion } from "framer-motion";
import Mentor from "@/pages/Mentor";
import Companion from "@/pages/Companion";
import Inbox from "@/pages/Inbox";
import Journeys from "@/pages/Journeys";
import { useAuth } from "@/hooks/useAuth";
import { useMotionProfile } from "@/hooks/useMotionProfile";
import { MOTION_EASE } from "@/lib/motionTokens";
import {
  DAILY_TASKS_GC_TIME,
  DAILY_TASKS_STALE_TIME,
  fetchDailyTasks,
  getDailyTasksQueryKey,
} from "@/hooks/useTasksQuery";
import { buildRefreshPredicate, type MainTabPath } from "@/utils/mainTabRefresh";
import { MainTabVisibilityProvider } from "@/contexts/MainTabVisibilityContext";
import { logger } from "@/utils/logger";

const TAB_ORDER: MainTabPath[] = ["/mentor", "/inbox", "/journeys", "/companion"];
const TAB_REFRESH_COOLDOWN_MS = 2500;
const WARM_MOUNT_DELAY_MS = 260;

const TAB_COMPONENTS: Record<MainTabPath, ComponentType> = {
  "/mentor": Mentor,
  "/inbox": Inbox,
  "/journeys": Journeys,
  "/companion": Companion,
};

export const isMainTabPath = (pathname: string): pathname is MainTabPath =>
  TAB_ORDER.includes(pathname as MainTabPath);

type TabDirection = "forward" | "backward";

interface MainTabSceneProps {
  path: MainTabPath;
  isActive: boolean;
  isExiting: boolean;
  direction: TabDirection;
  enableTransitions: boolean;
  transitionDurationMs: number;
}

const MainTabScene = memo(({
  path,
  isActive,
  isExiting,
  direction,
  enableTransitions,
  transitionDurationMs,
}: MainTabSceneProps) => {
  const TabPage = TAB_COMPONENTS[path];
  const isVisible = isActive || isExiting;
  const exitX = direction === "forward" ? -12 : 12;
  const enterX = direction === "forward" ? 12 : -12;

  const animateState = enableTransitions
    ? isActive
      ? { opacity: 1, x: 0 }
      : isExiting
        ? { opacity: 0, x: exitX }
        : { opacity: 0, x: enterX }
    : isActive
      ? { opacity: 1, x: 0 }
      : { opacity: 0, x: 0 };

  return (
    <motion.div
      initial={false}
      animate={animateState}
      transition={{
        duration: enableTransitions ? transitionDurationMs / 1000 : 0,
        ease: MOTION_EASE.standard,
      }}
      style={{
        display: isVisible ? undefined : "none",
        position: isActive ? "relative" : "absolute",
        inset: isActive ? undefined : 0,
        width: "100%",
        zIndex: isActive ? 2 : isExiting ? 1 : 0,
        pointerEvents: isActive ? "auto" : "none",
        willChange: enableTransitions && isVisible ? "opacity, transform" : undefined,
      }}
      aria-hidden={!isActive}
      data-main-tab-path={path}
      data-main-tab-active={isActive}
      data-main-tab-state={isActive ? "active" : isExiting ? "exiting" : "inactive"}
      data-main-tab-mounted="true"
    >
      <MainTabVisibilityProvider isTabActive={isActive}>
        <section>
          <TabPage />
        </section>
      </MainTabVisibilityProvider>
    </motion.div>
  );
});

MainTabScene.displayName = "MainTabScene";

interface MainTabsKeepAliveProps {
  activePath: MainTabPath;
  transitionPreset?: "none" | "fade-slide";
  transitionDurationMs?: number;
}

export const MainTabsKeepAlive = memo(({
  activePath,
  transitionPreset = "none",
  transitionDurationMs = 180,
}: MainTabsKeepAliveProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { capabilities } = useMotionProfile();
  const [mountedTabs, setMountedTabs] = useState<MainTabPath[]>([activePath]);
  const [exitingPath, setExitingPath] = useState<MainTabPath | null>(null);
  const [direction, setDirection] = useState<TabDirection>("forward");
  const transitionPathRef = useRef<MainTabPath>(activePath);
  const exitTimerRef = useRef<number | null>(null);
  const warmMountIdleHandleRef = useRef<number | null>(null);
  const warmMountTimerRef = useRef<number | null>(null);
  const tabRefreshCooldownRef = useRef<Partial<Record<MainTabPath, number>>>({});
  const enableTransitions = transitionPreset === "fade-slide" && capabilities.enableTabTransitions;

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

  const clearWarmMountSchedule = useCallback(() => {
    if (warmMountIdleHandleRef.current !== null) {
      const idleWindow = window as Window & {
        cancelIdleCallback?: (handle: number) => void;
      };
      idleWindow.cancelIdleCallback?.(warmMountIdleHandleRef.current);
      warmMountIdleHandleRef.current = null;
    }
    if (warmMountTimerRef.current !== null) {
      window.clearTimeout(warmMountTimerRef.current);
      warmMountTimerRef.current = null;
    }
  }, []);

  const mountNextTabShell = useCallback(() => {
    setMountedTabs((previous) => {
      const nextPath = TAB_ORDER.find((path) => !previous.includes(path));
      if (!nextPath) return previous;
      return [...previous, nextPath];
    });
  }, []);

  useEffect(() => {
    if (mountedTabs.length >= TAB_ORDER.length) {
      clearWarmMountSchedule();
      return;
    }

    clearWarmMountSchedule();
    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
    };

    if (idleWindow.requestIdleCallback) {
      warmMountIdleHandleRef.current = idleWindow.requestIdleCallback(
        () => {
          warmMountIdleHandleRef.current = null;
          mountNextTabShell();
        },
        { timeout: 1200 },
      );
      return;
    }

    warmMountTimerRef.current = window.setTimeout(() => {
      warmMountTimerRef.current = null;
      mountNextTabShell();
    }, WARM_MOUNT_DELAY_MS);
  }, [clearWarmMountSchedule, mountNextTabShell, mountedTabs.length]);

  useEffect(() => {
    const previousPath = transitionPathRef.current;
    if (previousPath === activePath) return;

    const previousIndex = TAB_ORDER.indexOf(previousPath);
    const nextIndex = TAB_ORDER.indexOf(activePath);
    setDirection(nextIndex >= previousIndex ? "forward" : "backward");

    if (enableTransitions) {
      setExitingPath(previousPath);
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
      exitTimerRef.current = window.setTimeout(() => {
        setExitingPath(null);
        exitTimerRef.current = null;
      }, transitionDurationMs);
    } else {
      setExitingPath(null);
    }

    transitionPathRef.current = activePath;
  }, [activePath, enableTransitions, transitionDurationMs]);

  useEffect(() => {
    const now = Date.now();
    const lastRefresh = tabRefreshCooldownRef.current[activePath] ?? 0;
    if (now - lastRefresh < TAB_REFRESH_COOLDOWN_MS) return;

    tabRefreshCooldownRef.current[activePath] = now;
    void queryClient.invalidateQueries({
      predicate: buildRefreshPredicate(activePath),
    }).catch(() => undefined);
  }, [activePath, queryClient]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
      clearWarmMountSchedule();
    };
  }, [clearWarmMountSchedule]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const timer = logger.time("main_tab_swap", "MainTabsKeepAlive");
    const frame = window.requestAnimationFrame(() => {
      timer.end({ activePath });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activePath]);

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activePath]);

  return (
    <div className="relative min-h-screen">
      {TAB_ORDER.map((path) => {
        if (!mountedTabs.includes(path)) return null;

        const isActive = path === activePath;
        const isExiting = path === exitingPath;
        const sceneDirection = isActive || isExiting ? direction : "forward";

        return (
          <MainTabScene
            key={path}
            path={path}
            isActive={isActive}
            isExiting={isExiting}
            direction={sceneDirection}
            enableTransitions={enableTransitions}
            transitionDurationMs={transitionDurationMs}
          />
        );
      })}
    </div>
  );
});

MainTabsKeepAlive.displayName = "MainTabsKeepAlive";
