import { useEffect, useMemo, useRef, useState } from "react";
import { resolveTutorialTarget } from "@/utils/tutorialTargets";

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius: number;
}

type MentorSpotlightMode = "spotlight" | "outline";

interface MentorSpotlightGuardProps {
  active: boolean;
  mode?: MentorSpotlightMode;
  targetSelector: string | null;
  panelSelector?: string;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const parseLengthPx = (value: string, fallback: number): number => {
  if (!value) return fallback;
  if (value.includes("%")) return fallback;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

const readTargetBorderRadius = (element: HTMLElement): number => {
  const computed = window.getComputedStyle(element);
  return Math.max(0, parseLengthPx(computed.borderTopLeftRadius, 0));
};

const toSpotlightRect = (targetElement: HTMLElement, padding: number): SpotlightRect => {
  const rect = targetElement.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const left = clamp(rect.left - padding, 0, viewportWidth);
  const top = clamp(rect.top - padding, 0, viewportHeight);
  const right = clamp(rect.right + padding, 0, viewportWidth);
  const bottom = clamp(rect.bottom + padding, 0, viewportHeight);

  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  const innerRadius = readTargetBorderRadius(targetElement);
  const maxRadius = Math.max(0, Math.min(width, height) / 2);
  const borderRadius = Math.min(innerRadius + padding, maxRadius);

  return {
    top,
    left,
    width,
    height,
    borderRadius,
  };
};

const areSpotlightRectsEqual = (a: SpotlightRect | null, b: SpotlightRect | null): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;

  return a.top === b.top
    && a.left === b.left
    && a.width === b.width
    && a.height === b.height
    && a.borderRadius === b.borderRadius;
};

const TUTORIAL_LAYER_MUTATION_SELECTOR = [
  '[data-tutorial-layer="true"]',
  '[data-tutorial="mentor-dialogue-panel"]',
].join(",");

const isTutorialLayerNode = (node: Node): boolean => {
  if (node instanceof Element) {
    return Boolean(node.closest(TUTORIAL_LAYER_MUTATION_SELECTOR));
  }

  return Boolean(node.parentElement?.closest(TUTORIAL_LAYER_MUTATION_SELECTOR));
};

const isTutorialLayerOnlyMutation = (mutation: MutationRecord): boolean => {
  if (mutation.type === "attributes") {
    return isTutorialLayerNode(mutation.target);
  }

  const changedNodes = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)];
  return changedNodes.length > 0 && changedNodes.every(isTutorialLayerNode);
};

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const isFocusableElement = (element: HTMLElement): boolean =>
  element.matches(FOCUSABLE_SELECTOR)
  && !element.hasAttribute("disabled")
  && element.tabIndex !== -1;

const getFocusableElements = (root: HTMLElement | null): HTMLElement[] => {
  if (!root) return [];

  const descendants = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return [
    ...(isFocusableElement(root) ? [root] : []),
    ...descendants,
  ].filter((element) => isFocusableElement(element));
};

const getUniqueFocusableElements = (...roots: Array<HTMLElement | null>): HTMLElement[] => {
  const seen = new Set<HTMLElement>();
  const focusables: HTMLElement[] = [];

  roots.forEach((root) => {
    getFocusableElements(root).forEach((element) => {
      if (seen.has(element)) return;
      seen.add(element);
      focusables.push(element);
    });
  });

  return focusables;
};

