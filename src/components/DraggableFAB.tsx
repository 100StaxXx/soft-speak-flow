import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { JourneysCompanionLauncher } from "@/components/journeys/JourneysCompanionLauncher";
import { JourneysCompanionLauncherPopup } from "@/components/journeys/JourneysCompanionLauncherPopup";
import { useDraggableFAB } from "@/hooks/useDraggableFAB";
import { useJourneysCompanionVisual } from "@/hooks/useJourneysCompanionVisual";
import { cn } from "@/lib/utils";
import { getJourneysCompanionLauncherTemplates } from "@/shared/journeysCompanionLauncherTemplates";
import type { CompanionPlannerLaunchIntent } from "@/types/companionPlanner";

interface DraggableFABProps {
  onOpenCompanionPlanner: (intent?: CompanionPlannerLaunchIntent | null) => void;
}

export const DraggableFAB = ({ onOpenCompanionPlanner }: DraggableFABProps) => {
  const { user } = useAuth();
  const {
    companionLabel,
    launcherAwayImageUrl,
    launcherAwayFocalX,
    launcherAwayFocalY,
    launcherAwayUsesPortraitShell,
  } = useJourneysCompanionVisual();
  const {
    position,
    isDragging,
    isLongPressing,
    dragControls,
    longPressHandlers,
    positionStyles,
  } = useDraggableFAB();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const canTriggerTap = !isDragging && !isLongPressing;
  const isLeftAligned = position === "top-left" || position === "bottom-left";
  const launcherTemplates = useMemo(
    () => getJourneysCompanionLauncherTemplates({ userId: user?.id ?? null }),
    [user?.id],
  );

  const handleTouchStart = (event: React.TouchEvent) => {
    event.preventDefault();
  };

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  useEffect(() => {
    if (!isDragging && !isLongPressing) return;
    setIsMenuOpen(false);
  }, [isDragging, isLongPressing]);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (rootRef.current?.contains(event.target)) return;
      closeMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, isMenuOpen]);

  const handleOptionSelect = useCallback((template: (typeof launcherTemplates)[number]) => {
    closeMenu();
    const launchIntent: CompanionPlannerLaunchIntent = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      message: template.message,
      starterIntent: template.starterIntent,
      target: template.target,
      briefingContext: null,
    };
    onOpenCompanionPlanner(launchIntent);
  }, [closeMenu, launcherTemplates, onOpenCompanionPlanner]);

  return (
    <motion.div
      ref={rootRef}
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: isDragging ? 1.15 : 1,
        opacity: 1,
      }}
      style={{
        position: "fixed",
        zIndex: 50,
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
        ...positionStyles,
      }}
      className={cn(
        "flex touch-none select-none flex-col gap-2",
        isLeftAligned ? "items-start" : "items-end",
      )}
      {...dragControls}
      {...longPressHandlers}
    >
      <JourneysCompanionLauncherPopup
        open={isMenuOpen}
        position={position}
        companionLabel={companionLabel}
        options={launcherTemplates}
        onSelect={handleOptionSelect}
      />
      <JourneysCompanionLauncher
        variant="floating"
        floatingSize="hero"
        faceDirection={isMenuOpen ? "front" : "away"}
        imageUrlOverride={isMenuOpen ? null : launcherAwayImageUrl}
        imageFocalXOverride={isMenuOpen ? null : launcherAwayFocalX}
        imageFocalYOverride={isMenuOpen ? null : launcherAwayFocalY}
        usesPortraitShellOverride={isMenuOpen ? undefined : launcherAwayUsesPortraitShell}
        aria-label="Open companion quick actions"
        data-tour="add-quest-fab"
        data-testid="journeys-companion-launcher-floating"
        onClick={() => {
          if (canTriggerTap) {
            setIsMenuOpen((previous) => !previous);
          }
        }}
        onTouchStart={handleTouchStart}
        className="touch-none select-none"
        style={{
          boxShadow: isDragging
            ? "0 8px 30px rgba(0,0,0,0.3)"
            : "0 2px 8px rgba(0,0,0,0.1)",
        }}
      />
    </motion.div>
  );
};
