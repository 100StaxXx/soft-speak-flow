import { motion, useReducedMotion } from "framer-motion";
import { ReactNode, memo } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

// iOS-like easing curve
const iosEasing = [0.25, 0.1, 0.25, 1] as const;

export const PageTransition = memo(({ children }: PageTransitionProps) => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div style={{ width: "100%", height: "100%" }}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.24, ease: iosEasing }}
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
      transition={{ duration: prefersReducedMotion ? 0 : 0.24, delay: prefersReducedMotion ? 0 : delay }}
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
      transition={{ duration: prefersReducedMotion ? 0 : 0.2, delay: prefersReducedMotion ? 0 : delay }}
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
      transition={{ duration: prefersReducedMotion ? 0 : 0.24, delay: prefersReducedMotion ? 0 : delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
});
SlideUp.displayName = "SlideUp";
