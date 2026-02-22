import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePostOnboardingMentorGuidance } from "@/hooks/usePostOnboardingMentorGuidance";
import { MentorAvatar } from "@/components/MentorAvatar";
import { Button } from "@/components/ui/button";

const PANEL_GAP_PX = 12;
const PANEL_TOP_MARGIN_PX = 12;
const PANEL_TOP_SAFE_BUFFER_PX = 8;
const PANEL_BASE_BOTTOM_PX = 0;

type PanelPlacement =
  | { anchor: "bottom"; bottomPx: number }
  | { anchor: "top"; topPx: number };

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
    : { anchor: "top", topPx: Math.max(0, Math.round(placement.topPx)) };

const arePlacementsEqual = (a: PanelPlacement, b: PanelPlacement) =>
  a.anchor === b.anchor &&
  (a.anchor === "bottom" ? a.bottomPx === (b as { bottomPx: number }).bottomPx : a.topPx === (b as { topPx: number }).topPx);

const rectsOverlapWithGap = (a: RectLike, b: RectLike, gapPx: number) =>
  !(a.right + gapPx <= b.left || a.left - gapPx >= b.right || a.bottom + gapPx <= b.top || a.top - gapPx >= b.bottom);

const getRectForPlacement = (
  panelRect: RectLike,
  placement: PanelPlacement,
  viewportHeight: number
): RectLike => {
  const top =
    placement.anchor === "bottom"
      ? viewportHeight - placement.bottomPx - panelRect.height
      : placement.topPx;

  return {
    top,
    bottom: top + panelRect.height,
    left: panelRect.left,
    right: panelRect.right,
    width: panelRect.width,
    height: panelRect.height,
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
  viewportHeight,
  baseBottomPx = PANEL_BASE_BOTTOM_PX,
  gapPx = PANEL_GAP_PX,
  topMarginPx = PANEL_TOP_MARGIN_PX,
  minTopPx,
}: {
  panelRect: RectLike;
  targetRect: RectLike | null;
  viewportHeight: number;
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

  if (!targetRect) {
    return normalizePlacement(baseline);
  }

  const maxBottomPx = Math.max(baseBottomPx, viewportHeight - panelRect.height - resolvedMinTopPx);
  const desiredBottomPx = Math.max(baseBottomPx, viewportHeight - targetRect.top + gapPx);
  const lifted: PanelPlacement = { anchor: "bottom", bottomPx: Math.min(desiredBottomPx, maxBottomPx) };
  const topFallback: PanelPlacement = { anchor: "top", topPx: resolvedMinTopPx };

  const candidates = [baseline, lifted, topFallback].map(normalizePlacement).filter((placement, index, arr) => {
    return index === arr.findIndex((item) => arePlacementsEqual(item, placement));
  });

  for (const candidate of candidates) {
    const rect = getRectForPlacement(panelRect, candidate, viewportHeight);
    if (!rectsOverlapWithGap(rect, targetRect, gapPx)) {
      return candidate;
    }
  }

  let best = candidates[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const rect = getRectForPlacement(panelRect, candidate, viewportHeight);
    const score = placementScore(rect, targetRect);
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
    canTemporarilyHide,
    progressText,
    dialogueText,
    dialogueSupportText,
    speakerName,
    speakerPrimaryColor,
    speakerSlug,
    speakerAvatarUrl,
    dialogueActionLabel,
    onDialogueAction,
  } = usePostOnboardingMentorGuidance();

  const wrapperRef = useRef<HTMLElement | null>(null);
  const [placement, setPlacement] = useState<PanelPlacement>({
    anchor: "bottom",
    bottomPx: PANEL_BASE_BOTTOM_PX,
  });
  const [isTemporarilyHidden, setIsTemporarilyHidden] = useState(false);

  const updatePlacement = useCallback(() => {
    if (!isActive) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const panelRect = wrapper.getBoundingClientRect();
    if (panelRect.height <= 0) return;

    const targetElement = activeTargetSelector
      ? (document.querySelector(activeTargetSelector) as HTMLElement | null)
      : null;
    const targetRect = targetElement?.getBoundingClientRect() ?? null;
    const safeAreaInsetTopPx = readSafeAreaInsetTopPx();
    const minTopPx = resolveMentorGuidanceMinTopPx({ safeAreaInsetTopPx });

    const next = resolveMentorGuidancePlacement({
      panelRect,
      targetRect,
      viewportHeight: window.innerHeight,
      minTopPx,
    });

    setPlacement((prev) => (arePlacementsEqual(prev, next) ? prev : next));
  }, [activeTargetSelector, isActive]);

  useEffect(() => {
    if (!isActive) {
      setPlacement({ anchor: "bottom", bottomPx: PANEL_BASE_BOTTOM_PX });
      return;
    }

    const raf = window.requestAnimationFrame(updatePlacement);
    const handleRelayout = () => updatePlacement();

    window.addEventListener("resize", handleRelayout);
    window.addEventListener("scroll", handleRelayout, true);
    window.addEventListener("orientationchange", handleRelayout);

    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => updatePlacement())
      : null;

    if (observer && wrapperRef.current) {
      observer.observe(wrapperRef.current);
    }

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleRelayout);
      window.removeEventListener("scroll", handleRelayout, true);
      window.removeEventListener("orientationchange", handleRelayout);
      observer?.disconnect();
    };
  }, [isActive, updatePlacement]);

  useEffect(() => {
    if (canTemporarilyHide) return;
    setIsTemporarilyHidden(false);
  }, [canTemporarilyHide]);

  const placementStyle = useMemo(
    () =>
      placement.anchor === "bottom"
        ? { top: "auto", bottom: `${placement.bottomPx}px` }
        : { bottom: "auto", top: `${placement.topPx}px` },
    [placement]
  );

  if (!isActive || !dialogueText || (canTemporarilyHide && isTemporarilyHidden)) {
    return null;
  }

  return (
    <section
      ref={wrapperRef}
      data-tutorial="mentor-dialogue-panel"
      className="pointer-events-none fixed left-0 right-0 z-[105] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] transition-[top,bottom] duration-200"
      style={placementStyle}
      aria-live="polite"
    >
      <div className="pointer-events-none mx-auto max-w-4xl rounded-2xl border border-white/20 bg-black/65 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <div className="flex items-end gap-3 p-3 sm:p-4">
          <div className="shrink-0">
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
            <p className="text-[10px] uppercase tracking-[0.16em] text-amber-200/90">{progressText}</p>
            <p className="mt-1 inline-flex rounded-md bg-black/45 px-2 py-0.5 text-xs font-semibold text-amber-100">
              {speakerName}
            </p>
            <p className="mt-2 text-base leading-relaxed text-white sm:text-lg">{dialogueText}</p>
            {dialogueSupportText ? (
              <p className="mt-1 text-sm leading-relaxed text-white/80">{dialogueSupportText}</p>
            ) : null}
            {canTemporarilyHide ? (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="Hide tutorial"
                  onClick={() => setIsTemporarilyHidden(true)}
                  className="pointer-events-auto h-9 rounded-xl border border-white/25 bg-black/45 text-white hover:bg-black/60"
                >
                  Hide tutorial
                </Button>
              </div>
            ) : null}
            {onDialogueAction ? (
              <div className="mt-3">
                <Button
                  type="button"
                  onClick={onDialogueAction}
                  className="pointer-events-auto h-9 rounded-xl bg-amber-500 text-black hover:bg-amber-400"
                >
                  {dialogueActionLabel || "Continue"}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};
