import { memo, useState, useEffect } from "react";
import { useCompanionPresence } from "@/contexts/CompanionPresenceContext";
import { useCompanionAuraColors } from "@/hooks/useCompanionAuraColors";

interface CompanionNavPresenceProps {
  isActive?: boolean;
}

/**
 * Shows companion's emotional state as a subtle aura/glow around the nav icon.
 * Also displays a "breathing" animation when companion is content/joyful,
 * and a pulsing dot when companion needs attention.
 */
export const CompanionNavPresence = memo(({ isActive = false }: CompanionNavPresenceProps) => {
  const { presence, isLoading } = useCompanionPresence();
  const { navGlow, primaryAura } = useCompanionAuraColors();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  if (isLoading || !presence.isPresent) {
    return null;
  }

  const showBreathing = !prefersReducedMotion && (presence.mood === 'joyful' || presence.mood === 'content');
  const showAttentionDot = presence.needsAttention && !isActive;

  return (
    <>
      {/* Aura glow behind the icon */}
      <div
        className="absolute inset-0 rounded-full -z-10"
        style={{
          boxShadow: navGlow,
          animation: showBreathing 
            ? `companion-nav-breathe ${3 / presence.pulseRate}s ease-in-out infinite`
            : 'none',
          willChange: showBreathing ? 'box-shadow' : 'auto',
        }}
      />

      {/* Attention indicator dot */}
      {showAttentionDot && (
        <div
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
          style={{
            backgroundColor: primaryAura,
            boxShadow: `0 0 6px ${primaryAura}`,
            animation: prefersReducedMotion ? 'none' : 'companion-attention-pulse 2s ease-in-out infinite',
          }}
        />
      )}

      <style>{`
        @keyframes companion-nav-breathe {
          0%, 100% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
        }

        @keyframes companion-attention-pulse {
          0%, 100% {
            opacity: 0.7;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.3);
          }
        }
      `}</style>
    </>
  );
});

CompanionNavPresence.displayName = 'CompanionNavPresence';
