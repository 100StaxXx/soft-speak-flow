import type { ButtonHTMLAttributes } from "react";
import { CompanionImage, CompanionPortraitShell } from "@/components/CompanionImage";
import { cn } from "@/lib/utils";
import { useJourneysCompanionVisual } from "@/hooks/useJourneysCompanionVisual";
import { useCompanionImageBackgroundCutout } from "@/hooks/useCompanionImageBackgroundCutout";

type JourneysCompanionLauncherVariant = "floating" | "inline";
type JourneysCompanionLauncherFaceDirection = "front" | "away";

interface JourneysCompanionLauncherProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: JourneysCompanionLauncherVariant;
  compact?: boolean;
  text?: string;
  caption?: string;
  imageUrlOverride?: string | null;
  imageFocalXOverride?: number | null;
  imageFocalYOverride?: number | null;
  usesPortraitShellOverride?: boolean;
  floatingSize?: "default" | "hero";
  faceDirection?: JourneysCompanionLauncherFaceDirection;
}

export function JourneysCompanionLauncher({
  variant,
  compact = false,
  text,
  caption = "Companion chat",
  imageUrlOverride,
  imageFocalXOverride,
  imageFocalYOverride,
  usesPortraitShellOverride,
  floatingSize = "default",
  faceDirection = "front",
  className,
  type = "button",
  ...props
}: JourneysCompanionLauncherProps) {
  const {
    companionLabel,
    imageUrl,
    focalX,
    focalY,
    element,
    usesPortraitShell,
    launcherImageUrl,
    launcherImageFocalX,
    launcherImageFocalY,
    launcherImageFresh,
    launcherImageStatus,
    retryLauncherImage,
  } = useJourneysCompanionVisual();

  const isFloatingHero = variant === "floating" && floatingSize === "hero";
  // All launcher surfaces (small floating, hero floating, inline) prefer the
  // dedicated white-bg launcher icon when one is available. The hero variant
  // still uses the client-side background-cutout pipeline as a fallback for
  // companions whose launcher icon hasn't been generated yet.
  const useLauncherIcon = launcherImageFresh;
  const sourceImageUrl = useLauncherIcon ? launcherImageUrl : imageUrl;
  const sourceFocalX = useLauncherIcon ? launcherImageFocalX : focalX;
  const sourceFocalY = useLauncherIcon ? launcherImageFocalY : focalY;
  const resolvedImageUrl = imageUrlOverride ?? sourceImageUrl;
  const resolvedFocalX = imageFocalXOverride ?? sourceFocalX;
  const resolvedFocalY = imageFocalYOverride ?? sourceFocalY;
  const resolvedUsesPortraitShell = usesPortraitShellOverride ?? usesPortraitShell;
  const resolvedText = text ?? `Chat with ${companionLabel}`;
  // For the hero FAB on AI companions: when there is no bundled portrait
  // shell AND the white-bg launcher icon hasn't generated yet, the source
  // image is the scenic page art (e.g. lava). The canvas cutout cannot
  // recover a clean icon from that, so we render a deterministic pending
  // placeholder instead — never the scenic image at hero size.
  const launcherIconStatus = launcherImageStatus ?? "ready";
  // For an AI companion (no bundled portrait shell) the only viable hero
  // icon is the dedicated white-bg launcher image. Until that lands, the
  // page art is too busy to read as an icon and the canvas cutout cannot
  // recover one — so we render a deterministic placeholder instead of
  // letting the broken cutout flow try and fail. Gate on status so legacy
  // call sites that don't wire the launcher hook keep their old behavior.
  const showHeroLauncherPlaceholder =
    isFloatingHero
    && !resolvedUsesPortraitShell
    && !useLauncherIcon
    && launcherIconStatus !== "ready";
  // Skip the expensive client-side cutout when we already have a clean
  // white-bg launcher icon, when we're showing the pending placeholder, or
  // when there's no real source to cut out.
  const shouldCutOutHeroBackground =
    isFloatingHero
    && !resolvedUsesPortraitShell
    && !useLauncherIcon
    && !showHeroLauncherPlaceholder;
  const {
    cutoutSrc: heroCutoutSrc,
    status: heroCutoutStatus,
  } = useCompanionImageBackgroundCutout(resolvedImageUrl, {
    enabled: shouldCutOutHeroBackground,
  });
  const resolvedHeroImageUrl = heroCutoutSrc ?? resolvedImageUrl;
  const isWaitingForHeroCutout = shouldCutOutHeroBackground
    && (heroCutoutStatus === "idle" || heroCutoutStatus === "processing");
  const portraitClassName = variant === "floating"
    ? isFloatingHero
      ? "h-[7.75rem] w-[7.75rem]"
      : "h-9 w-9"
    : compact
      ? "h-9 w-9"
      : "h-10 w-10";

  const portrait = isFloatingHero ? (
    showHeroLauncherPlaceholder ? (
      <div
        className={cn("relative shrink-0", portraitClassName)}
        style={{ filter: "drop-shadow(0 10px 24px rgba(0, 0, 0, 0.24))" }}
        role="img"
        aria-label={`Preparing icon for ${companionLabel}`}
        data-launcher-icon-status={launcherIconStatus}
        data-testid="journeys-companion-launcher-pending"
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.18),rgba(255,255,255,0.04)_60%,transparent_78%)] animate-pulse"
        />
        <span
          aria-hidden="true"
          className="absolute inset-[22%] rounded-full bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.32),rgba(125,211,252,0.12)_55%,transparent_82%)] animate-pulse"
        />
      </div>
    ) : (
      <div
        className={cn("relative shrink-0", portraitClassName)}
        style={{ filter: "drop-shadow(0 10px 24px rgba(0, 0, 0, 0.24))" }}
      >
        <CompanionImage
          src={resolvedHeroImageUrl}
          alt={companionLabel}
          fit={resolvedUsesPortraitShell ? "portrait" : "contain"}
          element={element}
          focalX={resolvedFocalX}
          focalY={resolvedFocalY}
          className={cn(
            "pointer-events-none select-none transition-opacity duration-150",
            isWaitingForHeroCutout && "opacity-0",
          )}
          draggable={false}
          data-companion-background-cutout={shouldCutOutHeroBackground ? heroCutoutStatus : undefined}
        />
      </div>
    )
  ) : resolvedUsesPortraitShell ? (
    <CompanionPortraitShell
      src={resolvedImageUrl}
      element={element}
      className={cn("overflow-hidden rounded-full", portraitClassName)}
    >
      <CompanionImage
        src={resolvedImageUrl}
        alt={companionLabel}
        fit="portrait"
        element={element}
        focalX={resolvedFocalX}
        focalY={resolvedFocalY}
        className="rounded-full"
      />
    </CompanionPortraitShell>
  ) : (
    <div className={cn("overflow-hidden rounded-full bg-white/10", portraitClassName)}>
      <CompanionImage
        src={resolvedImageUrl}
        alt={companionLabel}
        element={element}
        focalX={resolvedFocalX}
        focalY={resolvedFocalY}
        className="rounded-full"
      />
    </div>
  );

  if (variant === "floating") {
    return (
      <button
        type={type}
        className={cn(
          "group relative flex items-center justify-center transition-transform duration-300 hover:scale-[1.02]",
          isFloatingHero
            ? "h-36 w-36 overflow-visible bg-transparent p-0"
            : "h-12 w-12 rounded-full border border-white/12 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),rgba(255,255,255,0.04)_48%,rgba(15,23,42,0.92))] shadow-[0_12px_28px_rgba(0,0,0,0.22)]",
          className,
        )}
        data-face-direction={faceDirection}
        {...props}
      >
        {!isFloatingHero ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(125,211,252,0.35),transparent_42%),radial-gradient(circle_at_70%_75%,rgba(244,114,182,0.18),transparent_42%)]"
          />
        ) : null}
        <span
          className={cn(
            "relative flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            faceDirection === "away" ? "-scale-x-100 rotate-[3deg]" : "scale-x-100 rotate-0",
          )}
        >
          {portrait}
        </span>
      </button>
    );
  }

  return (
    <button
      type={type}
      className={cn(
        "group relative inline-flex items-center gap-3 overflow-hidden rounded-[20px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.07),transparent_48%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] px-3 py-2 text-left shadow-[0_16px_28px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all hover:border-white/15 hover:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.1),transparent_48%),linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))]",
        compact ? "min-h-10" : "min-h-11",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(125,211,252,0.14),transparent_34%),radial-gradient(circle_at_85%_78%,rgba(250,204,21,0.1),transparent_28%)]"
      />
      <span className="relative shrink-0">
        {portrait}
      </span>
      <span className="relative min-w-0">
        {!compact ? (
          <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-white/46">
            {caption}
          </span>
        ) : null}
        <span className={cn("block truncate font-semibold text-white", compact ? "text-sm" : "text-[0.95rem]")}>
          {resolvedText}
        </span>
      </span>
    </button>
  );
}
