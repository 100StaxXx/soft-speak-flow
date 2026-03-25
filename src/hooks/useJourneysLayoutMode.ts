import { useEffect, useState } from "react";

import { isMacDesignedForIPadIOSApp } from "@/utils/platformTargets";

export type JourneysLayoutMode = "mobile" | "desktop";

export const JOURNEYS_DESKTOP_MIN_WIDTH = 1280;

export const resolveJourneysLayoutMode = ({
  width,
  isMacHostedIOSApp,
}: {
  width: number;
  isMacHostedIOSApp: boolean;
}): JourneysLayoutMode => (
  isMacHostedIOSApp || width >= JOURNEYS_DESKTOP_MIN_WIDTH ? "desktop" : "mobile"
);

const getCurrentLayoutMode = (): JourneysLayoutMode => {
  if (typeof window === "undefined") {
    return "mobile";
  }

  return resolveJourneysLayoutMode({
    width: window.innerWidth,
    isMacHostedIOSApp: isMacDesignedForIPadIOSApp(),
  });
};

export const useJourneysLayoutMode = (): JourneysLayoutMode => {
  const [layoutMode, setLayoutMode] = useState<JourneysLayoutMode>(() => getCurrentLayoutMode());

  useEffect(() => {
    const updateLayoutMode = () => {
      setLayoutMode(getCurrentLayoutMode());
    };

    updateLayoutMode();

    const mediaQuery = window.matchMedia(`(min-width: ${JOURNEYS_DESKTOP_MIN_WIDTH}px)`);
    mediaQuery.addEventListener("change", updateLayoutMode);
    window.addEventListener("resize", updateLayoutMode);

    return () => {
      mediaQuery.removeEventListener("change", updateLayoutMode);
      window.removeEventListener("resize", updateLayoutMode);
    };
  }, []);

  return layoutMode;
};
