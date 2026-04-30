import { useEffect, useId, useMemo, useRef, useState } from "react";
import { resolveTutorialTarget } from "@/utils/tutorialTargets";

interface CornerRadius {
  x: number;
  y: number;
}

interface CornerRadii {
  topLeft: CornerRadius;
  topRight: CornerRadius;
  bottomRight: CornerRadius;
  bottomLeft: CornerRadius;
}

interface SpotlightGeometry {
  top: number;
  left: number;
  width: number;
  height: number;
  radii: CornerRadii;
  pathD: string;
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

const parseLengthValue = (value: string, reference: number, fallback: number): number => {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (trimmed.endsWith("%")) {
    const percent = Number.parseFloat(trimmed);
    return Number.isFinite(percent) ? (percent / 100) * reference : fallback;
  }
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

const parseCornerRadius = (value: string, width: number, height: number): CornerRadius => {
  const [xValue, yValue = xValue] = value.trim().split(/\s+/);
  return {
    x: Math.max(0, parseLengthValue(xValue, width, 0)),
    y: Math.max(0, parseLengthValue(yValue, height, 0)),
  };
};

const scaleCornerRadii = (radii: CornerRadii, width: number, height: number): CornerRadii => {
  const maxHorizontalSum = Math.max(
    radii.topLeft.x + radii.topRight.x,
    radii.bottomLeft.x + radii.bottomRight.x,
  );
  const maxVerticalSum = Math.max(
    radii.topLeft.y + radii.bottomLeft.y,
    radii.topRight.y + radii.bottomRight.y,
  );
  const scale = Math.min(
    1,
    maxHorizontalSum > 0 ? width / maxHorizontalSum : 1,
    maxVerticalSum > 0 ? height / maxVerticalSum : 1,
  );

  const applyScale = (radius: CornerRadius): CornerRadius => ({
    x: radius.x * scale,
    y: radius.y * scale,
  });

  return {
    topLeft: applyScale(radii.topLeft),
    topRight: applyScale(radii.topRight),
    bottomRight: applyScale(radii.bottomRight),
    bottomLeft: applyScale(radii.bottomLeft),
  };
};

export const readTargetBorderRadii = (
  element: HTMLElement,
  width: number,
  height: number,
): CornerRadii => {
  const shape = element.dataset.tourShape;
  if (shape === "circle" || shape === "pill") {
    const radius = { x: width / 2, y: height / 2 };
    return {
      topLeft: radius,
      topRight: radius,
      bottomRight: radius,
      bottomLeft: radius,
    };
  }

  const computed = window.getComputedStyle(element);
  return scaleCornerRadii(
    {
      topLeft: parseCornerRadius(computed.borderTopLeftRadius, width, height),
      topRight: parseCornerRadius(computed.borderTopRightRadius, width, height),
      bottomRight: parseCornerRadius(computed.borderBottomRightRadius, width, height),
      bottomLeft: parseCornerRadius(computed.borderBottomLeftRadius, width, height),
    },
    width,
    height,
  );
};

const roundPathNumber = (value: number) => {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
};

const formatPathNumber = (value: number) => String(roundPathNumber(value));

export const buildRoundedRectPath = ({
  left,
  top,
  width,
  height,
  radii,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  radii: CornerRadii;
}): string => {
  const right = left + width;
  const bottom = top + height;
  const tl = radii.topLeft;
  const tr = radii.topRight;
  const br = radii.bottomRight;
  const bl = radii.bottomLeft;

  const parts = [
    `M ${formatPathNumber(left + tl.x)} ${formatPathNumber(top)}`,
    `H ${formatPathNumber(right - tr.x)}`,
  ];

  if (tr.x > 0 && tr.y > 0) {
    parts.push(`A ${formatPathNumber(tr.x)} ${formatPathNumber(tr.y)} 0 0 1 ${formatPathNumber(right)} ${formatPathNumber(top + tr.y)}`);
  } else {
    parts.push(`L ${formatPathNumber(right)} ${formatPathNumber(top)}`);
  }

  parts.push(`V ${formatPathNumber(bottom - br.y)}`);
  if (br.x > 0 && br.y > 0) {
    parts.push(`A ${formatPathNumber(br.x)} ${formatPathNumber(br.y)} 0 0 1 ${formatPathNumber(right - br.x)} ${formatPathNumber(bottom)}`);
  } else {
    parts.push(`L ${formatPathNumber(right)} ${formatPathNumber(bottom)}`);
  }

  parts.push(`H ${formatPathNumber(left + bl.x)}`);
  if (bl.x > 0 && bl.y > 0) {
    parts.push(`A ${formatPathNumber(bl.x)} ${formatPathNumber(bl.y)} 0 0 1 ${formatPathNumber(left)} ${formatPathNumber(bottom - bl.y)}`);
  } else {
    parts.push(`L ${formatPathNumber(left)} ${formatPathNumber(bottom)}`);
  }

  parts.push(`V ${formatPathNumber(top + tl.y)}`);
  if (tl.x > 0 && tl.y > 0) {
    parts.push(`A ${formatPathNumber(tl.x)} ${formatPathNumber(tl.y)} 0 0 1 ${formatPathNumber(left + tl.x)} ${formatPathNumber(top)}`);
  } else {
    parts.push(`L ${formatPathNumber(left)} ${formatPathNumber(top)}`);
  }

  parts.push("Z");
  return parts.join(" ");
};

const toSpotlightGeometry = (targetElement: HTMLElement): SpotlightGeometry => {
  const rect = targetElement.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const left = clamp(rect.left, 0, viewportWidth);
  const top = clamp(rect.top, 0, viewportHeight);
  const right = clamp(rect.right, 0, viewportWidth);
  const bottom = clamp(rect.bottom, 0, viewportHeight);

  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  const radii = readTargetBorderRadii(targetElement, width, height);

  return {
    top,
    left,
    width,
    height,
    radii,
    pathD: buildRoundedRectPath({ left, top, width, height, radii }),
  };
};

const areSpotlightGeometriesEqual = (
  a: SpotlightGeometry | null,
  b: SpotlightGeometry | null,
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;

  return a.top === b.top
    && a.left === b.left
    && a.width === b.width
    && a.height === b.height
    && a.pathD === b.pathD;
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
  const rawMaskId = useId();
  const maskId = `mentor-spotlight-mask-${rawMaskId.replace(/:/g, "")}`;
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [panelElement, setPanelElement] = useState<HTMLElement | null>(null);
  const [spotlightGeometry, setSpotlightGeometry] = useState<SpotlightGeometry | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const initialFocusAppliedRef = useRef(false);
  const focusFrameRef = useRef<number | null>(null);
  const focusedTargetRef = useRef<HTMLElement | null>(null);
  const measuredTargetRef = useRef<HTMLElement | null>(null);
  const measuredSpotlightGeometryRef = useRef<SpotlightGeometry | null>(null);

  useEffect(() => {
    if (!active || !targetSelector) {
      measuredTargetRef.current = null;
      measuredSpotlightGeometryRef.current = null;
      setTargetElement(null);
      setSpotlightGeometry(null);
      return;
    }

    let animationFrame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    const update = () => {
      const target = resolveTutorialTarget(targetSelector)?.element ?? null;
      const nextSpotlightGeometry = target ? toSpotlightGeometry(target) : null;
      if (measuredTargetRef.current !== target) {
        measuredTargetRef.current = target;
        setTargetElement(target);
      }
      if (!areSpotlightGeometriesEqual(measuredSpotlightGeometryRef.current, nextSpotlightGeometry)) {
        measuredSpotlightGeometryRef.current = nextSpotlightGeometry;
        setSpotlightGeometry(nextSpotlightGeometry);
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
      measuredSpotlightGeometryRef.current = null;
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

  const ready = useMemo(
    () => active && targetElement && spotlightGeometry,
    [active, targetElement, spotlightGeometry],
  );

  if (!ready || !spotlightGeometry) {
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
              style={{ top: 0, left: 0, width: "100%", height: `${spotlightGeometry.top}px` }}
              {...blockedClickProps}
            />
            <div
              className="mentor-spotlight-blocker"
              style={{
                top: `${spotlightGeometry.top}px`,
                left: 0,
                width: `${spotlightGeometry.left}px`,
                height: `${spotlightGeometry.height}px`,
              }}
              {...blockedClickProps}
            />
            <div
              className="mentor-spotlight-blocker"
              style={{
                top: `${spotlightGeometry.top}px`,
                left: `${spotlightGeometry.left + spotlightGeometry.width}px`,
                width: `${Math.max(0, viewportWidth - (spotlightGeometry.left + spotlightGeometry.width))}px`,
                height: `${spotlightGeometry.height}px`,
              }}
              {...blockedClickProps}
            />
            <div
              className="mentor-spotlight-blocker"
              style={{
                top: `${spotlightGeometry.top + spotlightGeometry.height}px`,
                left: 0,
                width: "100%",
                height: `${Math.max(0, viewportHeight - (spotlightGeometry.top + spotlightGeometry.height))}px`,
              }}
              {...blockedClickProps}
            />
          </>
        ) : null}

        <svg
          aria-hidden="true"
          className="mentor-spotlight-svg"
          width={viewportWidth}
          height={viewportHeight}
          viewBox={`0 0 ${viewportWidth} ${viewportHeight}`}
        >
          {mode === "spotlight" ? (
            <>
              <defs>
                <mask id={maskId}>
                  <rect width="100%" height="100%" fill="white" />
                  <path d={spotlightGeometry.pathD} fill="black" />
                </mask>
              </defs>
              <rect
                className="mentor-spotlight-mask"
                width="100%"
                height="100%"
                mask={`url(#${maskId})`}
              />
            </>
          ) : null}
          <path
            className={`mentor-spotlight-ring mentor-spotlight-ring--${mode}`}
            d={spotlightGeometry.pathD}
            data-testid="mentor-spotlight-path"
          />
        </svg>
      </div>
    </>
  );
};
