import { useEffect, useState } from "react";
import { isMacDesignedForIPadIOSApp } from "@/utils/platformTargets";

export type MentorLayoutMode = "mobile" | "desktop";

export const MENTOR_DESKTOP_MIN_WIDTH = 1200;

export const resolveMentorLayoutMode = ({
  width,
  isMacHostedIOSApp,
}: {
  width: number;
  isMacHostedIOSApp: boolean;
}): MentorLayoutMode => (
  isMacHostedIOSApp || width >= MENTOR_DESKTOP_MIN_WIDTH ? "desktop" : "mobile"
);

const getCurrentLayoutMode = (): MentorLayoutMode => {
  if (typeof window === "undefined") {
    return "mobile";
  }

  return resolveMentorLayoutMode({
    width: window.innerWidth,
    isMacHostedIOSApp: isMacDesignedForIPadIOSApp(),
  });
};

export const useMentorLayoutMode = (): MentorLayoutMode => {
  const [layoutMode, setLayoutMode] = useState<MentorLayoutMode>(() => getCurrentLayoutMode());

  useEffect(() => {
    const updateLayoutMode = () => {
      setLayoutMode(getCurrentLayoutMode());
    };

    updateLayoutMode();

    const mediaQuery = window.matchMedia(`(min-width: ${MENTOR_DESKTOP_MIN_WIDTH}px)`);
    mediaQuery.addEventListener("change", updateLayoutMode);
    window.addEventListener("resize", updateLayoutMode);

    return () => {
      mediaQuery.removeEventListener("change", updateLayoutMode);
      window.removeEventListener("resize", updateLayoutMode);
    };
  }, []);

  return layoutMode;
};
