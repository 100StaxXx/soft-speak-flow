import { memo, useMemo } from "react";
import { useCompanionPresence, CompanionMood } from "@/contexts/CompanionPresenceContext";
import { useCompanionAuraColors } from "@/hooks/useCompanionAuraColors";
import { useNavigate } from "react-router-dom";

interface CompanionStatusPillProps {
  className?: string;
  showOnlyWhenNeeded?: boolean;
}

// Status messages by mood
const STATUS_MESSAGES: Record<CompanionMood, string[]> = {
  joyful: ["Feeling inspired", "Full of energy", "Exploring with you", "Radiant today"],
  content: ["Calm and happy", "Watching over you", "At peace", "Content"],
  neutral: ["Present", "Observing quietly", "Here with you"],
  reserved: ["Feeling distant", "Waiting...", "Needs attention"],
  quiet: ["Growing dim", "Missing you...", "Fading..."],
  dormant: ["In deep slumber", "Dormant...", "Dreaming..."],
};

/**
 * Small, unobtrusive status indicator showing companion's current feeling.
 * Can be placed in page headers. Tappable to navigate to Companion page.
 */
export const CompanionStatusPill = memo(({ 
  className = "",
  showOnlyWhenNeeded = false,
}: CompanionStatusPillProps) => {
  const { presence, isLoading } = useCompanionPresence();
  const { primaryAura } = useCompanionAuraColors();
  const navigate = useNavigate();

  const statusMessage = useMemo(() => {
    const messages = STATUS_MESSAGES[presence.mood];
    return messages[Math.floor(Math.random() * messages.length)];
  }, [presence.mood]);

  // Don't show if loading
  if (isLoading) {
    return null;
  }

  // If showOnlyWhenNeeded, only show for reserved/quiet/dormant
  if (showOnlyWhenNeeded && !presence.needsAttention && presence.mood !== 'dormant') {
    return null;
  }

  const handleClick = () => {
    navigate('/companion');
  };

  return (
    <button
      onClick={handleClick}
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
        bg-background/50 backdrop-blur-sm border border-border/50
        text-xs text-muted-foreground hover:text-foreground
        transition-all duration-300 hover:scale-105
        ${className}
      `}
      style={{
        boxShadow: presence.needsAttention 
          ? `0 0 8px ${primaryAura}` 
          : 'none',
      }}
    >
      {/* Status dot */}
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          backgroundColor: primaryAura,
          opacity: presence.mood === 'dormant' ? 0.4 : 0.8,
        }}
      />
      
      {/* Status text */}
      <span className="font-medium">{statusMessage}</span>
    </button>
  );
});

CompanionStatusPill.displayName = 'CompanionStatusPill';
