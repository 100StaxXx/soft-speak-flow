import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { usePostOnboardingMentorGuidance } from "@/hooks/usePostOnboardingMentorGuidance";
import { MentorAvatar } from "@/components/MentorAvatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveTutorialTarget } from "@/utils/tutorialTargets";

const PANEL_GAP_PX = 12;
const PANEL_TOP_MARGIN_PX = 12;
const PANEL_TOP_SAFE_BUFFER_PX = 8;
const PANEL_BASE_BOTTOM_PX = 0;
const PANEL_SIDE_MARGIN_PX = 12;
const COMPACT_PANEL_MAX_WIDTH_PX = 320;
const COMPACT_PANEL_HEIGHT_PX = 104;
const BOTTOM_INSET_CSS_VAR = "--mentor-guidance-bottom-inset";
const BOTTOM_INSET_MAX_VIEWPORT_RATIO = 0.4;
const BOTTOM_INSET_UPDATE_THRESHOLD_PX = 1;
const COMPANION_HEADER_SELECTOR = '[data-tour="companion-header"]';

type PanelPlacement =
  | { anchor: "bottom"; bottomPx: number }
  | { anchor: "top"; topPx: number }
  | {
      anchor: "floating";
      topPx: number;
      leftPx: number;
      widthPx: number;
      heightPx?: number;
      compact?: boolean;
    };

interface RectLike {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

const normalizePlacement = (placement: PanelPlacement): PanelPlacement =>
  placement.anchor === "bottom"
    ? { anchor: "bottom", bottomPx: Math.max(0, Math.round(placement.bottomPx)) }
    : placement.anchor === "top"
      ? { anchor: "top", topPx: Math.max(0, Math.round(placement.topPx)) }
      : {
          anchor: "floating",
          topPx: Math.max(0, Math.round(placement.topPx)),
          leftPx: Math.max(0, Math.round(placement.leftPx)),
          widthPx: Math.max(0, Math.round(placement.widthPx)),
          heightPx: placement.heightPx ? Math.max(0, Math.round(placement.heightPx)) : undefined,
          compact: placement.compact,
        };

const arePlacementsEqual = (a: PanelPlacement, b: PanelPlacement) =>
  a.anchor === b.anchor &&
  (a.anchor === "bottom"
    ? a.bottomPx === (b as { bottomPx: number }).bottomPx
    : a.anchor === "top"
      ? a.topPx === (b as { topPx: number }).topPx
      : a.topPx === (b as { topPx: number }).topPx &&
        a.leftPx === (b as { leftPx: number }).leftPx &&
        a.widthPx === (b as { widthPx: number }).widthPx &&
        a.heightPx === (b as { heightPx?: number }).heightPx &&
        a.compact === (b as { compact?: boolean }).compact);

const rectsOverlapWithGap = (a: RectLike, b: RectLike, gapPx: number) =>
  !(a.right + gapPx <= b.left || a.left - gapPx >= b.right || a.bottom + gapPx <= b.top || a.top - gapPx >= b.bottom);

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getRectForPlacement = (
  panelRect: RectLike,
  placement: PanelPlacement,
  viewportHeight: number,
  viewportTopPx = 0
): RectLike => {
  const height = placement.anchor === "floating" && placement.heightPx
    ? placement.heightPx
    : panelRect.height;
  const width = placement.anchor === "floating" && placement.widthPx
    ? placement.widthPx
    : panelRect.width;
  const top =
    placement.anchor === "bottom"
      ? viewportTopPx + viewportHeight - placement.bottomPx - height
      : placement.topPx;
  const left = placement.anchor === "floating" ? placement.leftPx : panelRect.left;

  return {
    top,
    bottom: top + height,
    left,
    right: left + width,
    width,
    height,
  };
};

const placementScore = (rect: RectLike, targetRect: RectLike): number => {
  const verticalGap = Math.max(targetRect.top - rect.bottom, rect.top - targetRect.bottom, 0);
  const horizontalGap = Math.max(targetRect.left - rect.right, rect.left - targetRect.right, 0);
  return verticalGap * 1000 + horizontalGap;
};

const parsePxValue = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, parsed);
};

