import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { JourneysCompanionLauncher } from "@/components/journeys/JourneysCompanionLauncher";
import { JourneysCompanionLauncherPopup } from "@/components/journeys/JourneysCompanionLauncherPopup";
import { useDraggableFAB } from "@/hooks/useDraggableFAB";
import { useCompanionLauncherImage } from "@/hooks/useCompanionLauncherImage";
import { useJourneysCompanionVisual } from "@/hooks/useJourneysCompanionVisual";
import { usePostOnboardingMentorGuidance } from "@/hooks/usePostOnboardingMentorGuidance";
import { COMPANION_LAUNCHER_IMAGE_GENERATION_ENABLED } from "@/config/companionLauncherFeatureFlags";
import { cn } from "@/lib/utils";
import {
  createCompanionPlannerLaunchIntentId,
  createCompanionPlannerQuestCaptureLaunchIntent,
} from "@/shared/companionPlannerSurfaceActions";
import { getJourneysCompanionLauncherTemplates } from "@/shared/journeysCompanionLauncherTemplates";
import type { CompanionPlannerLaunchIntent } from "@/types/companionPlanner";

interface DraggableFABProps {
  onOpenCompanionPlanner?: (intent?: CompanionPlannerLaunchIntent | null) => void;
  onCreateQuest?: () => void;
  createPlanDayLaunchIntent?: () => CompanionPlannerLaunchIntent;
  planDayLabel?: string;
  onTap?: () => void;
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
  return Math.max(0, Math.min(19 * safeRootFontSize, window.innerWidth - (POPUP_VIEWPORT_GUTTER_PX * 2)));
};

export const DraggableFAB = ({
  onOpenCompanionPlanner,
  onCreateQuest,
  createPlanDayLaunchIntent,
  planDayLabel,
  onTap,
}: DraggableFABProps) => {
  const { user } = useAuth();
  const suppressTapRef = useRef(false);
  const suppressTapResetRef = useRef<number | null>(null);
  const {
    companionId,
    companionLabel,
    currentStage,
    isGeneratedCompanion,
    currentSceneImageUrl,
    launcherAwayImageUrl,
    launcherAwayFocalX,
    launcherAwayFocalY,
    launcherAwayUsesPortraitShell,
    launcherAwayHasTransparentBackground,
    needsLauncherImage,
  } = useJourneysCompanionVisual();
  const { currentStep: tutorialStep } = usePostOnboardingMentorGuidance();
  const shouldHideTutorialEggFab =
    Boolean(tutorialStep) && typeof currentStage === "number" && currentStage <= 0;
  useCompanionLauncherImage({
    companionId,
    sourceImageUrl: currentSceneImageUrl,
    enabled: COMPANION_LAUNCHER_IMAGE_GENERATION_ENABLED && needsLauncherImage && !shouldHideTutorialEggFab,
  });
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
    longPressHandlers,
    positionStyles,
  } = useDraggableFAB({
    onDragEnd: handleDragCompleted,
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const canTriggerTap = !isDragging && !isLongPressing;
  const launcherTemplates = useMemo(
    () =>
      getJourneysCompanionLauncherTemplates({ userId: user?.id ?? null }).map((template) =>
        template.id === "plan-day" && planDayLabel
          ? { ...template, label: planDayLabel }
          : template
      ),
    [planDayLabel, user?.id],
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
    if (!onOpenCompanionPlanner) {
      closeMenu();
      return;
    }
    closeMenu();
    if (template.id === "goal" && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("companion-new-goal-started"));
    }
    if (template.id === "quest") {
      if (onCreateQuest) {
        onCreateQuest();
        return;
      }
      onOpenCompanionPlanner(createCompanionPlannerQuestCaptureLaunchIntent({
        source: "companion_planner",
        companionLabel,
      }));
      return;
    }
    if (template.id === "plan-day" && createPlanDayLaunchIntent) {
      onOpenCompanionPlanner(createPlanDayLaunchIntent());
      return;
    }
    const launchIntent: CompanionPlannerLaunchIntent = {
      id: createCompanionPlannerLaunchIntentId(),
      message: template.message,
      starterIntent: template.starterIntent,
      target: template.target,
      briefingContext: null,
    };
    onOpenCompanionPlanner(launchIntent);
  }, [
    closeMenu,
    companionLabel,
    createPlanDayLaunchIntent,
    launcherTemplates,
    onCreateQuest,
    onOpenCompanionPlanner,
  ]);

  const handleOpenHistory = useCallback(() => {
    if (!onOpenCompanionPlanner) {
      closeMenu();
      return;
    }
    closeMenu();
    const launchIntent: CompanionPlannerLaunchIntent = {
      id: createCompanionPlannerLaunchIntentId(),
      message: "",
      starterIntent: "thread_history",
      target: "planner",
      briefingContext: null,
    };
    onOpenCompanionPlanner(launchIntent);
  }, [closeMenu, onOpenCompanionPlanner]);

  if (shouldHideTutorialEggFab) {
    return null;
  }

  return (
    <motion.div
      ref={rootRef}
      initial={{ scale: 0.94, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={{
        position: "fixed",
        zIndex: 50,
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
        ...positionStyles,
      }}
      className={cn("flex touch-none select-none flex-col gap-2")}
      {...longPressHandlers}
    >
      <JourneysCompanionLauncherPopup
        open={Boolean(onOpenCompanionPlanner) && isMenuOpen}
        alignment={popupAlignment}
        companionLabel={companionLabel}
        options={launcherTemplates}
        onSelect={handleOptionSelect}
        onOpenHistory={handleOpenHistory}
        popupStyle={popupPlacement.popupStyle}
        tailStyle={popupPlacement.tailStyle}
      />
      <JourneysCompanionLauncher
        variant="floating"
        floatingSize="hero"
        faceDirection={isMenuOpen ? "front" : "away"}
        imageUrlOverride={isGeneratedCompanion ? launcherAwayImageUrl : isMenuOpen ? null : launcherAwayImageUrl}
        imageFocalXOverride={isGeneratedCompanion ? launcherAwayFocalX : isMenuOpen ? null : launcherAwayFocalX}
        imageFocalYOverride={isGeneratedCompanion ? launcherAwayFocalY : isMenuOpen ? null : launcherAwayFocalY}
        usesPortraitShellOverride={isGeneratedCompanion ? launcherAwayUsesPortraitShell : isMenuOpen ? undefined : launcherAwayUsesPortraitShell}
        allowImageFallback={!isGeneratedCompanion}
        requireHeroCutout={isGeneratedCompanion && !launcherAwayHasTransparentBackground}
        aria-label="Open companion quick actions"
        data-tour="add-quest-fab"
        data-planner-tour="companion-quick-actions"
        data-testid="journeys-companion-launcher-floating"
        onClick={() => {
          if (suppressTapRef.current) {
            return;
          }
          if (!onOpenCompanionPlanner) {
            if (canTriggerTap) {
              onTap?.();
            }
            return;
          }
          if (canTriggerTap) {
            setIsMenuOpen((previous) => !previous);
          }
        }}
        className="touch-none select-none"
      />
    </motion.div>
  );
};
