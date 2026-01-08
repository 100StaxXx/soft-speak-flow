import { memo, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useCompanionWhispers } from "@/hooks/useCompanionWhispers";
import { useCompanionAuraColors } from "@/hooks/useCompanionAuraColors";
import { useCompanionPresence } from "@/contexts/CompanionPresenceContext";
import { cn } from "@/lib/utils";

interface CompanionWhisperProps {
  className?: string;
}

/**
 * Global companion whisper component that displays occasional,
 * context-aware messages from the companion across all pages.
 * 
 * Appears as a small toast-like notification at the top of the screen.
 * Auto-dismisses after 5 seconds or can be dismissed manually.
 */
export const CompanionWhisper = memo(({ className }: CompanionWhisperProps) => {
  const { currentWhisper, isVisible, dismissWhisper, companionName } = useCompanionWhispers();
  const { primaryAura, navGlow } = useCompanionAuraColors();
  const { presence } = useCompanionPresence();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (!isVisible || !currentWhisper) return;

    const timer = setTimeout(() => {
      dismissWhisper();
    }, 5000);

    return () => clearTimeout(timer);
  }, [isVisible, currentWhisper, dismissWhisper]);

  // Don't render if no whisper or companion is dormant
  if (!currentWhisper || presence.mood === 'dormant') {
    return null;
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.95 }}
          transition={{ 
            duration: prefersReducedMotion ? 0 : 0.3,
            ease: "easeOut" 
          }}
          className={cn(
            "fixed top-4 left-1/2 -translate-x-1/2 z-[100]",
            "max-w-[90vw] sm:max-w-sm",
            className
          )}
        >
          <div
            className={cn(
              "relative flex items-center gap-3 px-4 py-3 rounded-2xl",
              "bg-background/90 backdrop-blur-md",
              "border border-border/50",
              "shadow-lg"
            )}
            style={{
              boxShadow: navGlow !== 'none' ? `${navGlow}, 0 10px 40px -10px rgba(0,0,0,0.3)` : undefined,
            }}
          >
            {/* Companion avatar indicator */}
            <div
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${primaryAura}, transparent)`,
              }}
            >
              <span className="text-sm">💬</span>
            </div>

            {/* Message content */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground font-medium">
                {companionName}
              </p>
              <p className="text-sm text-foreground leading-snug">
                "{currentWhisper.message}"
              </p>
            </div>

            {/* Dismiss button */}
            <button
              onClick={dismissWhisper}
              className={cn(
                "flex-shrink-0 p-1 rounded-full",
                "text-muted-foreground hover:text-foreground",
                "hover:bg-muted/50 transition-colors"
              )}
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Progress bar for auto-dismiss */}
            <motion.div
              className="absolute bottom-0 left-0 h-0.5 rounded-full"
              style={{ backgroundColor: primaryAura }}
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 5, ease: "linear" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

CompanionWhisper.displayName = "CompanionWhisper";
