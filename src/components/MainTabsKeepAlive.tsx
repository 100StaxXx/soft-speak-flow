import {
  lazy,
  memo,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type LazyExoticComponent,
} from "react";
import { MainTabVisibilityProvider } from "@/contexts/MainTabVisibilityContext";
import { logger } from "@/utils/logger";

type MainTabPath = "/mentor" | "/journeys" | "/campaigns" | "/companion";

const TAB_ORDER: MainTabPath[] = ["/mentor", "/journeys", "/campaigns", "/companion"];

const TAB_COMPONENTS: Record<MainTabPath, LazyExoticComponent<ComponentType>> = {
  "/mentor": lazy(() => import("@/pages/Mentor")),
  "/journeys": lazy(() => import("@/pages/Journeys")),
  "/campaigns": lazy(() => import("@/pages/Campaigns")),
  "/companion": lazy(() => import("@/pages/Companion")),
};

export const isMainTabPath = (pathname: string): pathname is MainTabPath =>
  TAB_ORDER.includes(pathname as MainTabPath);

const initialScrollPositions: Record<MainTabPath, number> = {
  "/mentor": 0,
  "/journeys": 0,
  "/campaigns": 0,
  "/companion": 0,
};

const SCROLL_RESTORE_EPSILON_PX = 1;

const MainTabLoadingFallback = memo(() => (
  <div className="flex min-h-[60vh] items-center justify-center" aria-label="Loading tab">
    <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
  </div>
));

MainTabLoadingFallback.displayName = "MainTabLoadingFallback";

export const MainTabsKeepAlive = memo(({ activePath }: { activePath: MainTabPath }) => {
  const [mountedTabs, setMountedTabs] = useState<MainTabPath[]>([activePath]);
  const activePathRef = useRef<MainTabPath>(activePath);
  const visitedTabsRef = useRef<Set<MainTabPath>>(new Set([activePath]));
  const scrollPositionsRef = useRef<Record<MainTabPath, number>>(initialScrollPositions);
  const hasInitializedScrollRestoreRef = useRef(false);
  const rafHandlesRef = useRef<number[]>([]);

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
                <Suspense fallback={isActive ? <MainTabLoadingFallback /> : null}>
                  <TabPage />
                </Suspense>
              </section>
            </MainTabVisibilityProvider>
          </div>
        );
      })}
    </div>
  );
});

MainTabsKeepAlive.displayName = "MainTabsKeepAlive";
