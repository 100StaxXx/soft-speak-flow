import { motion, useReducedMotion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type OnboardingStageShellWidth = "sm" | "md" | "lg" | "xl" | "full";
type OnboardingStageShellAlign = "center" | "top";
type OnboardingStageShellHeaderAlign = "center" | "left";

const WIDTH_CLASSNAMES: Record<OnboardingStageShellWidth, string> = {
  sm: "max-w-2xl",
  md: "max-w-3xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
  full: "max-w-6xl",
};

interface OnboardingStageShellProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  hero?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  accent?: string;
  width?: OnboardingStageShellWidth;
  align?: OnboardingStageShellAlign;
  headerAlign?: OnboardingStageShellHeaderAlign;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
}

export const OnboardingStageShell = ({
  eyebrow,
  title,
  description,
  hero,
  footer,
  children,
  accent,
  width = "lg",
  align = "center",
  headerAlign = "center",
  className,
  headerClassName,
  bodyClassName,
}: OnboardingStageShellProps) => {
  const prefersReducedMotion = useReducedMotion();
  const accentStyle = accent
    ? ({ ["--onb-stage-accent" as string]: accent } as CSSProperties)
    : undefined;
  const hasHeader = eyebrow || title || description;

  return (
    <section
      className={cn(
        "onb-stage-shell relative isolate w-full overflow-hidden px-4 sm:px-6 lg:px-8 pt-safe-top pb-safe-lg",
        align === "center" ? "flex min-h-screen items-center" : "min-h-screen",
        className,
      )}
      style={accentStyle}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="onb-stage-grid absolute inset-x-0 top-0 h-80 opacity-75" />
        <div className="onb-stage-aurora absolute inset-0" />
        <div className="onb-stage-halo absolute left-1/2 top-16 h-64 w-[min(88vw,44rem)] -translate-x-1/2 rounded-full" />
        <div className="onb-stage-vignette absolute inset-0" />
      </div>

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
        className={cn("relative z-10 mx-auto w-full", WIDTH_CLASSNAMES[width])}
      >
        {hero ? (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, ease: "easeOut", delay: 0.04 }}
            className="mb-6 flex justify-center md:mb-8"
          >
            {hero}
          </motion.div>
        ) : null}

        {hasHeader ? (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.42, ease: "easeOut", delay: 0.08 }}
            className={cn(
              "mx-auto space-y-3",
              headerAlign === "center" ? "text-center" : "text-left",
              headerClassName,
            )}
          >
            {eyebrow ? (
              <div
                className={cn(
                  "onb-stage-chip",
                  headerAlign === "center" ? "mx-auto" : "",
                )}
              >
                {eyebrow}
              </div>
            ) : null}
            {title ? (
              <h1 className="text-balance text-4xl font-semibold tracking-tight text-white md:text-5xl">
                {title}
              </h1>
            ) : null}
            {description ? (
              <p
                className={cn(
                  "text-pretty text-sm leading-7 text-white/70 md:text-base",
                  headerAlign === "center" ? "mx-auto max-w-2xl" : "max-w-3xl",
                )}
              >
                {description}
              </p>
            ) : null}
          </motion.div>
        ) : null}

        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.42, ease: "easeOut", delay: 0.12 }}
          className={cn("mt-6 space-y-5 md:mt-8 md:space-y-6", bodyClassName)}
        >
          {children}
        </motion.div>

        {footer ? (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, ease: "easeOut", delay: 0.16 }}
            className="mt-6 md:mt-8"
          >
            {footer}
          </motion.div>
        ) : null}
      </motion.div>
    </section>
  );
};
