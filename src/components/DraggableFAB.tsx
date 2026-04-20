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

const FLOATING_LAUNCHER_SIZE_PX = 144;
const POPUP_VIEWPORT_GUTTER_PX = 16;
const POPUP_TAIL_SIZE_PX = 24;
const POPUP_TAIL_EDGE_INSET_PX = 28;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getPopupWidthPx = () => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return 0;
  }

  const rootFontSize = Number.parseFloat(
    window.getComputedStyle(document.documentElement).fontSize || "16",
  );
  const safeRootFontSize = Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16;
  return Math.max(0, Math.min(21 * safeRootFontSize, window.innerWidth - (POPUP_VIEWPORT_GUTTER_PX * 2)));
};

export const DraggableFAB = ({ onOpenCompanionPlanner }: DraggableFABProps) => {
  const { user } = useAuth();
  const suppressTapRef = useRef(false);
  const suppressTapResetRef = useRef<number | null>(null);
  const {
    companionLabel,
    launcherAwayImageUrl,
    launcherAwayFocalX,
    launcherAwayFocalY,
    launcherAwayUsesPortraitShell,
  } = useJourneysCompanionVisual();
  const handleDragCompleted = useCallback(() => {
    suppressTapRef.current = true;
    if (suppressTapResetRef.current !== null) {
      window.clearTimeout(suppressTapResetRef.current);
    }
    suppressTapResetRef.current = window.setTimeout(() => {
      suppressTapRef.current = false;
      suppressTapResetRef.current = null;
    }, 0);
  }, []);
  const {
    position,
    popupAlignment,
    isDragging,
    isLongPressing,
    dragControls,
    longPressHandlers,
    positionStyles,
  } = useDraggableFAB({
    onDragEnd: handleDragCompleted,
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const canTriggerTap = !isDragging && !isLongPressing;
  const launcherTemplates = useMemo(
    () => getJourneysCompanionLauncherTemplates({ userId: user?.id ?? null }),
    [user?.id],
  );

  const popupPlacement = (() => {
    if (typeof window === "undefined") {
      return {
        popupStyle: undefined,
        tailStyle: undefined,
      };
    }

    const popupWidth = getPopupWidthPx();
    const minLeft = POPUP_VIEWPORT_GUTTER_PX - position.x;
    const maxLeft = window.innerWidth - POPUP_VIEWPORT_GUTTER_PX - popupWidth - position.x;
    const idealLeft = popupAlignment.horizontal === "left"
      ? 0
      : FLOATING_LAUNCHER_SIZE_PX - popupWidth;
    const offsetLeft = clamp(idealLeft, minLeft, maxLeft);
    const popupViewportLeft = position.x + offsetLeft;
    const launcherCenterX = position.x + (FLOATING_LAUNCHER_SIZE_PX / 2);
    const minTailOffset = POPUP_TAIL_EDGE_INSET_PX;
    const maxTailOffset = Math.max(
      minTailOffset,
      popupWidth - POPUP_TAIL_EDGE_INSET_PX - POPUP_TAIL_SIZE_PX,
    );
    const tailLeft = clamp(
      launcherCenterX - popupViewportLeft - (POPUP_TAIL_SIZE_PX / 2),
      minTailOffset,
      maxTailOffset,
    );

    return {
      popupStyle: {
        left: `${offsetLeft}px`,
      },
      tailStyle: {
        left: `${tailLeft}px`,
      },
    };
  })();

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
    return () => {
      if (suppressTapResetRef.current !== null) {
        window.clearTimeout(suppressTapResetRef.current);
      }
    };
  }, []);

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
      className={cn("flex touch-none select-none flex-col gap-2")}
      {...dragControls}
      {...longPressHandlers}
    >
      <JourneysCompanionLauncherPopup
        open={isMenuOpen}
        alignment={popupAlignment}
        companionLabel={companionLabel}
        options={launcherTemplates}
        onSelect={handleOptionSelect}
        popupStyle={popupPlacement.popupStyle}
        tailStyle={popupPlacement.tailStyle}
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
          if (suppressTapRef.current) {
            return;
          }
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