const readBottomInsetVarPx = (): number => {
  if (typeof document === "undefined" || !document.documentElement) return 0;
  return parsePxValue(document.documentElement.style.getPropertyValue(BOTTOM_INSET_CSS_VAR)) ?? 0;
};

const writeBottomInsetVar = (value: number): void => {
  if (typeof document === "undefined" || !document.documentElement) return;
  const next = Math.max(0, Math.round(value));
  const current = readBottomInsetVarPx();
  if (Math.abs(next - current) <= BOTTOM_INSET_UPDATE_THRESHOLD_PX) return;
  document.documentElement.style.setProperty(BOTTOM_INSET_CSS_VAR, `${next}px`);
};

const clearBottomInsetVar = (): void => {
  if (typeof document === "undefined" || !document.documentElement) return;
  if (readBottomInsetVarPx() === 0) return;
  document.documentElement.style.setProperty(BOTTOM_INSET_CSS_VAR, "0px");
};

export const resolveMentorGuidanceBottomInsetPx = ({
  panelHeight,
  viewportHeight,
  anchor,
  maxViewportRatio = BOTTOM_INSET_MAX_VIEWPORT_RATIO,
}: {
  panelHeight: number;
  viewportHeight: number;
  anchor: PanelPlacement["anchor"];
  maxViewportRatio?: number;
}): number => {
  if (anchor !== "bottom") return 0;
  if (!Number.isFinite(panelHeight) || panelHeight <= 0) return 0;
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return 0;
  const cap = Math.max(0, viewportHeight * maxViewportRatio);
  return Math.max(0, Math.min(panelHeight, cap));
};

const readSafeAreaInsetTopPx = (): number => {
  if (typeof window === "undefined" || typeof document === "undefined") return 0;

  const rootStyle = window.getComputedStyle(document.documentElement);
  const fromVars =
    parsePxValue(rootStyle.getPropertyValue("--safe-area-inset-top")) ??
    parsePxValue(rootStyle.getPropertyValue("--sat"));
  if (fromVars !== null) return fromVars;

  if (!document.body) return 0;
  const probe = document.createElement("div");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.paddingTop = "env(safe-area-inset-top, 0px)";
  document.body.appendChild(probe);
  const fromProbe = parsePxValue(window.getComputedStyle(probe).paddingTop) ?? 0;
  probe.remove();
  return fromProbe;
};

const isVisibleElement = (element: HTMLElement): boolean => {
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
};

const rectFromElement = (element: HTMLElement): RectLike | null => {
  if (!isVisibleElement(element)) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return rect;
};

const queryElementsForSelector = (selector: string): HTMLElement[] => {
  try {
    return Array.from(document.querySelectorAll<HTMLElement>(selector));
  } catch {
    return [];
  }
};

const collectAvoidRects = (selectors: string[]): RectLike[] => {
  const seen = new Set<HTMLElement>();
  const elements: HTMLElement[] = [];

  selectors.forEach((selector) => {
    queryElementsForSelector(selector).forEach((element) => {
      if (seen.has(element)) return;
      seen.add(element);
      elements.push(element);
    });
  });

  queryElementsForSelector('[data-tutorial-avoid="true"]').forEach((element) => {
    if (seen.has(element)) return;
    seen.add(element);
    elements.push(element);
  });

  return elements
    .map(rectFromElement)
    .filter((rect): rect is RectLike => Boolean(rect));
};

const resolvePinnedTopPx = ({
  minTopPx,
  viewportTopPx,
  headerSelector = COMPANION_HEADER_SELECTOR,
}: {
  minTopPx: number;
  viewportTopPx: number;
  headerSelector?: string;
}): number => {
  const headerRect = queryElementsForSelector(headerSelector)
    .map(rectFromElement)
    .find((rect): rect is RectLike => Boolean(rect));
  const belowHeaderPx = headerRect ? headerRect.bottom + PANEL_GAP_PX : 0;
  return Math.max(viewportTopPx + minTopPx, belowHeaderPx);
};

