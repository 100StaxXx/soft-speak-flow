import { memo, useState, useEffect } from "react";
import { useCompanionPresence } from "@/contexts/CompanionPresenceContext";
import { useCompanionAuraColors } from "@/hooks/useCompanionAuraColors";

/**
 * Very subtle full-screen color overlay that shifts based on companion mood.
 * Opacity is extremely low (0.02-0.06) to avoid interfering with UI.
 */
export const CompanionMoodOverlay = memo(() => {
  const { presence, isLoading } = useCompanionPresence();
  const { gradientOverlay } = useCompanionAuraColors();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Don't render if loading or no presence
  if (isLoading || !presence.isPresent) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
      style={{
        background: gradientOverlay,
        transition: prefersReducedMotion ? 'none' : 'background 3000ms ease-in-out',
        willChange: prefersReducedMotion ? 'auto' : 'background',
      }}
    />
  );
});

CompanionMoodOverlay.displayName = 'CompanionMoodOverlay';
