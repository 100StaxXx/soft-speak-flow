import { motion, useReducedMotion } from "framer-motion";
import { ReactNode, memo } from "react";
import { useMotionProfile } from "@/hooks/useMotionProfile";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/motionTokens";

interface PageTransitionProps {
  children: ReactNode;
  mode?: "animated" | "instant" | "tab-swap";
  direction?: "forward" | "backward" | "none";
}

export const PageTransition = memo(({
  children,
  mode = "animated",
  direction = "none",
}: PageTransitionProps) => {
  const prefersReducedMotion = useReducedMotion();
  const { capabilities } = useMotionProfile();
  const disableMotion = prefersReducedMotion || mode === "instant";
  const disableTabSwapMotion = mode === "tab-swap" && !capabilities.enableTabTransitions;

  if (disableMotion || disableTabSwapMotion) {
    return <div style={{ width: "100%", height: "100%" }}>{children}</div>;
  }

  const tabOffset =
    direction === "forward" ? 10 : direction === "backward" ? -10 : 0;
  const isTabSwap = mode === "tab-swap";

  const initial = isTabSwap
    ? { opacity: 0, x: tabOffset }
    : { opacity: 0, y: 8 };

  const animate = isTabSwap
    ? { opacity: 1, x: 0 }
    : { opacity: 1, y: 0 };

  const exit = isTabSwap
    ? { opacity: 0, x: tabOffset === 0 ? -8 : -tabOffset }
    : { opacity: 0, y: -6 };

  const duration = isTabSwap ? MOTION_DURATION.tabSwap : MOTION_DURATION.quick;

  return (
    <motion.div
      initial={initial}
      animate={animate}
      exit={exit}
      transition={{ duration, ease: MOTION_EASE.ios }}
      style={{ width: '100%', height: '100%' }}
    >
      {children}
    </motion.div>
  );
});
PageTransition.displayName = "PageTransition";

export const FadeIn = memo(({ children, delay = 0 }: { children: ReactNode; delay?: number }) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: prefersReducedMotion ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: prefersReducedMotion ? MOTION_DURATION.instant : MOTION_DURATION.page,
        delay: prefersReducedMotion ? 0 : delay,
        ease: MOTION_EASE.standard,
      }}
    >
      {children}
    </motion.div>
  );
});
FadeIn.displayName = "FadeIn";

export const ScaleIn = memo(({ children, delay = 0 }: { children: ReactNode; delay?: number }) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: prefersReducedMotion ? 1 : 0, scale: prefersReducedMotion ? 1 : 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: prefersReducedMotion ? MOTION_DURATION.instant : MOTION_DURATION.medium,
        delay: prefersReducedMotion ? 0 : delay,
        ease: MOTION_EASE.standard,
      }}
    >
      {children}
    </motion.div>
  );
});
ScaleIn.displayName = "ScaleIn";

export const SlideUp = memo(({ children, delay = 0 }: { children: ReactNode; delay?: number }) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: prefersReducedMotion ? MOTION_DURATION.instant : MOTION_DURATION.page,
        delay: prefersReducedMotion ? 0 : delay,
        ease: MOTION_EASE.standard,
      }}
    >
      {children}
    </motion.div>
  );
});
SlideUp.displayName = "SlideUp";
