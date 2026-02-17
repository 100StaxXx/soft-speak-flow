import { useEffect, useMemo, useState } from "react";

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface MentorSpotlightGuardProps {
  active: boolean;
  targetSelector: string | null;
  panelSelector?: string;
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

export const MentorSpotlightGuard = ({
  active,
  targetSelector,
  panelSelector = '[data-tutorial="mentor-dialogue-panel"]',
}: MentorSpotlightGuardProps) => {
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [panelElement, setPanelElement] = useState<HTMLElement | null>(null);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);

  useEffect(() => {
    if (!active || !targetSelector) {
      setTargetElement(null);
      setSpotlightRect(null);
      return;
    }

    const update = () => {
      const target = document.querySelector(targetSelector) as HTMLElement | null;
      setTargetElement(target);
      setSpotlightRect(target ? toSpotlightRect(target, 10) : null);
    };

    update();

    const interval = window.setInterval(update, 250);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [active, targetSelector]);

  useEffect(() => {
    if (!active) {
      setPanelElement(null);
      return;
    }

    const updatePanel = () => {
      setPanelElement(document.querySelector(panelSelector) as HTMLElement | null);
    };

    updatePanel();
    const interval = window.setInterval(updatePanel, 250);

    return () => {
      window.clearInterval(interval);
    };
  }, [active, panelSelector]);

  useEffect(() => {
    if (!active || !targetElement) return;

    targetElement.classList.add("mentor-spotlight-target-elevated");
    return () => {
      targetElement.classList.remove("mentor-spotlight-target-elevated");
    };
  }, [active, targetElement]);

  useEffect(() => {
    if (!active || !targetElement) return;

    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const focusables = [
        ...getFocusableElements(targetElement),
        ...getFocusableElements(panelElement),
      ];

      if (focusables.length === 0) return;

      const activeEl = document.activeElement as HTMLElement | null;
      const currentIndex = activeEl ? focusables.indexOf(activeEl) : -1;

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

    document.addEventListener("keydown", handleTab);
    return () => {
      document.removeEventListener("keydown", handleTab);
    };
  }, [active, panelElement, targetElement]);

  const blockedClickProps = {
    onPointerDown: (event: { preventDefault: () => void; stopPropagation: () => void }) => {
      event.preventDefault();
      event.stopPropagation();
    },
    onClick: (event: { preventDefault: () => void; stopPropagation: () => void }) => {
      event.preventDefault();
      event.stopPropagation();
    },
  };

  const ready = useMemo(() => active && targetElement && spotlightRect, [active, targetElement, spotlightRect]);

  if (!ready || !spotlightRect) {
    return null;
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  return (
    <div className="mentor-spotlight-root" aria-hidden="true" data-testid="mentor-spotlight-guard">
      <div
        className="mentor-spotlight-mask"
        style={{ top: 0, left: 0, width: "100%", height: `${spotlightRect.top}px` }}
        {...blockedClickProps}
      />
      <div
        className="mentor-spotlight-mask"
        style={{
          top: `${spotlightRect.top}px`,
          left: 0,
          width: `${spotlightRect.left}px`,
          height: `${spotlightRect.height}px`,
        }}
        {...blockedClickProps}
      />
      <div
        className="mentor-spotlight-mask"
        style={{
          top: `${spotlightRect.top}px`,
          left: `${spotlightRect.left + spotlightRect.width}px`,
          width: `${Math.max(0, viewportWidth - (spotlightRect.left + spotlightRect.width))}px`,
          height: `${spotlightRect.height}px`,
        }}
        {...blockedClickProps}
      />
      <div
        className="mentor-spotlight-mask"
        style={{
          top: `${spotlightRect.top + spotlightRect.height}px`,
          left: 0,
          width: "100%",
          height: `${Math.max(0, viewportHeight - (spotlightRect.top + spotlightRect.height))}px`,
        }}
        {...blockedClickProps}
      />

      <div
        className="mentor-spotlight-ring"
        style={{
          top: `${spotlightRect.top}px`,
          left: `${spotlightRect.left}px`,
          width: `${spotlightRect.width}px`,
          height: `${spotlightRect.height}px`,
        }}
      />
    </div>
  );
};
