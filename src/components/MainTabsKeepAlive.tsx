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
import { type MainTabPath } from "@/utils/mainTabRefresh";
import { MainTabVisibilityProvider } from "@/contexts/MainTabVisibilityContext";
import { logger } from "@/utils/logger";

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
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const scrollPathRef = useRef<MainTabPath>(activePath);
  const transitionPathRef = useRef<MainTabPath>(activePath);
  const visitedTabsRef = useRef<Set<MainTabPath>>(new Set([activePath]));
  const scrollPositionsRef = useRef<Record<MainTabPath, number>>(initialScrollPositions);
  const exitTimerRef = useRef<number | null>(null);
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
    return () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const timer = logger.time("main_tab_swap", "MainTabsKeepAlive");
    const frame = window.requestAnimationFrame(() => {
      timer.end({ activePath });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activePath]);

  useLayoutEffect(() => {
    const previousPath = scrollPathRef.current;
    if (previousPath !== activePath) {
      scrollPositionsRef.current[previousPath] = window.scrollY;
    }

    const wasVisited = visitedTabsRef.current.has(activePath);
    const targetY = wasVisited ? scrollPositionsRef.current[activePath] ?? 0 : 0;

    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: targetY, left: 0, behavior: "auto" });
    });

    visitedTabsRef.current.add(activePath);
    scrollPathRef.current = activePath;

    return () => window.cancelAnimationFrame(frame);
  }, [activePath]);

  return (
    <div className="relative min-h-screen">
      {TAB_ORDER.map((path) => {
        if (!mountedTabs.includes(path)) return null;

        const TabPage = TAB_COMPONENTS[path];
        const isActive = path === activePath;
        const isExiting = path === exitingPath;
        const isVisible = isActive || isExiting;
        const shouldHide = enableTransitions ? !isVisible : !isActive;

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
            key={path}
            initial={false}
            animate={animateState}
            transition={{
              duration: transitionDurationMs / 1000,
              ease: MOTION_EASE.standard,
            }}
            style={{
              position: isActive ? "relative" : "absolute",
              inset: isActive ? undefined : 0,
              width: "100%",
              zIndex: isActive ? 2 : isExiting ? 1 : 0,
              visibility: shouldHide ? "hidden" : "visible",
              pointerEvents: isActive ? "auto" : "none",
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
      })}
    </div>
  );
});

MainTabsKeepAlive.displayName = "MainTabsKeepAlive";
