import { useEffect, useId, useRef } from "react";
import confetti from "canvas-confetti";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TutorialCompletionOverlayProps {
  title: string;
  body: string;
  highlights: string[];
  mentorLine: string;
  ctaLabel: string;
  onComplete: () => void;
}

const createFadeMotion = (prefersReducedMotion: boolean | null): MotionProps =>
  prefersReducedMotion
    ? { initial: false, animate: { opacity: 1 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.18 },
      };

const createCardMotion = (prefersReducedMotion: boolean | null): MotionProps =>
  prefersReducedMotion
    ? { initial: false, animate: { opacity: 1 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 18, scale: 0.96 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { type: "spring", damping: 22, stiffness: 280 },
      };

export const TutorialCompletionOverlay = ({
  title,
  body,
  highlights,
  mentorLine,
  ctaLabel,
  onComplete,
}: TutorialCompletionOverlayProps) => {
  const prefersReducedMotion = useReducedMotion();
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const ctaRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) return;

    confetti({
      particleCount: 42,
      spread: 62,
      startVelocity: 28,
      gravity: 0.85,
      scalar: 0.82,
      origin: { y: 0.64 },
      colors: ["#facc15", "#f59e0b", "#ffffff", "#bae6fd"],
      disableForReducedMotion: true,
    });
  }, [prefersReducedMotion]);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => {
      ctaRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => {
        const style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
      });

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (!dialog.contains(activeElement)) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };
  }, []);

  const fadeMotion = createFadeMotion(prefersReducedMotion);
  const cardMotion = createCardMotion(prefersReducedMotion);

  return (
    <motion.div
      {...fadeMotion}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/72 px-4 py-[calc(env(safe-area-inset-top,0px)+1rem)] backdrop-blur-md"
      data-testid="tutorial-completion-overlay"
    >
      <motion.section
        ref={dialogRef}
        {...cardMotion}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-amber-200/30 bg-slate-950/95 p-5 text-white shadow-[0_26px_70px_rgba(0,0,0,0.58)]"
      >
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200 to-transparent"
          initial={prefersReducedMotion ? false : { x: "-100%", opacity: 0.6 }}
          animate={prefersReducedMotion ? { opacity: 0.75 } : { x: "100%", opacity: [0.3, 1, 0.3] }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 1.1, ease: "easeOut" }}
        />

        <div className="flex flex-col items-center text-center">
          <motion.div
            className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200/40 bg-amber-300/[0.12] text-amber-200 shadow-[0_0_34px_rgba(251,191,36,0.24)]"
            initial={prefersReducedMotion ? false : { scale: 0.9 }}
            animate={prefersReducedMotion ? { scale: 1 } : { scale: [0.9, 1.06, 1] }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.62, ease: "easeOut" }}
          >
            <motion.span
              aria-hidden="true"
              className="absolute inset-[-7px] rounded-[1.35rem] border border-amber-200/25"
              initial={prefersReducedMotion ? false : { scale: 0.78, opacity: 0 }}
              animate={prefersReducedMotion ? { opacity: 0.65 } : { scale: [0.78, 1.22], opacity: [0, 0.75, 0] }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.8, delay: 0.08 }}
            />
            <CheckCircle2 className="relative h-9 w-9" aria-hidden="true" />
          </motion.div>

          <p className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Tutorial complete
          </p>

          <h2 id={titleId} className="mt-3 text-2xl font-semibold tracking-tight text-white">
            {title}
          </h2>
          <p id={bodyId} className="mt-2 max-w-sm text-sm leading-6 text-white/[0.78]">
            {body}
          </p>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {highlights.map((highlight) => (
            <div
              key={highlight}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.07] px-3 py-2 text-center text-xs font-semibold text-white/90"
            >
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-amber-200" aria-hidden="true" />
              <span>{highlight}</span>
            </div>
          ))}
        </div>

        <p className="mt-5 rounded-lg border border-white/10 bg-black/[0.22] px-3 py-2 text-center text-sm leading-6 text-white/[0.76]">
          {mentorLine}
        </p>

        <Button
          ref={ctaRef}
          type="button"
          onClick={onComplete}
          className="mt-5 h-11 w-full rounded-xl bg-amber-400 text-sm font-semibold text-black shadow-[0_12px_28px_rgba(245,158,11,0.24)] hover:bg-amber-300"
        >
          {ctaLabel}
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </Button>
      </motion.section>
    </motion.div>
  );
};