export const resolveMentorGuidanceMinTopPx = ({
  safeAreaInsetTopPx,
  topMarginPx = PANEL_TOP_MARGIN_PX,
  topSafeBufferPx = PANEL_TOP_SAFE_BUFFER_PX,
}: {
  safeAreaInsetTopPx: number;
  topMarginPx?: number;
  topSafeBufferPx?: number;
}): number => {
  return Math.max(0, Math.round(safeAreaInsetTopPx + topMarginPx + topSafeBufferPx));
};

export const resolveMentorGuidancePlacement = ({
  panelRect,
  targetRect,
  avoidRects = [],
  viewportHeight,
  viewportWidth = Math.max(panelRect.right, panelRect.width),
  viewportTopPx = 0,
  viewportLeftPx = 0,
  baseBottomPx = PANEL_BASE_BOTTOM_PX,
  gapPx = PANEL_GAP_PX,
  topMarginPx = PANEL_TOP_MARGIN_PX,
  minTopPx,
}: {
  panelRect: RectLike;
  targetRect: RectLike | null;
  avoidRects?: RectLike[];
  viewportHeight: number;
  viewportWidth?: number;
  viewportTopPx?: number;
  viewportLeftPx?: number;
  baseBottomPx?: number;
  gapPx?: number;
  topMarginPx?: number;
  minTopPx?: number;
}): PanelPlacement => {
  const resolvedMinTopPx = Math.max(
    0,
    Math.round(Math.max(topMarginPx, minTopPx ?? topMarginPx))
  );
  const baseline: PanelPlacement = { anchor: "bottom", bottomPx: baseBottomPx };
  const allAvoidRects = [
    ...(targetRect ? [targetRect] : []),
    ...avoidRects,
  ];

  if (allAvoidRects.length === 0) {
    return normalizePlacement(baseline);
  }

  const viewportRight = viewportLeftPx + viewportWidth;
  const viewportBottom = viewportTopPx + viewportHeight;
  const panelWidth = Math.min(panelRect.width, Math.max(0, viewportWidth - PANEL_SIDE_MARGIN_PX * 2));
  const primaryRect = targetRect ?? allAvoidRects[0];
  const maxBottomPx = Math.max(
    baseBottomPx,
    viewportHeight - panelRect.height - Math.max(0, resolvedMinTopPx - viewportTopPx),
  );
  const desiredBottomPx = Math.max(baseBottomPx, viewportBottom - primaryRect.top + gapPx);
  const lifted: PanelPlacement = { anchor: "bottom", bottomPx: Math.min(desiredBottomPx, maxBottomPx) };
  const topFallback: PanelPlacement = { anchor: "top", topPx: resolvedMinTopPx };
  const clampLeft = (leftPx: number, widthPx = panelWidth) =>
    clamp(leftPx, viewportLeftPx + PANEL_SIDE_MARGIN_PX, Math.max(viewportLeftPx + PANEL_SIDE_MARGIN_PX, viewportRight - PANEL_SIDE_MARGIN_PX - widthPx));
  const clampTop = (topPx: number, heightPx = panelRect.height) =>
    clamp(topPx, resolvedMinTopPx, Math.max(resolvedMinTopPx, viewportBottom - PANEL_SIDE_MARGIN_PX - heightPx));
  const centeredLeft = clampLeft(primaryRect.left + primaryRect.width / 2 - panelWidth / 2);
  const centeredTop = clampTop(primaryRect.top + primaryRect.height / 2 - panelRect.height / 2);

  const fullCandidates: PanelPlacement[] = [
    baseline,
    lifted,
    topFallback,
    {
      anchor: "floating",
      topPx: clampTop(primaryRect.top - gapPx - panelRect.height),
      leftPx: centeredLeft,
      widthPx: panelWidth,
    },
    {
      anchor: "floating",
      topPx: clampTop(primaryRect.bottom + gapPx),
      leftPx: centeredLeft,
      widthPx: panelWidth,
    },
    {
      anchor: "floating",
      topPx: centeredTop,
      leftPx: clampLeft(primaryRect.left - gapPx - panelWidth),
      widthPx: panelWidth,
    },
    {
      anchor: "floating",
      topPx: centeredTop,
      leftPx: clampLeft(primaryRect.right + gapPx),
      widthPx: panelWidth,
    },
  ];

  const candidates = fullCandidates.map(normalizePlacement).filter((placement, index, arr) => {
    return index === arr.findIndex((item) => arePlacementsEqual(item, placement));
  });

  const rectFitsViewport = (rect: RectLike) =>
    rect.top >= resolvedMinTopPx &&
    rect.bottom <= viewportBottom - PANEL_SIDE_MARGIN_PX &&
    rect.left >= viewportLeftPx + PANEL_SIDE_MARGIN_PX &&
    rect.right <= viewportRight - PANEL_SIDE_MARGIN_PX;

  const rectIsClear = (rect: RectLike) =>
    rectFitsViewport(rect) &&
    !allAvoidRects.some((avoidRect) => rectsOverlapWithGap(rect, avoidRect, gapPx));

  for (const candidate of candidates) {
    const rect = getRectForPlacement(panelRect, candidate, viewportHeight, viewportTopPx);
    if (rectIsClear(rect)) {
      return candidate;
    }
  }

  const compactWidth = Math.min(
    panelWidth,
    COMPACT_PANEL_MAX_WIDTH_PX,
    Math.max(0, viewportWidth - PANEL_SIDE_MARGIN_PX * 2),
  );
  const compactHeight = Math.min(panelRect.height, COMPACT_PANEL_HEIGHT_PX);
  const compactCandidates: PanelPlacement[] = [
    {
      anchor: "floating",
      topPx: resolvedMinTopPx,
      leftPx: viewportLeftPx + PANEL_SIDE_MARGIN_PX,
      widthPx: compactWidth,
      heightPx: compactHeight,
      compact: true,
    },
    {
      anchor: "floating",
      topPx: resolvedMinTopPx,
      leftPx: viewportRight - PANEL_SIDE_MARGIN_PX - compactWidth,
      widthPx: compactWidth,
      heightPx: compactHeight,
      compact: true,
    },
    {
      anchor: "floating",
      topPx: viewportBottom - PANEL_SIDE_MARGIN_PX - compactHeight,
      leftPx: viewportLeftPx + PANEL_SIDE_MARGIN_PX,
      widthPx: compactWidth,
      heightPx: compactHeight,
      compact: true,
    },
    {
      anchor: "floating",
      topPx: viewportBottom - PANEL_SIDE_MARGIN_PX - compactHeight,
      leftPx: viewportRight - PANEL_SIDE_MARGIN_PX - compactWidth,
      widthPx: compactWidth,
      heightPx: compactHeight,
      compact: true,
    },
  ].map(normalizePlacement);

  const clearCompact = compactCandidates.find((candidate) =>
    rectIsClear(getRectForPlacement(panelRect, candidate, viewportHeight, viewportTopPx))
  );
  if (clearCompact) {
    return clearCompact;
  }

  let best = candidates[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of [...compactCandidates, ...candidates]) {
    const rect = getRectForPlacement(panelRect, candidate, viewportHeight, viewportTopPx);
    const overlapPenalty = allAvoidRects.reduce(
      (total, avoidRect) => total + (rectsOverlapWithGap(rect, avoidRect, gapPx) ? 1 : 0),
      0,
    );
    const score = placementScore(rect, primaryRect) - overlapPenalty * 1_000_000;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
};

export const MentorGuidanceCard = () => {
  const {
    isActive,
    activeTargetSelector,
    activeTargetSelectors,
    progressText,
    currentStep,
    dialogueText,
    dialogueSupportText,
    speakerName,
    speakerPrimaryColor,
    speakerSlug,
    speakerAvatarUrl,
    secondaryActionLabel,
    onSecondaryAction,
    dialogueActionLabel,
    onDialogueAction,
    completionOverlay,
  } = usePostOnboardingMentorGuidance();

  const wrapperRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<PanelPlacement>({
    anchor: "bottom",
    bottomPx: PANEL_BASE_BOTTOM_PX,
  });

  const updatePlacement = useCallback(() => {
    if (!isActive) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const panelRect = (panelRef.current ?? wrapper).getBoundingClientRect();
    if (panelRect.height <= 0) return;

    const targetElement = activeTargetSelector
      ? resolveTutorialTarget(activeTargetSelector)?.element ?? null
      : null;
    const targetRect = targetElement ? rectFromElement(targetElement) : null;
    const safeAreaInsetTopPx = readSafeAreaInsetTopPx();
    const minTopPx = resolveMentorGuidanceMinTopPx({ safeAreaInsetTopPx });
    const visualViewport = window.visualViewport;
    const viewportHeight = visualViewport?.height ?? window.innerHeight;
    const viewportWidth = visualViewport?.width ?? window.innerWidth;
    const viewportTopPx = visualViewport?.offsetTop ?? 0;
    const viewportLeftPx = visualViewport?.offsetLeft ?? 0;
    const isHatchCompanionStep = currentStep === "hatch_companion";

    const next = isHatchCompanionStep
      ? normalizePlacement({
          anchor: "top",
          topPx: resolvePinnedTopPx({ minTopPx, viewportTopPx }),
        })
      : resolveMentorGuidancePlacement({
          panelRect,
          targetRect,
          avoidRects: collectAvoidRects(activeTargetSelectors),
          viewportHeight,
          viewportWidth,
          viewportTopPx,
          viewportLeftPx,
          minTopPx,
        });

    writeBottomInsetVar(
      resolveMentorGuidanceBottomInsetPx({
        panelHeight: panelRect.height,
        viewportHeight,
        anchor: next.anchor,
      })
    );

    setPlacement((prev) => (arePlacementsEqual(prev, next) ? prev : next));
  }, [activeTargetSelector, activeTargetSelectors, currentStep, isActive]);

  useEffect(() => {
    if (!isActive) {
      setPlacement({ anchor: "bottom", bottomPx: PANEL_BASE_BOTTOM_PX });
      return;
    }

    const raf = window.requestAnimationFrame(updatePlacement);
    const handleRelayout = () => updatePlacement();
    const isHatchCompanionStep = currentStep === "hatch_companion";

    window.addEventListener("resize", handleRelayout);
    if (!isHatchCompanionStep) {
      window.addEventListener("scroll", handleRelayout, true);
    }
    window.addEventListener("orientationchange", handleRelayout);
    window.visualViewport?.addEventListener("resize", handleRelayout);
    if (!isHatchCompanionStep) {
      window.visualViewport?.addEventListener("scroll", handleRelayout);
    }

    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => updatePlacement())
      : null;

    if (observer) {
      if (wrapperRef.current) observer.observe(wrapperRef.current);
      if (panelRef.current) observer.observe(panelRef.current);
    }

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleRelayout);
      if (!isHatchCompanionStep) {
        window.removeEventListener("scroll", handleRelayout, true);
      }
      window.removeEventListener("orientationchange", handleRelayout);
      window.visualViewport?.removeEventListener("resize", handleRelayout);
      if (!isHatchCompanionStep) {
        window.visualViewport?.removeEventListener("scroll", handleRelayout);
      }
      observer?.disconnect();
    };
  }, [currentStep, isActive, updatePlacement]);

  const isPanelVisible = Boolean(isActive && dialogueText);

  useEffect(() => {
    if (!isPanelVisible) {
      clearBottomInsetVar();
    }
  }, [isPanelVisible]);

  useEffect(() => () => clearBottomInsetVar(), []);

  const placementStyle = useMemo(
    (): CSSProperties => {
      if (placement.anchor === "bottom") {
        return {
          top: undefined,
          bottom: `${placement.bottomPx}px`,
          left: 0,
          right: 0,
          width: undefined,
        };
      }
      if (placement.anchor === "top") {
        return {
          bottom: undefined,
          top: `${placement.topPx}px`,
          left: 0,
          right: 0,
          width: undefined,
        };
      }
      return {
        bottom: undefined,
        right: undefined,
        top: `${placement.topPx}px`,
        left: `${placement.leftPx}px`,
        width: `${placement.widthPx}px`,
        height: placement.heightPx ? `${placement.heightPx}px` : undefined,
      };
    },
    [placement]
  );
  const isCompact = placement.anchor === "floating" && placement.compact;

  if (!isActive || !dialogueText || completionOverlay) {
    return null;
  }

  return (
    <section
      ref={wrapperRef}
      data-tutorial="mentor-dialogue-panel"
      data-placement={placement.anchor}
      data-compact={isCompact ? "true" : undefined}
      className={cn(
        "pointer-events-none fixed z-[105] transition-[top,bottom,left,width] duration-200",
        placement.anchor === "floating"
          ? "px-0 pb-0"
          : "px-3 pb-[calc(env(safe-area-inset-bottom,0px)+10px)]",
      )}
      style={placementStyle}
      aria-live="polite"
    >
      <div
        ref={panelRef}
        data-testid="mentor-guidance-card-panel"
        className={cn(
          "pointer-events-none rounded-2xl border border-white/20 bg-black/65 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-md",
          isCompact
            ? "h-full w-full overflow-hidden rounded-xl"
            : "mx-auto w-full max-w-[22rem] sm:max-w-4xl",
        )}
      >
        <div className={cn("flex gap-3", isCompact ? "h-full items-center p-3" : "items-end p-3 sm:p-4")}>
          <div className={cn("shrink-0", isCompact && "hidden")}>
            <MentorAvatar
              mentorSlug={(speakerSlug || "").toLowerCase()}
              mentorName={speakerName}
              primaryColor={speakerPrimaryColor || "#f59e0b"}
              avatarUrl={speakerAvatarUrl}
              size="sm"
              className="h-20 w-20 sm:h-24 sm:w-24"
              showBorder={true}
              showGlow={false}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className={cn("text-[10px] uppercase tracking-[0.16em] text-amber-200/90", isCompact && "sr-only")}>{progressText}</p>
            <p className={cn("mt-1 inline-flex rounded-md bg-black/45 px-2 py-0.5 text-xs font-semibold text-amber-100", isCompact && "mt-0")}>
              {speakerName}
            </p>
            <p className={cn("mt-2 text-base leading-relaxed text-white sm:text-lg", isCompact && "mt-1 line-clamp-2 text-sm leading-snug sm:text-sm")}>{dialogueText}</p>
            {dialogueSupportText && !isCompact ? (
              <p className="mt-1 text-sm leading-relaxed text-white/80">{dialogueSupportText}</p>
            ) : null}
            {!isCompact && ((onSecondaryAction && secondaryActionLabel) || onDialogueAction) ? (
              <div className={cn("mt-3 flex flex-wrap gap-2", isCompact && "mt-2")}>
                {onSecondaryAction && secondaryActionLabel ? (
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={secondaryActionLabel}
                    onClick={onSecondaryAction}
                    className={cn(
                      "pointer-events-auto h-9 rounded-xl border border-white/25 bg-black/45 text-white hover:bg-black/60",
                      isCompact && "h-8 px-2 text-xs",
                    )}
                  >
                    {secondaryActionLabel}
                  </Button>
                ) : null}
                {onDialogueAction ? (
                  <Button
                    type="button"
                    onClick={onDialogueAction}
                    className={cn(
                      "pointer-events-auto h-9 rounded-xl bg-amber-500 text-black hover:bg-amber-400",
                      isCompact && "h-8 px-2 text-xs",
                    )}
                  >
                    {dialogueActionLabel || "Continue"}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};
