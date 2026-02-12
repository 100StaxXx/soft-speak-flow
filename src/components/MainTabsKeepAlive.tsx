import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import Mentor from "@/pages/Mentor";
import Companion from "@/pages/Companion";
import Inbox from "@/pages/Inbox";
import Journeys from "@/pages/Journeys";

export type MainTabPath = "/mentor" | "/inbox" | "/journeys" | "/companion";

const TAB_ORDER: MainTabPath[] = ["/mentor", "/inbox", "/journeys", "/companion"];

const TAB_COMPONENTS: Record<MainTabPath, React.ComponentType> = {
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

export const MainTabsKeepAlive = memo(({ activePath }: { activePath: MainTabPath }) => {
  const [mountedTabs, setMountedTabs] = useState<MainTabPath[]>([activePath]);
  const activePathRef = useRef<MainTabPath>(activePath);
  const visitedTabsRef = useRef<Set<MainTabPath>>(new Set([activePath]));
  const scrollPositionsRef = useRef<Record<MainTabPath, number>>(initialScrollPositions);

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

    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: targetY, left: 0, behavior: "auto" });
    });

    visitedTabsRef.current.add(activePath);
    activePathRef.current = activePath;

    return () => window.cancelAnimationFrame(frame);
  }, [activePath]);

  return (
    <div className="relative">
      {TAB_ORDER.map((path) => {
        if (!mountedTabs.includes(path)) return null;

        const TabPage = TAB_COMPONENTS[path];
        const isActive = path === activePath;

        return (
          <section
            key={path}
            style={{ display: isActive ? "block" : "none" }}
            aria-hidden={!isActive}
          >
            <TabPage />
          </section>
        );
      })}
    </div>
  );
});

MainTabsKeepAlive.displayName = "MainTabsKeepAlive";
