import { useEffect, useMemo, useState } from "react";

const GUARD_PADDING_FALLBACK = 10;

export interface TutorialInteractionGuardProps {
  active: boolean;
  targetElement: HTMLElement | null;
  panelElement: HTMLElement | null;
  spotlightPadding?: number;
  onBlockedInteraction?: () => void;
  maskStyle?: "dim";
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const toSpotlightRect = (targetElement: HTMLElement, padding: number): SpotlightRect => {
  const rect = targetElement.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const left = clamp(rect.left - padding, 0, viewportWidth);
  const top = clamp(rect.top - padding, 0, viewportHeight);
  const right = clamp(rect.right + padding, 0, viewportWidth);
  const bottom = clamp(rect.bottom + padding, 0, viewportHeight);

  return {
    top,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
};

const getFocusableElements = (root: HTMLElement | null): HTMLElement[] => {
  if (!root) return [];

  return Array.from(
    root.querySelectorAll<HTMLElement>(
      [
        'button:not([disabled])',
        '[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(",")
    )
  ).filter((element) => !element.hasAttribute("disabled") && element.tabIndex !== -1);
};

export const TutorialInteractionGuard = ({
  active,
  targetElement,
  panelElement,
  spotlightPadding = GUARD_PADDING_FALLBACK,
  onBlockedInteraction,
  maskStyle = "dim",
}: TutorialInteractionGuardProps) => {
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);

  useEffect(() => {
    if (!active || !targetElement) {
      setSpotlightRect(null);
      return;
    }

    const updateSpotlight = () => {
      setSpotlightRect(toSpotlightRect(targetElement, spotlightPadding));
    };

    updateSpotlight();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateSpotlight) : null;

    resizeObserver?.observe(targetElement);

    window.addEventListener("scroll", updateSpotlight, true);
    window.addEventListener("resize", updateSpotlight);
    window.addEventListener("orientationchange", updateSpotlight);

    const pollTimer = window.setInterval(updateSpotlight, 350);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("scroll", updateSpotlight, true);
      window.removeEventListener("resize", updateSpotlight);
      window.removeEventListener("orientationchange", updateSpotlight);
      window.clearInterval(pollTimer);
    };
  }, [active, spotlightPadding, targetElement]);

  useEffect(() => {
    if (!active) return;

    if (targetElement) {
      targetElement.classList.add("tutorial-guide-target-elevated");
    }

    if (panelElement) {
      panelElement.classList.add("tutorial-guide-panel-elevated");
    }

    return () => {
      targetElement?.classList.remove("tutorial-guide-target-elevated");
      panelElement?.classList.remove("tutorial-guide-panel-elevated");
    };
  }, [active, panelElement, targetElement]);

  useEffect(() => {
    if (!active) return;

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const focusables = [
        ...getFocusableElements(panelElement),
        ...getFocusableElements(targetElement),
      ];

      if (focusables.length === 0) return;

      const activeElement = document.activeElement as HTMLElement | null;
      const currentIndex = activeElement ? focusables.indexOf(activeElement) : -1;

      if (currentIndex === -1) {
        event.preventDefault();
        focusables[0]?.focus();
        return;
      }

      const nextIndex = event.shiftKey
        ? (currentIndex - 1 + focusables.length) % focusables.length
        : (currentIndex + 1) % focusables.length;

      event.preventDefault();
      focusables[nextIndex]?.focus();
    };

    document.addEventListener("keydown", handleTabKey);
    return () => {
      document.removeEventListener("keydown", handleTabKey);
    };
  }, [active, panelElement, targetElement]);

  const maskClassName = useMemo(() => {
    if (maskStyle === "dim") return "tutorial-guide-mask";
    return "tutorial-guide-mask";
  }, [maskStyle]);

  if (!active || !spotlightRect) {
    return null;
  }

  const blockedClickProps = {
    onPointerDown: (event: { preventDefault: () => void; stopPropagation: () => void }) => {
      event.preventDefault();
      event.stopPropagation();
      onBlockedInteraction?.();
    },
    onClick: (event: { preventDefault: () => void; stopPropagation: () => void }) => {
      event.preventDefault();
      event.stopPropagation();
      onBlockedInteraction?.();
    },
  };

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  return (
    <div className="tutorial-guide-guard-root" aria-hidden="true" data-testid="tutorial-interaction-guard">
      <div
        className={maskClassName}
        style={{ top: 0, left: 0, width: "100%", height: `${spotlightRect.top}px` }}
        data-testid="tutorial-guard-mask-top"
        {...blockedClickProps}
      />
      <div
        className={maskClassName}
        style={{
          top: `${spotlightRect.top}px`,
          left: 0,
          width: `${spotlightRect.left}px`,
          height: `${spotlightRect.height}px`,
        }}
        data-testid="tutorial-guard-mask-left"
        {...blockedClickProps}
      />
      <div
        className={maskClassName}
        style={{
          top: `${spotlightRect.top}px`,
          left: `${spotlightRect.left + spotlightRect.width}px`,
          width: `${Math.max(0, viewportWidth - (spotlightRect.left + spotlightRect.width))}px`,
          height: `${spotlightRect.height}px`,
        }}
        data-testid="tutorial-guard-mask-right"
        {...blockedClickProps}
      />
      <div
        className={maskClassName}
        style={{
          top: `${spotlightRect.top + spotlightRect.height}px`,
          left: 0,
          width: "100%",
          height: `${Math.max(0, viewportHeight - (spotlightRect.top + spotlightRect.height))}px`,
        }}
        data-testid="tutorial-guard-mask-bottom"
        {...blockedClickProps}
      />

      <div
        className="tutorial-guide-cutout-ring"
        style={{
          top: `${spotlightRect.top}px`,
          left: `${spotlightRect.left}px`,
          width: `${spotlightRect.width}px`,
          height: `${spotlightRect.height}px`,
        }}
        data-testid="tutorial-guard-ring"
      />
    </div>
  );
};
