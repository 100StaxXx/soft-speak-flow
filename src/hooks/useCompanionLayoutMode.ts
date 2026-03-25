import { useEffect, useState } from "react";
import { isMacDesignedForIPadIOSApp } from "@/utils/platformTargets";

export type CompanionLayoutMode = "mobile" | "desktop";

export const COMPANION_DESKTOP_MIN_WIDTH = 1200;

export const resolveCompanionLayoutMode = ({
  width,
  isMacHostedIOSApp,
}: {
  width: number;
  isMacHostedIOSApp: boolean;
}): CompanionLayoutMode => (
  isMacHostedIOSApp || width >= COMPANION_DESKTOP_MIN_WIDTH ? "desktop" : "mobile"
);

const getCurrentLayoutMode = (): CompanionLayoutMode => {
  if (typeof window === "undefined") {
    return "mobile";
  }

  return resolveCompanionLayoutMode({
    width: window.innerWidth,
    isMacHostedIOSApp: isMacDesignedForIPadIOSApp(),
  });
};

export const useCompanionLayoutMode = (): CompanionLayoutMode => {
  const [layoutMode, setLayoutMode] = useState<CompanionLayoutMode>(() => getCurrentLayoutMode());

  useEffect(() => {
    const updateLayoutMode = () => {
      setLayoutMode(getCurrentLayoutMode());
    };

    updateLayoutMode();

    const mediaQuery = window.matchMedia(`(min-width: ${COMPANION_DESKTOP_MIN_WIDTH}px)`);
    mediaQuery.addEventListener("change", updateLayoutMode);
    window.addEventListener("resize", updateLayoutMode);

    return () => {
      mediaQuery.removeEventListener("change", updateLayoutMode);
      window.removeEventListener("resize", updateLayoutMode);
    };
  }, []);

  return layoutMode;
};