export const MentorSpotlightGuard = ({
  active,
  mode = "spotlight",
  targetSelector,
  panelSelector = '[data-tutorial="mentor-dialogue-panel"]',
}: MentorSpotlightGuardProps) => {
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [panelElement, setPanelElement] = useState<HTMLElement | null>(null);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const initialFocusAppliedRef = useRef(false);
  const focusFrameRef = useRef<number | null>(null);
  const focusedTargetRef = useRef<HTMLElement | null>(null);
  const measuredTargetRef = useRef<HTMLElement | null>(null);
  const measuredSpotlightRectRef = useRef<SpotlightRect | null>(null);

  useEffect(() => {
    if (!active || !targetSelector) {
      measuredTargetRef.current = null;
      measuredSpotlightRectRef.current = null;
      setTargetElement(null);
      setSpotlightRect(null);
      return;
    }

    let animationFrame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    const update = () => {
      const target = resolveTutorialTarget(targetSelector)?.element ?? null;
      const nextSpotlightRect = target ? toSpotlightRect(target, 10) : null;
      if (measuredTargetRef.current !== target) {
        measuredTargetRef.current = target;
        setTargetElement(target);
      }
      if (!areSpotlightRectsEqual(measuredSpotlightRectRef.current, nextSpotlightRect)) {
        measuredSpotlightRectRef.current = nextSpotlightRect;
        setSpotlightRect(nextSpotlightRect);
      }
      if (target && resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver.observe(target);
      }
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(update);
    };

    update();

    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(scheduleUpdate);
      const target = resolveTutorialTarget(targetSelector)?.element ?? null;
      if (target) resizeObserver.observe(target);
    }

    if ("MutationObserver" in window && document.body) {
      mutationObserver = new MutationObserver((mutations) => {
        if (mutations.every(isTutorialLayerOnlyMutation)) return;
        scheduleUpdate();
      });
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style", "data-state", "hidden"],
      });
    }

    window.addEventListener("scroll", scheduleUpdate, true);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("orientationchange", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      measuredTargetRef.current = null;
      measuredSpotlightRectRef.current = null;
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener("scroll", scheduleUpdate, true);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
    };
  }, [active, targetSelector]);

  useEffect(() => {
    if (!active || mode !== "spotlight") {
      setPanelElement(null);
      return;
    }

    let animationFrame = 0;
    let mutationObserver: MutationObserver | null = null;
    const updatePanel = () => {
      setPanelElement(document.querySelector(panelSelector) as HTMLElement | null);
    };
    const scheduleUpdatePanel = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updatePanel);
    };

    updatePanel();
    if ("MutationObserver" in window && document.body) {
      mutationObserver = new MutationObserver(scheduleUpdatePanel);
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style", "data-state", "hidden"],
      });
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
      mutationObserver?.disconnect();
    };
  }, [active, mode, panelSelector]);

  useEffect(() => {
    if (!active || !targetElement) return;

    targetElement.classList.add("mentor-spotlight-target-elevated");
    return () => {
      targetElement.classList.remove("mentor-spotlight-target-elevated");
    };
  }, [active, targetElement]);

  useEffect(() => {
    if (!active || mode !== "spotlight") return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    initialFocusAppliedRef.current = false;
    focusedTargetRef.current = null;

    return () => {
      if (focusFrameRef.current !== null) {
        window.cancelAnimationFrame(focusFrameRef.current);
        focusFrameRef.current = null;
      }
      initialFocusAppliedRef.current = false;
      focusedTargetRef.current = null;
      const previousFocus = previousFocusRef.current;
      previousFocusRef.current = null;
      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };
  }, [active, mode]);

  useEffect(() => {
    if (!active || mode !== "spotlight" || !targetElement) {
      initialFocusAppliedRef.current = false;
      focusedTargetRef.current = null;
      if (focusFrameRef.current !== null) {
        window.cancelAnimationFrame(focusFrameRef.current);
        focusFrameRef.current = null;
      }
      return;
    }

    if (focusedTargetRef.current !== targetElement) {
      focusedTargetRef.current = targetElement;
      initialFocusAppliedRef.current = false;
    }

    if (initialFocusAppliedRef.current) return;

    if (focusFrameRef.current !== null) {
      window.cancelAnimationFrame(focusFrameRef.current);
    }

    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null;
      const focusables = getUniqueFocusableElements(targetElement, panelElement);
      focusables[0]?.focus();
      initialFocusAppliedRef.current = true;
    });

    return () => {
      if (focusFrameRef.current !== null) {
        window.cancelAnimationFrame(focusFrameRef.current);
        focusFrameRef.current = null;
      }
    };
  }, [active, mode, panelElement, targetElement]);

  useEffect(() => {
    if (!active || mode !== "spotlight" || !targetElement) return;

    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const focusables = getUniqueFocusableElements(targetElement, panelElement);

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
  }, [active, mode, panelElement, targetElement]);

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
    <>
      {mode === "spotlight" ? (
        <span className="sr-only" role="status" aria-live="polite">
          Tutorial highlight active. Use Tab to move between the highlighted action and the mentor guidance.
        </span>
      ) : null}
      <div
        className={`mentor-spotlight-root mentor-spotlight-root--${mode}`}
        aria-hidden="true"
        data-mode={mode}
        data-tutorial-layer="true"
        data-testid="mentor-spotlight-guard"
      >
        {mode === "spotlight" ? (
          <>
            <div
              className="mentor-spotlight-blocker"
              style={{ top: 0, left: 0, width: "100%", height: `${spotlightRect.top}px` }}
              {...blockedClickProps}
            />
            <div
              className="mentor-spotlight-blocker"
              style={{
                top: `${spotlightRect.top}px`,
                left: 0,
                width: `${spotlightRect.left}px`,
                height: `${spotlightRect.height}px`,
              }}
              {...blockedClickProps}
            />
            <div
              className="mentor-spotlight-blocker"
              style={{
                top: `${spotlightRect.top}px`,
                left: `${spotlightRect.left + spotlightRect.width}px`,
                width: `${Math.max(0, viewportWidth - (spotlightRect.left + spotlightRect.width))}px`,
                height: `${spotlightRect.height}px`,
              }}
              {...blockedClickProps}
            />
            <div
              className="mentor-spotlight-blocker"
              style={{
                top: `${spotlightRect.top + spotlightRect.height}px`,
                left: 0,
                width: "100%",
                height: `${Math.max(0, viewportHeight - (spotlightRect.top + spotlightRect.height))}px`,
              }}
              {...blockedClickProps}
            />
            <div
              className="mentor-spotlight-mask"
              style={{
                top: `${spotlightRect.top}px`,
                left: `${spotlightRect.left}px`,
                width: `${spotlightRect.width}px`,
                height: `${spotlightRect.height}px`,
                borderRadius: `${spotlightRect.borderRadius}px`,
              }}
            />
          </>
        ) : null}

        <div
          className={`mentor-spotlight-ring mentor-spotlight-ring--${mode}`}
          style={{
            top: `${spotlightRect.top}px`,
            left: `${spotlightRect.left}px`,
            width: `${spotlightRect.width}px`,
            height: `${spotlightRect.height}px`,
            borderRadius: `${spotlightRect.borderRadius}px`,
          }}
        />
      </div>
    </>
  );
};
