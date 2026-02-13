import { memo } from "react";
import { useCompanionPresence } from "@/contexts/CompanionPresenceContext";
import { useCompanionAuraColors } from "@/hooks/useCompanionAuraColors";
import { useMotionProfile } from "@/hooks/useMotionProfile";

interface CompanionNavPresenceProps {
  isActive?: boolean;
}

/**
 * Shows companion emotional state as a subtle aura around the nav icon.
 */
export const CompanionNavPresence = memo(({ isActive = false }: CompanionNavPresenceProps) => {
  const { presence, isLoading } = useCompanionPresence();
  const { navGlow, primaryAura } = useCompanionAuraColors();
  const { profile } = useMotionProfile();

  if (isLoading || !presence.isPresent) {
    return null;
  }

  const showBreathing = profile !== "reduced" && (presence.mood === "joyful" || presence.mood === "content");
  const showAttentionDot = presence.needsAttention && !isActive;

  return (
    <>
      <div
        className={`absolute inset-0 rounded-full -z-10 ${showBreathing ? "companion-nav-breathe" : ""}`}
        style={{
          boxShadow: navGlow,
          animationDuration: showBreathing ? `${3 / presence.pulseRate}s` : undefined,
        }}
      />

      {showAttentionDot && (
        <div
          className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${profile === "reduced" ? "" : "companion-attention-pulse"}`}
          style={{
            backgroundColor: primaryAura,
            boxShadow: `0 0 6px ${primaryAura}`,
          }}
        />
      )}
    </>
  );
});

CompanionNavPresence.displayName = "CompanionNavPresence";
